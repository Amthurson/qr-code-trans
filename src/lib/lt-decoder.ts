/**
 * Luby Transform 解码器 - 基于 Qrs 项目实现
 * 使用喷泉码（Fountain Codes）实现二维码流式数据接收
 */

import { inflate } from 'pako'
import type { EncodedBlock } from './lt-encoder'

/**
 * 计算校验和（与编码器保持一致）
 */
function getChecksum(data: Uint8Array, k: number): number {
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data[i]
    hash = hash & hash
  }
  return hash ^ k
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
 * 将索引数组转换为键
 */
function indicesToKey(indices: number[]): string {
  return indices.sort((a, b) => a - b).join(',')
}

/**
 * LT 解码器类
 */
export class LtDecoder {
  public decodedData: (Uint8Array | undefined)[] = []
  public decodedCount = 0
  public encodedCount = 0
  public encodedBlocks: Set<EncodedBlock> = new Set()
  public encodedBlockKeyMap: Map<string, EncodedBlock> = new Map()
  public encodedBlockSubkeyMap: Map<string, Set<EncodedBlock>> = new Map()
  public encodedBlockIndexMap: Map<number, Set<EncodedBlock>> = new Map()
  public disposedEncodedBlocks: Map<number, (() => void)[]> = new Map()
  public meta: EncodedBlock = undefined!

  constructor(blocks?: EncodedBlock[]) {
    if (blocks) {
      for (const block of blocks) {
        this.addBlock(block)
      }
    }
  }

  /**
   * 添加编码块并尝试解码
   */
  addBlock(block: EncodedBlock): boolean {
    if (!this.meta) {
      this.meta = block
      this.decodedData = Array.from({ length: this.meta.k })
    }

    if (block.checksum !== this.meta.checksum) {
      throw new Error('添加的块校验和不匹配')
    }
    
    this.encodedCount += 1
    this.propagateDecoded(indicesToKey(block.indices), block)

    return this.decodedCount === this.meta.k
  }

  /**
   * 传播解码
   */
  propagateDecoded(key: string, block: EncodedBlock) {
    const { decodedData, encodedBlocks, encodedBlockIndexMap, encodedBlockKeyMap, encodedBlockSubkeyMap, disposedEncodedBlocks } = this

    let index: number
    let blocks: Set<EncodedBlock> | undefined

    let { data, indices } = block
    const indicesSet = new Set(indices)

    let subblock: EncodedBlock | undefined
    let subIndicesSet: Set<number>

    // 如果已经处理过这个块，或者所有索引都已解码，跳过
    if (encodedBlockKeyMap.has(key) || indices.every(i => decodedData[i] != null)) {
      return
    }

    // 如果度 > 1，尝试用已解码的块来简化
    if (indices.length > 1) {
      for (const index of indices) {
        if (decodedData[index] != null) {
          block.data = data = xorUint8Array(data, decodedData[index]!)
          indicesSet.delete(index)
        }
      }
      if (indicesSet.size !== indices.length) {
        block.indices = indices = Array.from(indicesSet)
      }
    }

    // 尝试用子块来解码（度 > 2）
    if (indices.length > 2) {
      const subkeys: [index: number, subkey: string][] = []
      for (const index of indices) {
        const subkey = indicesToKey(indices.filter(i => i !== index))
        if (subblock = encodedBlockKeyMap.get(subkey)) {
          block.data = data = xorUint8Array(data, subblock.data)
          subIndicesSet = new Set(subblock.indices)
          for (const i of subIndicesSet) {
            indicesSet.delete(i)
          }
          block.indices = indices = Array.from(indicesSet)
          break
        } else {
          subkeys.push([index, subkey])
        }
      }

      // 如果找不到子块，存储子键供未来解码使用
      if (indicesSet.size > 1) {
        subkeys.forEach(([index, subkey]) => {
          const dispose = () => encodedBlockSubkeyMap.get(subkey)?.delete(block)
          encodedBlockSubkeyMap.get(subkey)?.add(block) ?? encodedBlockSubkeyMap.set(subkey, new Set([block]))
          disposedEncodedBlocks.get(index)?.push(dispose) ?? disposedEncodedBlocks.set(index, [dispose])
        })
      }
    }

    // 如果度 > 1，存储为待解码块
    if (indices.length > 1) {
      block.indices.forEach((i) => {
        encodedBlocks.add(block)
        encodedBlockIndexMap.get(i)?.add(block) ?? encodedBlockIndexMap.set(i, new Set([block]))
      })

      encodedBlockKeyMap.set(key = indicesToKey(indices), block)

      // 使用超集解码
      const superset = encodedBlockSubkeyMap.get(key)
      if (superset) {
        encodedBlockSubkeyMap.delete(key)
        for (const superblock of superset) {
          const superIndicesSet = new Set(superblock.indices)
          superblock.data = xorUint8Array(superblock.data, data)
          for (const i of indices) {
            superIndicesSet.delete(i)
          }
          superblock.indices = Array.from(superIndicesSet)
          this.propagateDecoded(indicesToKey(superblock.indices), superblock)
        }
      }
    }
    // 如果度 = 1，存储到解码数据并查找可解码的块
    else if (decodedData[index = indices[0]!] == null) {
      encodedBlocks.delete(block)
      disposedEncodedBlocks.get(index)?.forEach(dispose => dispose())
      decodedData[index] = block.data
      this.decodedCount += 1

      if (blocks = encodedBlockIndexMap.get(index)) {
        encodedBlockIndexMap.delete(index)
        for (const block of blocks) {
          key = indicesToKey(block.indices)
          encodedBlockKeyMap.delete(key)
          this.propagateDecoded(key, block)
        }
      }
    }
  }

