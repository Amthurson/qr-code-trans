/**
 * 数据压缩模块
 * 使用 LZ-String 算法进行压缩
 */

import LZString from 'lz-string';

/**
 * 压缩字符串
 */
export function compress(data: string): string {
  return LZString.compressToEncodedURIComponent(data);
}

/**
 * 解压字符串
 */
export function decompress(compressed: string): string {
  return LZString.decompressFromEncodedURIComponent(compressed) || '';
}

/**
 * 计算压缩率
 */
export function calculateCompressionRatio(original: string, compressed: string): number {
  if (original.length === 0) return 0;
  return Math.round((1 - compressed.length / original.length) * 100);
}
