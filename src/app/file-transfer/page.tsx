/**
 * 文件传输首页 - 功能介绍与入口
 */

'use client'

import Link from 'next/link'

export default function FileTransferPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* 头部 */}
        <header className="text-center mb-12">
          <div className="text-6xl mb-4">📦</div>
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            离线文件传输
          </h1>
          <p className="text-xl text-gray-600">
            支持任意文件类型，通过二维码序列传输
          </p>
        </header>

        {/* 功能卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* 发送端 */}
          <Link href="/file-transfer/send" className="block">
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-8 text-white shadow-xl hover:shadow-2xl transition transform hover:scale-105">
              <div className="text-5xl mb-4">📤</div>
              <h2 className="text-2xl font-bold mb-3">发送文件</h2>
              <ul className="space-y-2 text-purple-100">
                <li className="flex items-center gap-2">
                  <span>✓</span>
                  <span>支持任意文件格式</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>✓</span>
                  <span>自动分片编码</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>✓</span>
                  <span>实时体积计算</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>✓</span>
                  <span>喷泉码无限生成</span>
                </li>
              </ul>
            </div>
          </Link>

          {/* 接收端 */}
          <Link href="/file-transfer/receive" className="block">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-8 text-white shadow-xl hover:shadow-2xl transition transform hover:scale-105">
              <div className="text-5xl mb-4">📥</div>
              <h2 className="text-2xl font-bold mb-3">接收文件</h2>
              <ul className="space-y-2 text-blue-100">
                <li className="flex items-center gap-2">
                  <span>✓</span>
                  <span>连续扫码传输</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>✓</span>
                  <span>自动重组文件</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>✓</span>
                  <span>CRC32 校验保护</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>✓</span>
                  <span>一键下载保存</span>
                </li>
              </ul>
            </div>
          </Link>
        </div>

        {/* 核心特性 */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            核心特性
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-3">🔒</div>
              <h3 className="font-semibold text-gray-800 mb-2">完全离线</h3>
              <p className="text-sm text-gray-600">
                无需网络连接，数据通过二维码安全传输
              </p>
            </div>
            
            <div className="text-center">
              <div className="text-4xl mb-3">📊</div>
              <h3 className="font-semibold text-gray-800 mb-2">高效压缩</h3>
              <p className="text-sm text-gray-600">
                LZ 压缩 + 喷泉码编码，75%+ 压缩率
              </p>
            </div>
            
            <div className="text-center">
              <div className="text-4xl mb-3">⚡</div>
              <h3 className="font-semibold text-gray-800 mb-2">实时反馈</h3>
              <p className="text-sm text-gray-600">
                体积计算、容量预警、传输进度实时显示
              </p>
            </div>
          </div>
        </div>

        {/* 容量说明 */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            📏 二维码容量说明
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-4 h-4 rounded-full bg-green-500"></div>
              <span className="text-gray-700 font-medium">安全</span>
              <span className="text-gray-500">&lt; 1500 字符</span>
              <span className="text-gray-600 flex-1">二维码清晰，秒扫</span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
              <span className="text-gray-700 font-medium">警告</span>
              <span className="text-gray-500">1500 ~ 2200 字符</span>
              <span className="text-gray-600 flex-1">二维码较密，仍可扫</span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-4 h-4 rounded-full bg-red-500"></div>
              <span className="text-gray-700 font-medium">超限</span>
              <span className="text-gray-500">&gt; 2200 字符</span>
              <span className="text-gray-600 flex-1">可能生成失败或无法识别</span>
            </div>
          </div>
        </div>

        {/* 使用场景 */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-xl p-8 text-white">
          <h2 className="text-2xl font-bold mb-6">🎯 使用场景</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🏥</span>
              <div>
                <h3 className="font-semibold mb-1">医疗影像离线传输</h3>
                <p className="text-sm text-indigo-100">X 光片、CT 等影像文件安全传输</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">📄</span>
              <div>
                <h3 className="font-semibold mb-1">文档资料交接</h3>
                <p className="text-sm text-indigo-100">PDF、Word、Excel 等文档传输</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">🎵</span>
              <div>
                <h3 className="font-semibold mb-1">音频视频文件</h3>
                <p className="text-sm text-indigo-100">多媒体文件离线传输</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">🔒</span>
              <div>
                <h3 className="font-semibold mb-1">敏感数据安全传输</h3>
                <p className="text-sm text-indigo-100">不经过网络，物理隔离传输</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
