/**
 * 使用 LT 编码器生成二维码流
 */

import { useState, useEffect, useRef } from 'react'
import { createEncoder, blockToBinary, toBase64, type LtEncoder } from '../lib/lt-encoder'
import type { EncodedBlock } from '../lib/lt-encoder'

interface UseQrFountainOptions {
  data: Uint8Array | string
  sliceSize?: number
  compress?: boolean
  fps?: number
}

interface UseQrFountainReturn {
  qrData: string | null // Base64 编码的二维码数据
  block: EncodedBlock | null
  count: number
  fps: number
  bitrate: number // Kbps
  totalBytes: number
  isReady: boolean
  error: Error | null
}

export function useQrFountain(options: UseQrFountainOptions): UseQrFountainReturn {
  const {
    data,
    sliceSize = 1000,
    compress = true,
    fps = 20,
  } = options

  const [qrData, setQrData] = useState<string | null>(null)
  const [block, setBlock] = useState<EncodedBlock | null>(null)
  const [count, setCount] = useState(0)
  const [renderTime, setRenderTime] = useState(0)
  const [error, setError] = useState<Error | null>(null)
  
  const encoderRef = useRef<LtEncoder | null>(null)
  const fountainIteratorRef = useRef<ReturnType<LtEncoder['fountain']> | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // 初始化编码器
  useEffect(() => {
    const uint8Data = typeof data === 'string'
      ? new TextEncoder().encode(data)
      : data;

    if (!uint8Data || uint8Data.length === 0) {
      encoderRef.current = null;
      fountainIteratorRef.current = null;
      setQrData(null);
      setBlock(null);
      setCount(0);
      setError(null);
      return;
    }

    try {
      encoderRef.current = createEncoder(uint8Data, { sliceSize, compress })
      fountainIteratorRef.current = encoderRef.current.fountain()
      setCount(0)
      setError(null)
    } catch (e) {
      setError(e as Error)
    }
  }, [data, sliceSize, compress])

  // 生成二维码流
  useEffect(() => {
    if (!encoderRef.current || !fountainIteratorRef.current) {
      return
    }

    const generateFrame = () => {
      const startTime = performance.now()
      
      try {
        const next = fountainIteratorRef.current!.next()
        const currentBlock = next.value
        
        if (currentBlock) {
          const binary = blockToBinary(currentBlock)
          const base64 = toBase64(binary)
          
          setQrData(base64)
          setBlock(currentBlock)
          setCount(prev => prev + 1)
          
          const endTime = performance.now()
          setRenderTime(endTime - startTime)
        }
      } catch (e) {
        setError(e as Error)
      }
    }

    // 初始生成一帧
    generateFrame()

    // 定时生成
    const interval = 1000 / fps
    intervalRef.current = setInterval(generateFrame, interval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [fps])

  // 计算比特率
  const bitrate = block 
    ? ((block.bytes / 1024) * (1000 / renderTime)).toFixed(2) 
    : 0

  const framePerSecond = renderTime > 0 ? (1000 / renderTime).toFixed(2) : 0

  return {
    qrData,
    block,
    count,
    fps: parseFloat(framePerSecond.toString()),
    bitrate: parseFloat(bitrate.toString()),
    totalBytes: block?.bytes || 0,
    isReady: !!encoderRef.current,
    error,
  }
}
