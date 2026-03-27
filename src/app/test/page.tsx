/**
 * 喷泉码测试页面
 * 测试 LT 编码解码功能
 */

'use client'

import { useState } from 'react'
import { createEncoder, blockToBinary, toBase64, fromBase64, binaryToBlock } from '@/lib/lt-encoder'
import { createDecoder } from '@/lib/lt-decoder'
import QrCodeDisplay from '@/components/QrCodeDisplay'

export default function TestPage() {
  const [testData, setTestData] = useState('Hello, Fountain Codes! 这是一个测试数据。')
  const [encodedCount, setEncodedCount] = useState(0)
  const [decodedText, setDecodedText] = useState('')
  const [progress, setProgress] = useState({ total: 0, decoded: 0, encoded: 0, percent: 0 })
  const [qrData, setQrData] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  // 测试编码
  const testEncode = () => {
    try {
      addLog('开始编码测试...')
      const data = new TextEncoder().encode(testData)
      const encoder = createEncoder(data, { sliceSize: 100, compress: true })
      
      addLog(`原始数据大小：${data.length} 字节`)
      addLog(`分片数量：${encoder.k}`)
      addLog(`压缩后大小：${encoder.bytes} 字节`)
      addLog(`压缩率：${Math.round((1 - encoder.bytes / data.length) * 100)}%`)

      // 生成几个编码块
      const blocks: any[] = []
      const iterator = encoder.fountain()
      
      for (let i = 0; i < 5; i++) {
        const block = iterator.next().value
        blocks.push(block)
        const binary = blockToBinary(block)
        const base64 = toBase64(binary)
        
        if (i === 0) {
          setQrData(base64)
        }
        
        addLog(`块 ${i}: indices=[${block.indices.join(',')}], data.length=${block.data.length}`)
      }
      
      setEncodedCount(blocks.length)
      addLog('编码测试完成！')
    } catch (e) {
      addLog(`编码失败：${(e as Error).message}`)
    }
  }

  // 测试解码
  const testDecode = () => {
    try {
      addLog('开始解码测试...')
      
      if (!qrData) {
        addLog('错误：没有二维码数据')
        return
      }

      const decoder = createDecoder()
      const encoder = createEncoder(new TextEncoder().encode(testData), { sliceSize: 100, compress: true })
      const iterator = encoder.fountain()

      let decoded: Uint8Array | undefined
      
      // 模拟接收编码块
      let count = 0
      const maxBlocks = encoder.k + 10 // 接收比原始块稍多的块
      
      while (!decoded && count < maxBlocks) {
        const block = iterator.next().value
        const binary = blockToBinary(block)
        const isComplete = decoder.addBlock(block)
        
        const prog = decoder.getProgress()
        setProgress(prog)
        addLog(`接收块 ${count}: 进度 ${prog.decoded}/${prog.total} (${prog.percent}%)`)
        
        if (isComplete) {
          decoded = decoder.getDecoded()
          addLog('解码完成！')
        }
        
        count++
      }

      if (decoded) {
        const text = new TextDecoder().decode(decoded)
        setDecodedText(text)
        addLog(`解码结果：${text}`)
        
        if (text === testData) {
          addLog('✅ 验证成功！数据完全匹配')
        } else {
          addLog('❌ 验证失败！数据不匹配')
        }
      } else {
        addLog('❌ 解码失败：未收到足够的块')
      }
    } catch (e) {
      addLog(`解码失败：${(e as Error).message}`)
    }
  }

  // 清空日志
  const clearLogs = () => {
    setLogs([])
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          🧪 喷泉码测试页面
        </h1>

        {/* 输入区域 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">测试数据</h2>
          <textarea
            value={testData}
            onChange={(e) => setTestData(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-4 mt-4">
            <button
              onClick={testEncode}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              测试编码
            </button>
            <button
              onClick={testDecode}
              disabled={!qrData}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              测试解码
            </button>
            <button
              onClick={clearLogs}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              清空日志
            </button>
          </div>
        </div>

        {/* 编码信息 */}
        {encodedCount > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">编码信息</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">已生成块数</p>
                <p className="text-2xl font-bold">{encodedCount}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">二维码数据</p>
                <p className="text-sm font-mono truncate">{qrData?.substring(0, 50)}...</p>
              </div>
            </div>
            
            {qrData && (
              <div className="mt-4 flex justify-center">
                <QrCodeDisplay data={qrData} size={200} border={4} />
              </div>
            )}
          </div>
        )}

        {/* 解码进度 */}
        {progress.total > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">解码进度</h2>
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>进度</span>
                <span>{progress.percent}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-green-600 h-4 rounded-full transition-all"
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
          </div>
        )}

        {/* 解码结果 */}
        {decodedText && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">✅ 解码结果</h2>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-green-800 font-mono">{decodedText}</p>
            </div>
          </div>
        )}

        {/* 日志 */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">日志</h2>
          <div className="bg-gray-900 rounded-lg p-4 h-64 overflow-y-auto font-mono text-sm text-green-400">
            {logs.length === 0 ? (
              <p className="text-gray-500">暂无日志</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="mb-1">{log}</div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