  /**
   * 获取解码后的数据
   */
  getDecoded(compress = true): Uint8Array | undefined {
    if (this.decodedCount !== this.meta.k) {
      return undefined
    }
    if (this.decodedData.some(block => block == null)) {
      return undefined
    }

    const sliceSize = this.meta.data.length
    const blocks = this.decodedData as Uint8Array[]
    const decodedData = new Uint8Array(this.meta.bytes)

    blocks.forEach((block, i) => {
      const start = i * sliceSize
      if (start + sliceSize > decodedData.length) {
        for (let j = 0; j < decodedData.length - start; j++) {
          decodedData[start + j] = block[j]!
        }
      } else {
        decodedData.set(block, i * sliceSize)
      }
    })

    try {
      // 尝试解压缩
      if (compress) {
        const decompressed = inflate(decodedData)
        const checksum = getChecksum(decompressed, this.meta.k)
        if (checksum === this.meta.checksum) {
          return decompressed
        }
      } else {
        const checksum = getChecksum(decodedData, this.meta.k)
        if (checksum === this.meta.checksum) {
          return decodedData
        }
      }
    } catch {
      // 解压缩失败，尝试直接使用
      const checksum = getChecksum(decodedData, this.meta.k)
      if (checksum === this.meta.checksum) {
        return decodedData
      }
    }

    throw new Error('校验和不匹配，数据可能已损坏')
  }

  /**
   * 获取解码进度
   */
  getProgress(): {
    total: number
    decoded: number
    encoded: number
    percent: number
  } {
    return {
      total: this.meta.k || 0,
      decoded: this.decodedCount,
      encoded: this.encodedCount,
      percent: this.meta.k ? Math.round((this.decodedCount / this.meta.k) * 100) : 0,
    }
  }

  /**
   * 重置解码器
   */
  reset() {
    this.decodedData = []
    this.decodedCount = 0
    this.encodedCount = 0
    this.encodedBlocks.clear()
    this.encodedBlockKeyMap.clear()
    this.encodedBlockSubkeyMap.clear()
    this.encodedBlockIndexMap.clear()
    this.disposedEncodedBlocks.clear()
    this.meta = undefined!
  }
}

/**
 * 创建解码器实例
 */
export function createDecoder(blocks?: EncodedBlock[]) {
  return new LtDecoder(blocks)
}
