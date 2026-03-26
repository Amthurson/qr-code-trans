/**
 * 简化的文件传输测试 - 验证编码解码逻辑
 */

const fs = require('fs');
const LZString = require('lz-string');

// CRC32 实现
function crc32(data) {
  let crc = 0xffffffff;
  const table = getCRC32Table();
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data.charCodeAt(i)) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

let crc32Table = null;
function getCRC32Table() {
  if (crc32Table) return crc32Table;
  crc32Table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crc32Table[i] = c >>> 0;
  }
  return crc32Table;
}

// 分片函数
function chunkData(base64Data, chunkSize = 1500) {
  const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  const compressed = LZString.compressToEncodedURIComponent(base64Data);
  const totalChunks = Math.ceil(compressed.length / chunkSize);
  const chunks = [];
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, compressed.length);
    const chunkData = compressed.substring(start, end);
    
    chunks.push({
      index: i,
      total: totalChunks,
      fileId,
      crc32: crc32(chunkData),
      data: chunkData,
    });
  }
  
  return chunks;
}

// 重组函数
function reassembleFile(chunks) {
  const sortedChunks = [...chunks].sort((a, b) => a.index - b.index);
  let compressed = '';
  for (const chunk of sortedChunks) {
    compressed += chunk.data;
  }
  const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
  return decompressed;
}

// 主测试流程
console.log('🧪 开始测试文件传输流程...\n');

// 1. 读取测试文件
console.log('📁 1. 读取测试文件...');
const testFileContent = fs.readFileSync('./test_files/产业园列表.csv', 'utf-8');
console.log(`   文件大小：${testFileContent.length} 字符`);

// 2. Base64 编码
console.log('\n📝 2. Base64 编码...');
const base64Data = Buffer.from(testFileContent, 'utf-8').toString('base64');
console.log(`   Base64 大小：${base64Data.length} 字符`);

// 3. 压缩 + 分片
console.log('\n📦 3. 压缩 + 分片...');
const compressed = LZString.compressToEncodedURIComponent(base64Data);
const compressionRatio = Math.round((1 - compressed.length / base64Data.length) * 100);
console.log(`   压缩后大小：${compressed.length} 字符`);
console.log(`   压缩率：${compressionRatio}%`);

const chunks = chunkData(base64Data, 1500);
console.log(`   分片数量：${chunks.length} 个`);
console.log(`   每片大小：~1500 字符`);

// 4. 模拟乱序接收
console.log('\n📡 4. 模拟乱序接收...');
const receivedChunks = [];
const chunkSet = new Set();
const shuffledIndices = [...Array(chunks.length).keys()].sort(() => Math.random() - 0.5);

for (const index of shuffledIndices) {
  const chunk = chunks[index];
  if (!chunkSet.has(chunk.index) && crc32(chunk.data) === chunk.crc32) {
    chunkSet.add(chunk.index);
    receivedChunks.push(chunk);
  }
}

console.log(`   接收成功：${receivedChunks.length}/${chunks.length} 个`);

// 5. 重组文件
console.log('\n🔧 5. 重组文件...');
const reassembledBase64 = reassembleFile(receivedChunks);
console.log(`   重组后 Base64：${reassembledBase64.length} 字符`);

// 6. Base64 解码
console.log('\n📝 6. Base64 解码...');
const decodedContent = Buffer.from(reassembledBase64, 'base64').toString('utf-8');

// 7. 验证
console.log('\n✅ 7. 验证文件完整性...');
if (decodedContent === testFileContent) {
  console.log('   🎉 文件完全匹配！测试通过！\n');
  fs.writeFileSync('./test_files/decoded_output.csv', decodedContent);
  console.log('💾 输出已保存到 test_files/decoded_output.csv\n');
} else {
  console.log('   ❌ 文件内容不匹配！\n');
  console.log('   原始:', testFileContent.substring(0, 80));
  console.log('   解码:', decodedContent.substring(0, 80));
}

console.log('🎊 测试完成！\n');
