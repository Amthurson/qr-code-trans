/**
 * 文件传输接收端 - 扫码接收并重组文件
 * 基于喷泉码实现
 */

'use client'

import { useState, useRef, useCallback } from 'react'
import { useQrScanner } from '@/hooks/useQrScanner'
import { binaryToBlock, fromBase64 } from '@/lib/lt-encoder'
import { createDecoder, type LtDecoder } from '@/lib/lt-decoder'

interface FileMeta {
  filename: string
  contentType: string
  size: number
  lastModified: number
}

export default function FileTransferReceivePage() {
  const [manualInput, setManualInput] = useState('')
  const [fileMeta, setFileMeta] = useState<FileMeta | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [inputMode, setInputMode] = useState<'camera' | 'manual'>('camera')
  
  const decoderRef = useRef<LtDecoder | null>(null)
  const processedCodesRef = useRef<Set<string>>(new Set())
  const metaExtractedRef = useRef(false)

  const {
    videoRef,
    isScanning,
    progress,
    decodedData,
    error,
    startScan,
    stopScan,
    reset,
  } = useQrScanner({
    onDecoded: handleDecoded,
    maxScansPerSecond: 30,
  })

  // 初始化解码器
  if (!decoderRef.current) {
    decoderRef.current = createDecoder()
  }

  // 处理解码完成
  const handleDecoded = useCallback((data: Uint8Array) => {
    try {
      // 提取元数据 [metaLength(4)][meta][fileData]
      const view = new DataView(data.buffer)
      const metaLength = view.getUint32(0, false)
      
      const metaBytes = data.slice(4, 4 + metaLength)
      const metaJson = new TextDecoder().decode(metaBytes)
      const meta: FileMeta = JSON.parse(metaJson)
      
      setFileMeta(meta)
      
      // 提取文件数据
      const fileData = data.slice(4 + metaLength)
      
      // 创建下载链接
      const blob = new Blob([fileData], { type: meta.contentType })
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)
      setIsComplete(true)
    } catch (e) {
      console.error('解析文件失败:', e)
    }
  }, [])

  // 处理手动输入
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualInput.trim() || !decoderRef.current) return

    try {
      const binary = fromBase64(manualInput.trim())
      const block = binaryToBlock(binary)
      
      const isDone = decoderRef.current.addBlock(block)
      const prog = decoderRef.current.getProgress()
      
      // 更新进度（通过自定义事件或状态）
      if (isDone && !metaExtractedRef.current) {
        const decoded = decoderRef.current.getDecoded()
        if (decoded) {
          handleDecoded(decoded)
          metaExtractedRef.current = true
        }
      }
    } catch (e) {
      alert('输入格式错误：' + (e as Error).message)
    }
  }

  // 重置
  const handleReset = () => {
    reset()
    decoderRef.current?.reset()
    setFileMeta(null)
    setIsComplete(false)
    setDownloadUrl(null)
    setManualInput('')
    processedCodesRef.current.clear()
    metaExtractedRef.current = false
  }

  // 下载文件
  const handleDownload = () => {
    if (!downloadUrl || !fileMeta) return
    
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = fileMeta.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* 头部 */}
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            📥 离线文件传输 - 接收端
          </h1>
          <p className="text-gray-600">
            使用摄像头扫描发送端的二维码序列，自动重组文件
          </p>
        </header>

        {/* 模式切换 */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setInputMode('camera')}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition ${
              inputMode === 'camera'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📷 摄像头扫描
          </button>
          <button
            onClick={() => setInputMode('manual')}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition ${
              inputMode === 'manual'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ⌨️ 手动输入
          </button>
        </div>

        {/* 摄像头扫描模式 */}
        {inputMode === 'camera' && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                摄像头扫描
              </h2>
              <div className="flex gap-2">
                {!isScanning && !isComplete && (
                  <button
                    onClick={startScan}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    开始扫描
                  </button>
                )}
                {isScanning && (
                  <button
                    onClick={stopScan}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
                  >
                    暂停
                  </button>
                )}
                {(isComplete || error) && (
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                  >
                    重新开始
                  </button>
                )}
              </div>
            </div>

            {/* 视频区域 */}
            <div className="relative bg-black rounded-lg overflow-hidden mb-4 aspect-video">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              {!isScanning && !isComplete && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                  <p className="text-white text-lg">
                    点击"开始扫描"启动摄像头
                  </p>
                </div>
              )}
              {isComplete && (
                <div className="absolute inset-0 flex items-center justify-center bg-green-600 bg-opacity-80">
                  <div className="text-center text-white">
                    <p className="text-2xl font-bold mb-2">✅ 文件接收完成！</p>
                    {fileMeta && (
                      <p className="text-sm">{fileMeta.filename}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 进度显示 */}
            {isScanning && (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>解码进度</span>
                    <span>{progress.percent}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-gray-500">总块数</p>
                    <p className="text-lg font-bold">{progress.total}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">已解码</p>
                    <p className="text-lg font-bold text-green-600">{progress.decoded}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">已接收</p>
                    <p className="text-lg font-bold text-blue-600">{progress.encoded}</p>
                  </div>
                </div>

                <p className="text-sm text-gray-600 text-center">
                  💡 喷泉码特性：无需按顺序扫描，任意帧都可解码
                </p>
              </div>
            )}

            {/* 错误提示 */}
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">❌ 错误：{error.message}</p>
              </div>
            )}
          </div>
        )}

        {/* 手动输入模式 */}
        {inputMode === 'manual' && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              手动输入编码数据
            </h2>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Base64 编码数据
                </label>
                <textarea
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="粘贴 Base64 编码的二维码数据..."
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={!manualInput.trim()}
                className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                解析数据
              </button>
            </form>
          </div>
        )}

        {/* 文件信息 */}
        {fileMeta && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              📄 文件信息
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-500">文件名</p>
                <p className="font-medium text-gray-800 truncate">{fileMeta.filename}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">文件类型</p>
                <p className="font-medium text-gray-800">{fileMeta.contentType}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">文件大小</p>
                <p className="font-medium text-gray-800">
                  {(fileMeta.size / 1024).toFixed(2)} KB
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">修改时间</p>
                <p className="font-medium text-gray-800">
                  {new Date(fileMeta.lastModified).toLocaleString()}
                </p>
              </div>
            </div>

            {/* 下载按钮 */}
            {downloadUrl && (
              <button
                onClick={handleDownload}
                className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2"
              >
                <span>⬇️</span>
                <span>下载文件</span>
              </button>
            )}
          </div>
        )}

        {/* 使用说明 */}
        <div className="bg-blue-50 rounded-xl p-6">
          <h3 className="font-semibold text-blue-800 mb-3">📖 使用说明</h3>
          <ol className="text-sm text-blue-700 space-y-2 list-decimal list-inside">
            <li>打开发送端页面，选择要传输的文件</li>
            <li>发送端会生成连续的二维码序列</li>
            <li>接收端使用摄像头对准发送端屏幕</li>
            <li>自动扫描并重组文件，进度达到 100% 完成</li>
            <li>点击"下载文件"保存接收的文件</li>
          </ol>
          <div className="mt-4 p-4 bg-white rounded-lg">
            <p className="text-xs text-blue-600">
              <strong>💡 提示：</strong>
              <br/>
              • 喷泉码特性：无需按顺序扫描，任意帧都可解码
              <br/>
              • 建议扫描速度：20-30 FPS
              <br/>
              • 传输时间取决于文件大小和扫描速度
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
