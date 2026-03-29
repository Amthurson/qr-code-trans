/**
 * 医院端 - 扫码解码喷泉码数据
 * 基于 Qrs 项目的 Luby Transform 实现
 */

'use client'

import { useState, useRef } from 'react'
import { useQrScanner } from '@/hooks/useQrScanner'
import { fromBase64, binaryToBlock } from '@/lib/lt-encoder'

export default function HospitalPage() {
  const [manualInput, setManualInput] = useState('')
  const [decodedResult, setDecodedResult] = useState<any | null>(null)
  const [inputMode, setInputMode] = useState<'camera' | 'manual'>('camera')
  
  const {
    videoRef,
    isScanning,
    progress,
    isComplete,
    decodedData,
    error,
    startScan,
    stopScan,
    reset,
  } = useQrScanner({
    onDecoded: (data) => {
      try {
        const text = new TextDecoder().decode(data)
        const result = JSON.parse(text)
        setDecodedResult(result)
      } catch (e) {
        console.error('解析失败:', e)
      }
    },
    maxScansPerSecond: 30,
  })

  // 处理手动输入
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualInput.trim()) return

    try {
      // 解析 Base64
      const binary = fromBase64(manualInput.trim())
      const block = binaryToBlock(binary)
      
      // 显示块信息
      setDecodedResult({
        k: block.k,
        bytes: block.bytes,
        checksum: block.checksum,
        indices: block.indices,
        message: '手动输入成功（需要集成完整解码逻辑）',
      })
    } catch (e) {
      alert('输入格式错误：' + (e as Error).message)
    }
  }

  // 重置
  const handleReset = () => {
    reset()
    setDecodedResult(null)
    setManualInput('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* 头部 */}
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            🏥 医院端 - 扫码解码
          </h1>
          <p className="text-gray-600">
            使用摄像头扫描患者提供的二维码序列，或手动输入编码数据
          </p>
        </header>

        {/* 模式切换 */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setInputMode('camera')}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition ${
              inputMode === 'camera'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📷 摄像头扫描
          </button>
          <button
            onClick={() => setInputMode('manual')}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition ${
              inputMode === 'manual'
                ? 'bg-green-600 text-white'
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
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
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
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
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
                  <p className="text-white text-2xl font-bold">
                    ✅ 解码完成！
                  </p>
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
                      className="bg-green-600 h-4 rounded-full transition-all duration-300"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={!manualInput.trim()}
                className="w-full px-4 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                解析数据
              </button>
            </form>
          </div>
        )}

        {/* 解码结果 */}
        {decodedResult && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              ✅ 解码结果
            </h2>

            <div className="bg-gray-50 rounded-lg p-4 overflow-auto max-h-96">
              <pre className="text-sm text-gray-800 font-mono whitespace-pre-wrap">
                {JSON.stringify(decodedResult, null, 2)}
              </pre>
            </div>

            {decodedResult.transport === 'offline-answer' && Array.isArray(decodedResult.answers) && (
              <div className="mt-6 space-y-4">
                <h3 className="font-semibold text-gray-800">
                  📋 回传答案摘要
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {decodedResult.answers.map((item: any, index: number) => (
                    <div key={`${item.templateId}-${item.questionId}-${index}`} className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">
                        {item.templateId} · 问题 {item.questionId}
                      </p>
                      <p className="text-sm font-medium text-gray-800">
                        {Array.isArray(item.value) ? item.value.join('、') : String(item.value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 患者信息摘要 */}
            {decodedResult.type === 'questionnaire' && decodedResult.answers && (
              <div className="mt-6 space-y-4">
                <h3 className="font-semibold text-gray-800">
                  📋 问卷答案摘要
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.entries(decodedResult.answers).map(([id, value]) => (
                    <div key={id} className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">问题 {id}</p>
                      <p className="text-sm font-medium text-gray-800">
                        {Array.isArray(value) ? value.join(', ') : String(value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
