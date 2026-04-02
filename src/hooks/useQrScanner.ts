/**
 * 使用摄像头扫描二维码并解码 LT 数据
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import QrScanner from 'qr-scanner'
import { createDecoder, type LtDecoder } from '../lib/lt-decoder'
import { binaryToBlock, fromBase64 } from '../lib/lt-encoder'
import { extractPatientBundleFrame } from '../lib/offline-questionnaire'

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
  lastDetectedAt: number
  startScan: () => void
  stopScan: () => void
  ingestCode: (value: string) => void
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
  const [lastDetectedAt, setLastDetectedAt] = useState(0)
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
          highlightCodeOutline: false,
          highlightScanRegion: false,
          preferredCamera: 'environment', // 使用后置摄像头
          calculateScanRegion: (video) => {
            const width = video.videoWidth || video.clientWidth || 1280
            const height = video.videoHeight || video.clientHeight || 720
            const maxSide = 960
            const scale = Math.min(1, maxSide / Math.max(width, height))
            return {
              x: 0,
              y: 0,
              width,
              height,
              downScaledWidth: Math.max(320, Math.round(width * scale)),
              downScaledHeight: Math.max(320, Math.round(height * scale)),
            }
          },
          returnDetailedScanResult: true,
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
    setLastDetectedAt(0)
    processedCodesRef.current.clear()
  }, [stopScan])

  // 处理二维码数据
  const processQrCode = useCallback((qrData: string) => {
    if (!decoderRef.current || !qrData) {
      return
    }

    try {
      const wrappedFrame = extractPatientBundleFrame(qrData)
      const normalizedData = wrappedFrame ? wrappedFrame.frame : qrData
      if (processedCodesRef.current.has(normalizedData)) return
      processedCodesRef.current.add(normalizedData)
      setLastDetectedAt(Date.now())

      // 解码 Base64
      const binary = fromBase64(normalizedData)
      
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
      const scanError = e instanceof Error ? e : new Error('二维码处理失败')
      setError(scanError)
      onError?.(scanError)
    }
  }, [onDecoded, stopScan])

  const ingestCode = useCallback((value: string) => {
    processQrCode(value)
  }, [processQrCode])

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
    lastDetectedAt,
    startScan,
    stopScan,
    ingestCode,
    reset,
  }
}
