/**
 * Luby Transform 编码器 - 基于 Qrs 项目实现
 * 使用喷泉码（Fountain Codes）实现二维码流式数据传输
 */

import { deflate, inflate } from 'pako'

export interface EncodedBlock {
  k: number // 原始块数量
  bytes: number // 原始数据字节数
  checksum: number // 校验和
  indices: number[] // 参与 XOR 的原始块索引
  data: Uint8Array // 编码后的数据
}

export interface EncoderOptions {
  sliceSize?: number // 分片大小（默认 1000 字节）
  compress?: boolean // 是否压缩（默认 true）
}

/**
 * 计算校验和
 */
function getChecksum(data: Uint8Array, k: number): number {
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data[i]
    hash = hash & hash
  }
  return (hash ^ k) >>> 0
}

/**
 * 将数据分片
 */
function sliceData(data: Uint8Array, blockSize: number): Uint8Array[] {
  const blocks: Uint8Array[] = []
  for (let i = 0; i < data.length; i += blockSize) {
    const block = new Uint8Array(blockSize)
    block.set(data.slice(i, i + blockSize))
    blocks.push(block)
  }
  return blocks
}

/**
 * XOR 两个 Uint8Array
 */
function xorUint8Array(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length)
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i]! ^ b[i]!
  }
  return result
}

/**
 * 使用理想孤波分布（Ideal Soliton Distribution）获取随机度
 */
function getRandomDegree(k: number): number {
  const probabilities: number[] = Array.from({ length: k }, () => 0)

  // 计算理想孤波分布的概率
  probabilities[0] = 1 / k // P(1) = 1/k
  for (let d = 2; d <= k; d++) {
    probabilities[d - 1] = 1 / (d * (d - 1))
  }

  // 累积概率
  const cumulativeProbabilities: number[] = probabilities.reduce((acc, p, index) => {
    acc.push(p + (acc[index - 1] || 0))
    return acc
  }, [] as number[])

  // 生成随机数并选择对应的度
  const randomValue = Math.random()
  for (let i = 0; i < cumulativeProbabilities.length; i++) {
    if (randomValue < cumulativeProbabilities[i]!) {
      return i + 1
    }
  }

  return k
}

/**
 * 随机选择指定数量的索引
 */
function getRandomIndices(k: number, degree: number): number[] {
  const indices: Set<number> = new Set()
  while (indices.size < degree) {
    const randomIndex = Math.floor(Math.random() * k)
    indices.add(randomIndex)
  }
  return Array.from(indices)
}

/**
 * 创建 LT 编码器
 */
export class LtEncoder {
  public readonly k: number
  public readonly indices: Uint8Array[]
  public readonly checksum: number
  public readonly bytes: number
  public readonly compressed: Uint8Array

  constructor(
    public readonly data: Uint8Array,
    public readonly sliceSize: number,
    public readonly compress: boolean = true,
  ) {
    this.compressed = compress ? deflate(data, { level: 9 }) : data
    this.indices = sliceData(this.compressed, sliceSize)
    this.k = this.indices.length
    this.checksum = getChecksum(this.data, this.k)
    this.bytes = this.compressed.length
  }

  /**
   * 创建编码块
   */
  createBlock(indices?: number[]): EncodedBlock {
    const selectedIndices = indices || getRandomIndices(this.k, getRandomDegree(this.k))
    const data = new Uint8Array(this.sliceSize)
    
    for (const index of selectedIndices) {
      const indicesIndex = this.indices[index]!
      for (let i = 0; i < this.sliceSize; i++) {
        data[i] = data[i]! ^ indicesIndex[i]!
      }
    }

    return {
      k: this.k,
      bytes: this.bytes,
      checksum: this.checksum,
      indices: selectedIndices,
      data,
    }
  }

  /**
   * 喷泉模式 - 无限生成编码块
   */
  *fountain(): Generator<EncodedBlock, never> {
    while (true) {
      yield this.createBlock()
    }
  }
}

/**
 * 创建编码器实例
 */
export function createEncoder(data: Uint8Array | string, options: EncoderOptions = {}) {
  const { sliceSize = 1000, compress = true } = options
  const uint8Data = typeof data === 'string' ? new TextEncoder().encode(data) : data
  return new LtEncoder(uint8Data, sliceSize, compress)
}

/**
 * 将编码块转换为二进制字符串（用于二维码）
 * 格式：[k(2 字节)][bytes(4 字节)][checksum(4 字节)][indices 数量 (1 字节)][indices...][data...]
 */
export function blockToBinary(block: EncodedBlock): Uint8Array {
  // 元数据：k(2) + bytes(4) + checksum(4) + indicesCount(1) + indices + data
  const metadataSize = 11 + block.indices.length
  const result = new Uint8Array(metadataSize + block.data.length)
  const view = new DataView(result.buffer)
  
  let offset = 0
  
  // 写入 k (2 字节，big-endian)
  view.setUint16(offset, block.k, false)
  offset += 2
  
  // 写入 bytes (4 字节，big-endian)
  view.setUint32(offset, block.bytes, false)
  offset += 4
  
  // 写入 checksum (4 字节，big-endian)
  view.setUint32(offset, block.checksum, false)
  offset += 4
  
  // 写入 indices 数量 (1 字节)
  result[offset] = block.indices.length
  offset += 1
  
  // 写入 indices
  for (let i = 0; i < block.indices.length; i++) {
    result[offset + i] = block.indices[i]!
  }
  offset += block.indices.length
  
  // 写入 data
  result.set(block.data, offset)
  
  return result
}

/**
 * 从二进制字符串解码编码块
 */
export function binaryToBlock(binary: Uint8Array): EncodedBlock {
  const view = new DataView(binary.buffer)
  
  let offset = 0
  
  // 读取 k (2 字节)
  const k = view.getUint16(offset, false)
  offset += 2
  
  // 读取 bytes (4 字节)
  const bytes = view.getUint32(offset, false)
  offset += 4
  
  // 读取 checksum (4 字节)
  const checksum = view.getUint32(offset, false)
  offset += 4
  
  // 读取 indices 数量 (1 字节)
  const indicesCount = binary[offset]!
  offset += 1
  
  // 读取 indices
  const indices: number[] = []
  for (let i = 0; i < indicesCount; i++) {
    indices.push(binary[offset + i]!)
  }
  offset += indicesCount
  
  // 读取 data
  const data = binary.slice(offset)
  
  return {
    k,
    bytes,
    checksum,
    indices,
    data,
  }
}

/**
 * 将二进制数据转换为 Base64 字符串
 */
export function toBase64(data: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < data.byteLength; i++) {
    binary += String.fromCharCode(data[i]!)
  }
  return typeof window !== 'undefined' && window.btoa
    ? window.btoa(binary)
    : Buffer.from(binary).toString('base64')
}

/**
 * 从 Base64 字符串解码
 */
export function fromBase64(base64: string): Uint8Array {
  const binary = typeof window !== 'undefined' && window.atob
    ? window.atob(base64)
    : Buffer.from(base64, 'base64').toString('binary')
  
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
