/**
 * 文件传输流程测试脚本
 * 在 Node.js 环境中运行，测试完整的编码 → 解码流程
 */

import { chunkData, createFileMetadata, createEndMarker, encodeQRData, decodeQRData, reassembleFile, crc32, verifyChunk } from './src/lib/file-transfer.js';
import { readFileSync, writeFileSync } from 'fs';

console.log('🧪 开始测试文件传输流程...\n');

// 1. 读取测试文件
console.log('📁 1. 读取测试文件...');
const testFileContent = readFileSync('./test_files/产业园列表.csv', 'utf-8');
console.log(`   文件大小：${testFileContent.length} 字符`);
console.log(`   文件预览：${testFileContent.substring(0, 50)}...\n`);

// 2. 模拟 Base64 编码（Node.js 环境）
console.log('📝 2. Base64 编码...');
const base64Data = Buffer.from(testFileContent, 'utf-8').toString('base64');
console.log(`   Base64 大小：${base64Data.length} 字符\n`);

// 3. 分片编码
console.log('📦 3. 分片编码...');
const chunkSize = 1500;
const chunks = chunkData(base64Data, chunkSize);
console.log(`   分片数量：${chunks.length} 个`);
console.log(`   每个分片大小：~${chunkSize} 字符\n`);

// 4. 创建元数据和结束标识
console.log('📋 4. 创建元数据和结束标识...');
const fileCrc = crc32(base64Data);
const metaChunk = createFileMetadata(
  '产业园列表.csv',
  testFileContent.length,
  'text/csv',
  chunks.length,
  fileCrc
);
const endMarker = createEndMarker(metaChunk.fileId);

console.log(`   文件 ID: ${metaChunk.fileId}`);
console.log(`   元数据：${metaChunk.fileName} (${metaChunk.fileSize} 字节)\n`);

// 5. 模拟二维码序列
console.log('📱 5. 生成二维码序列...');
const allChunks = [...chunks, metaChunk, endMarker];
const qrSequence = allChunks.map(chunk => encodeQRData(chunk));
console.log(`   二维码总数：${qrSequence.length} 个`);
console.log(`   第一个二维码：${qrSequence[0].substring(0, 50)}...\n`);

// 6. 模拟扫描接收（带乱序和重复）
console.log('📡 6. 模拟扫描接收（乱序 + 重复）...');
const receivedChunks = [];
const chunkSet = new Set();

// 模拟乱序接收
const shuffledIndices = [...Array(chunks.length).keys()].sort(() => Math.random() - 0.5);
console.log(`   接收顺序：${shuffledIndices.join(', ')}\n`);

for (const index of shuffledIndices) {
  const qrData = qrSequence[index];
  const decoded = decodeQRData(qrData);
  
  if (decoded && 'index' in decoded) {
    // 去重检查
    if (!chunkSet.has(decoded.index)) {
      chunkSet.add(decoded.index);
      
      // 验证完整性
      if (verifyChunk(decoded)) {
        receivedChunks.push(decoded);
        console.log(`   ✅ 收到分片 ${decoded.index + 1}/${decoded.total} (校验通过)`);
      } else {
        console.log(`   ❌ 分片 ${decoded.index} 校验失败`);
      }
    } else {
      console.log(`   ⏭️  跳过重复分片 ${decoded.index}`);
    }
  }
}

console.log(`\n   实际接收：${receivedChunks.length}/${chunks.length} 个分片\n`);

// 7. 重组文件
console.log('🔧 7. 重组文件...');
try {
  const reassembledBase64 = reassembleFile(receivedChunks, '');
  console.log(`   ✅ 重组成功`);
  console.log(`   重组后大小：${reassembledBase64.length} 字符\n`);
  
  // 8. Base64 解码
  console.log('📝 8. Base64 解码...');
  const decodedContent = Buffer.from(reassembledBase64, 'base64').toString('utf-8');
  console.log(`   解码后大小：${decodedContent.length} 字符\n`);
  
  // 9. 验证文件完整性
  console.log('✅ 9. 验证文件完整性...');
  if (decodedContent === testFileContent) {
    console.log('   🎉 文件完全匹配！测试通过！\n');
  } else {
    console.log('   ❌ 文件内容不匹配！测试失败！\n');
    console.log('   原始内容预览:', testFileContent.substring(0, 100));
    console.log('   解码内容预览:', decodedContent.substring(0, 100));
  }
  
  // 10. 保存测试输出
  console.log('💾 10. 保存测试结果...');
  writeFileSync('./test_files/decoded_output.csv', decodedContent);
  console.log('   ✅ 输出已保存到 test_files/decoded_output.csv\n');
  
} catch (error) {
  console.log(`   ❌ 重组失败：${error.message}\n`);
}

console.log('🎊 测试完成！\n');
