/**
 * 文件传输发送端 - 基于喷泉码的文件二维码传输
 * 参考 Qrs 项目实现
 */

'use client'

import { useState, useRef, useCallback } from 'react'
import { useQrFountain } from '@/hooks/useQrFountain'
import QrCodeDisplay from '@/components/QrCodeDisplay'

export default function FileTransferSendPage() {
  const [file, setFile] = useState<File | null>(null)
  const [fileData, setFileData] = useState<Uint8Array | null>(null)
  const [sliceSize, setSliceSize] = useState(1000)
  const [fps, setFps] = useState(20)
  const [isPrefixed, setIsPrefixed] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 处理文件选择
  const handleFileChange = useCallback(async (selectedFile?: File) => {
    if (!selectedFile) {
      setFile(null)
      setFileData(null)
      return
    }

    try {
      const buffer = await selectedFile.arrayBuffer()
      const uint8Data = new Uint8Array(buffer)
      
      // 添加文件元数据（文件名、类型）
      const meta = {
        filename: selectedFile.name,
        contentType: selectedFile.type || 'application/octet-stream',
        size: selectedFile.size,
        lastModified: selectedFile.lastModified,
      }
      
      const metaJson = JSON.stringify(meta)
      const metaBytes = new TextEncoder().encode(metaJson)
      
      // 合并元数据和文件数据 [metaLength(4)][meta][data]
      const header = new Uint8Array(4)
      const view = new DataView(header.buffer)
      view.setUint32(0, metaBytes.length, false)
      
      const combinedData = new Uint8Array(header.length + metaBytes.length + uint8Data.length)
      combinedData.set(header, 0)
      combinedData.set(metaBytes, header.length)
      combinedData.set(uint8Data, header.length + metaBytes.length)
      
      setFile(selectedFile)
      setFileData(combinedData)
    } catch (e) {
      console.error('读取文件失败:', e)
      alert('读取文件失败：' + (e as Error).message)
    }
  }, [])

  // 使用喷泉码生成二维码
  const {
    qrData,
    block,
    count,
    fps: actualFps,
    bitrate,
    totalBytes,
    isReady,
    error,
  } = useQrFountain({
    data: fileData || new Uint8Array(),
    sliceSize,
    compress: true,
    fps,
  })

  // 计算预估二维码数量
  const estimatedQrCount = fileData ? Math.ceil(fileData.length / sliceSize) : 0
  const estimatedTime = estimatedQrCount > 0 ? Math.ceil(estimatedQrCount / fps) : 0

  // 获取当前 URL 前缀
  const prefix = isPrefixed 
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/file-transfer/receive#`
    : ''

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* 头部 */}
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            📦 离线文件传输 - 发送端
          </h1>
          <p className="text-gray-600">
            选择文件 → 生成二维码序列 → 接收端连续扫码 → 重组文件
          </p>
        </header>

        {/* 文件选择区域 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => handleFileChange(e.target.files?.[0])}
              className="hidden"
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
            >
              <span>📁</span>
              <span>{file ? '更换文件' : '选择文件'}</span>
            </button>

            {file && (
              <div className="flex-1 bg-gray-50 rounded-lg p-3">
                <p className="font-medium text-gray-800 truncate">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {(file.size / 1024).toFixed(2)} KB · {file.type || '未知类型'}
                </p>
              </div>
            )}
          </div>

          {/* 配置选项 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                分片大小 (Slice Size)
              </label>
              <input
                type="number"
                value={sliceSize}
                onChange={(e) => setSliceSize(parseInt(e.target.value) || 1000)}
                min="100"
                max="2000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">推荐：1000-1500</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                目标 FPS
              </label>
              <input
                type="range"
                value={fps}
                onChange={(e) => setFps(parseInt(e.target.value))}
                min="1"
                max="60"
                className="w-full"
              />
              <p className="text-sm text-gray-600 mt-1">{fps} FPS</p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <input
                  type="checkbox"
                  checked={isPrefixed}
                  onChange={(e) => setIsPrefixed(e.target.checked)}
                  className="rounded"
                />
                添加 Scanner URL 前缀
              </label>
              <p className="text-xs text-gray-500">
                扫码后自动跳转到接收页面
              </p>
            </div>
          </div>
        </div>

        {/* 文件信息统计 */}
        {fileData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-lg p-4 text-center">
              <p className="text-sm text-gray-500">文件大小</p>
              <p className="text-2xl font-bold text-purple-600">
                {(fileData.length / 1024).toFixed(2)} KB
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-4 text-center">
              <p className="text-sm text-gray-500">预估二维码数</p>
              <p className="text-2xl font-bold text-blue-600">
                ~{estimatedQrCount} 个
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-4 text-center">
              <p className="text-sm text-gray-500">预估传输时间</p>
              <p className="text-2xl font-bold text-green-600">
                ~{Math.floor(estimatedTime / 60)}:{String(estimatedTime % 60).padStart(2, '0')}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-4 text-center">
              <p className="text-sm text-gray-500">实时比特率</p>
              <p className="text-2xl font-bold text-orange-600">
                {bitrate.toFixed(1)} Kbps
              </p>
            </div>
          </div>
        )}

        {/* 二维码显示区域 */}
        {fileData && isReady && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              📱 扫描二维码传输文件
            </h2>

            {/* 实时状态 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-500">已生成帧数</p>
                <p className="text-2xl font-bold text-blue-600">{count}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">实时 FPS</p>
                <p className="text-2xl font-bold text-green-600">{actualFps.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">分片大小</p>
                <p className="text-2xl font-bold text-purple-600">{sliceSize}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">总块数 (k)</p>
                <p className="text-2xl font-bold text-orange-600">{block?.k || 0}</p>
              </div>
            </div>

            {/* 二维码 */}
            {qrData && (
              <div className="flex justify-center mb-6">
                <QrCodeDisplay
                  data={qrData}
                  size={Math.min(400, window.innerWidth - 48)}
                  border={4}
                />
              </div>
            )}

            {/* 使用说明 */}
            <div className="bg-purple-50 rounded-lg p-4">
              <h3 className="font-semibold text-purple-800 mb-2">📖 使用说明</h3>
              <ol className="text-sm text-purple-700 space-y-1 list-decimal list-inside">
                <li>保持手机屏幕常亮，二维码会自动刷新</li>
                <li>接收端使用摄像头连续扫描</li>
                <li>喷泉码特性：无需按顺序，任意帧都可解码</li>
                <li>接收端进度达到 100% 后自动重组文件</li>
                <li>建议扫描速度：{fps} FPS，预计时间：~{Math.floor(estimatedTime / 60)}分{estimatedTime % 60}秒</li>
              </ol>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">❌ 错误：{error.message}</p>
              </div>
            )}
          </div>
        )}

        {/* 空状态提示 */}
        {!fileData && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              选择文件开始传输
            </h3>
            <p className="text-gray-600 mb-6">
              支持任意文件类型：图片、文档、音频、视频等
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-8 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition"
            >
              📁 选择文件
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
