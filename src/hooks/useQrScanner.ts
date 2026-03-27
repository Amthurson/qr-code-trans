/**
 * 使用摄像头扫描二维码并解码 LT 数据
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import QrScanner from 'qr-scanner'
import { createDecoder, type LtDecoder } from '../lib/lt-decoder'
import type { EncodedBlock } from '../lib/lt-encoder'
import { binaryToBlock, fromBase64 } from '../lib/lt-encoder'

interface UseQrScannerOptions {
  onDecoded?: (data: Uint8Array) => void
  onError?: (error: Error) => void
  maxScansPerSecond?: number
}

interface UseQrScannerReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>
  isScanning: boolean
  progress: {
    total: number
    decoded: number
    encoded: number
    percent: number
  }
  isComplete: boolean
  decodedData: Uint8Array | null
  error: Error | null
  startScan: () => void
  stopScan: () => void
  reset: () => void
}

export function useQrScanner(options: UseQrScannerOptions = {}): UseQrScannerReturn {
  const {
    onDecoded,
    onError,
    maxScansPerSecond = 30,
  } = options

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [decodedData, setDecodedData] = useState<Uint8Array | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [progress, setProgress] = useState({
    total: 0,
    decoded: 0,
    encoded: 0,
    percent: 0,
  })

  const decoderRef = useRef<LtDecoder | null>(null)
  const qrScannerRef = useRef<QrScanner | null>(null)
  const processedCodesRef = useRef<Set<string>>(new Set())

  // 初始化解码器
  useEffect(() => {
    decoderRef.current = createDecoder()
    return () => {
      decoderRef.current = null
    }
  }, [])

  // 启动摄像头
  const startScan = useCallback(async () => {
    try {
      if (!videoRef.current) {
        throw new Error('video ref 未初始化')
      }

      setError(null)
      setIsComplete(false)
      setDecodedData(null)
      processedCodesRef.current.clear()

      // 创建 qr-scanner 实例
      qrScannerRef.current = new QrScanner(
        videoRef.current,
        async (result) => {
          try {
            await processQrCode(result.data)
          } catch (e) {
            console.error('处理二维码失败:', e)
          }
        },
        {
          maxScansPerSecond,
          highlightCodeOutline: true,
          highlightScanRegion: true,
          preferredCamera: 'environment', // 使用后置摄像头
        }
      )

      await qrScannerRef.current.start()
      setIsScanning(true)
    } catch (e) {
      const error = e as Error
      setError(error)
      onError?.(error)
    }
  }, [maxScansPerSecond, onError])

  // 停止摄像头
  const stopScan = useCallback(() => {
    setIsScanning(false)
    
    if (qrScannerRef.current) {
      qrScannerRef.current.stop()
      qrScannerRef.current.destroy()
      qrScannerRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  // 重置
  const reset = useCallback(() => {
    stopScan()
    decoderRef.current?.reset()
    setProgress({
      total: 0,
      decoded: 0,
      encoded: 0,
      percent: 0,
    })
    setDecodedData(null)
    setIsComplete(false)
    setError(null)
    processedCodesRef.current.clear()
  }, [stopScan])

  // 处理二维码数据
  const processQrCode = useCallback((qrData: string) => {
    if (!decoderRef.current || processedCodesRef.current.has(qrData)) {
      return
    }

    try {
      // 去重
      processedCodesRef.current.add(qrData)

      // 解码 Base64
      const binary = fromBase64(qrData)
      
      // 转换为编码块
      const block = binaryToBlock(binary)
      
      // 添加到解码器
      const isComplete = decoderRef.current.addBlock(block)
      
      // 更新进度
      const prog = decoderRef.current.getProgress()
      setProgress(prog)

      if (isComplete) {
        // 解码完成
        const decoded = decoderRef.current.getDecoded()
        if (decoded) {
          setDecodedData(decoded)
          setIsComplete(true)
          onDecoded?.(decoded)
          stopScan()
        }
      }
    } catch (e) {
      console.error('处理二维码失败:', e)
    }
  }, [onDecoded, stopScan])

  // 清理
  useEffect(() => {
    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.destroy()
      }
    }
  }, [])

  return {
    videoRef,
    isScanning,
    progress,
    isComplete,
    decodedData,
    error,
    startScan,
    stopScan,
    reset,
  }
}
