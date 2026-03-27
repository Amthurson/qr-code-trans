'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            📋 离线问卷二维码传输系统
          </h1>
          <p className="text-xl text-gray-600">
            患者填写问卷 → 编码压缩 → 生成二维码 → 医院扫码 → 解码还原
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {/* 患者端入口 */}
          <Link 
            href="/patient"
            className="block p-6 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow border-2 border-transparent hover:border-blue-500"
          >
            <div className="text-5xl mb-3">👤</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              患者端
            </h2>
            <p className="text-sm text-gray-600 mb-3">
              填写问卷，生成二维码
            </p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>✓ 支持多种题型</li>
              <li>✓ 实时体积计算</li>
              <li>✓ 自动编码压缩</li>
            </ul>
          </Link>

          {/* 医院端入口 */}
          <Link 
            href="/hospital"
            className="block p-6 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow border-2 border-transparent hover:border-green-500"
          >
            <div className="text-5xl mb-3">🏥</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              医院端
            </h2>
            <p className="text-sm text-gray-600 mb-3">
              扫码解码，查看数据
            </p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>✓ 扫码或手动输入</li>
              <li>✓ 自动解码还原</li>
              <li>✓ 数据验证</li>
            </ul>
          </Link>

          {/* 问卷二维码入口 */}
          <Link 
            href="/share"
            className="block p-6 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow border-2 border-transparent hover:border-purple-500"
          >
            <div className="text-5xl mb-3">📱</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              问卷二维码
            </h2>
            <p className="text-sm text-gray-600 mb-3">
              生成链接，微信扫码
            </p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>✓ 生成问卷链接</li>
              <li>✓ 微信扫码填写</li>
              <li>✓ 分享功能</li>
            </ul>
          </Link>

          {/* 极限测试入口 */}
          <Link 
            href="/stress-test"
            className="block p-6 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow border-2 border-transparent hover:border-red-500"
          >
            <div className="text-5xl mb-3">🧪</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              极限测试
            </h2>
            <p className="text-sm text-gray-600 mb-3">
              40题容量压测
            </p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>✓ 40题全填满</li>
              <li>✓ 编码策略分析</li>
              <li>✓ 容量极限测试</li>
            </ul>
          </Link>
        </div>

        {/* 文件传输入口 */}
        <div className="mt-12">
          <Link 
            href="/file-transfer"
            className="block max-w-2xl mx-auto p-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 text-white"
          >
            <div className="text-5xl mb-4">📦</div>
            <h2 className="text-2xl font-bold mb-3">离线文件传输</h2>
            <p className="text-indigo-100 mb-4">
              支持任意文件类型，通过二维码序列传输
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm text-indigo-100">
              <div>✓ 任意文件格式</div>
              <div>✓ 自动分片编码</div>
              <div>✓ 连续扫码传输</div>
              <div>✓ CRC32 校验保护</div>
            </div>
          </Link>
        </div>
          >
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-2xl font-bold text-white mb-2">
              离线文件传输
            </h2>
            <p className="text-indigo-100">
              支持任意文件类型，通过二维码序列传输
            </p>
            <ul className="text-xs text-indigo-200 space-y-1 mt-3">
              <li>✓ 任意文件格式</li>
              <li>✓ 自动分片编码</li>
              <li>✓ 连续扫码传输</li>
              <li>✓ CRC32 校验保护</li>
            </ul>
          </Link>
        </div>

        {/* 特性说明 */}
        <div className="mt-16 max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-center text-gray-900 mb-8">
            核心特性
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-6">
              <div className="text-4xl mb-3">🔒</div>
              <h4 className="font-semibold text-gray-900 mb-2">完全离线</h4>
              <p className="text-sm text-gray-600">
                无需网络连接，数据通过二维码安全传输
              </p>
            </div>
            <div className="text-center p-6">
              <div className="text-4xl mb-3">📦</div>
              <h4 className="font-semibold text-gray-900 mb-2">高效压缩</h4>
              <p className="text-sm text-gray-600">
                LZ 压缩 + 智能编码，75%+ 压缩率
              </p>
            </div>
            <div className="text-center p-6">
              <div className="text-4xl mb-3">📊</div>
              <h4 className="font-semibold text-gray-900 mb-2">实时反馈</h4>
              <p className="text-sm text-gray-600">
                体积计算、容量预警、字数限制
              </p>
            </div>
          </div>
        </div>

        {/* 容量说明 */}
        <div className="mt-12 max-w-2xl mx-auto p-6 bg-white rounded-xl shadow">
          <h4 className="font-semibold text-gray-900 mb-4 text-center">
            📏 二维码容量说明
          </h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-green-600">🟢 安全</span>
              <span className="text-gray-600">&lt; 1500 字符</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-yellow-600">🟡 警告</span>
              <span className="text-gray-600">1500 ~ 2200 字符</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-red-600">🔴 超限</span>
              <span className="text-gray-600">&gt; 2200 字符</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
