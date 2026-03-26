/**
 * 文件传输模块
 * 支持任意文件的编码/解码，通过二维码序列传输
 */

import LZString from 'lz-string';

/**
 * 分片元数据
 */
export interface ChunkMetadata {
  index: number;      // 当前分片索引
  total: number;      // 总分片数
  fileId: string;     // 文件唯一标识
  crc32: number;      // 数据校验码
  data: string;       // 分片数据（压缩后的 base64）
}

/**
 * 文件元数据（最后一个分片传输）
 */
export interface FileMetadata {
  type: 'file-meta';
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  crc32: number;      // 完整文件的 CRC32
  timestamp: number;
}

/**
 * 结束标识（标识传输完成）
 */
export interface EndMarker {
  type: 'end';
  fileId: string;
}

export type QRData = ChunkMetadata | FileMetadata | EndMarker;

/**
 * 生成文件唯一 ID
 */
export function generateFileId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * 计算 CRC32 校验码
 */
export function crc32(data: string): number {
  let crc = 0xffffffff;
  const table = getCRC32Table();
  
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data.charCodeAt(i)) & 0xff];
  }
  
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * CRC32 查找表（缓存）
 */
let crc32Table: number[] | null = null;

function getCRC32Table(): number[] {
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

/**
 * 将文件转换为 Base64
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // 移除 data:image/png;base64, 前缀
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 将 Base64 转换为 Blob
 */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * 将文件数据分片
 * @param base64Data Base64 编码的文件数据
 * @param chunkSize 每个分片的大小（字符数），默认 1800（确保二维码可扫）
 */
export function chunkData(base64Data: string, chunkSize = 1800): ChunkMetadata[] {
  const fileId = generateFileId();
  const totalChunks = Math.ceil(base64Data.length / chunkSize);
  const chunks: ChunkMetadata[] = [];
  
  // 先压缩整个数据
  const compressed = LZString.compressToEncodedURIComponent(base64Data);
  
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

/**
 * 生成文件元数据分片
 */
export function createFileMetadata(
  fileName: string,
  fileSize: number,
  mimeType: string,
  totalChunks: number,
  fileCrc32: number
): FileMetadata {
  return {
    type: 'file-meta',
    fileId: generateFileId(),
    fileName,
    fileSize,
    mimeType,
    totalChunks,
    crc32: fileCrc32,
    timestamp: Date.now(),
  };
}

/**
 * 生成结束标识
 */
export function createEndMarker(fileId: string): EndMarker {
  return {
    type: 'end',
    fileId,
  };
}

/**
 * 将 QR 数据编码为 JSON 字符串
 */
export function encodeQRData(data: QRData): string {
  return JSON.stringify(data);
}

/**
 * 解码 QR 数据
 */
export function decodeQRData(qrText: string): QRData | null {
  try {
    const parsed = JSON.parse(qrText);
    
    // 验证是否为有效的 QR 数据
    if (typeof parsed === 'object' && parsed !== null) {
      if ('type' in parsed && (parsed.type === 'file-meta' || parsed.type === 'end')) {
        return parsed as FileMetadata | EndMarker;
      }
      if ('index' in parsed && 'total' in parsed && 'fileId' in parsed && 'data' in parsed) {
        return parsed as ChunkMetadata;
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * 重组文件数据
 */
export function reassembleFile(chunks: ChunkMetadata[], base64Data: string): string {
  // 按索引排序
  const sortedChunks = [...chunks].sort((a, b) => a.index - b.index);
  
  // 拼接所有分片数据
  let compressed = '';
  for (const chunk of sortedChunks) {
    compressed += chunk.data;
  }
  
  // 解压
  const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
  
  if (!decompressed) {
    throw new Error('解压失败');
  }
  
  return decompressed;
}

/**
 * 验证分片完整性
 */
export function verifyChunk(chunk: ChunkMetadata): boolean {
  return crc32(chunk.data) === chunk.crc32;
}

/**
 * 计算文件大小（人类可读格式）
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
}

/**
 * 估算分片数量
 * @param fileSizeBytes 文件大小（字节）
 * @param chunkSize 每个分片大小（字符数）
 */
export function estimateChunks(fileSizeBytes: number, chunkSize = 1800): number {
  // Base64 编码后大小约为原始的 4/3
  const base64Size = Math.ceil(fileSizeBytes * 4 / 3);
  
  // 压缩率按 70% 估算
  const compressedSize = Math.ceil(base64Size * 0.7);
  
  return Math.ceil(compressedSize / chunkSize);
}
