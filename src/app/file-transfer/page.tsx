import Link from 'next/link';

export default function FileTransferPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            📦 离线文件传输
          </h1>
          <p className="text-xl text-gray-600">
            通过二维码序列传输任意文件，完全离线，安全高效
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Send Card */}
          <Link href="/file-transfer/send" className="block">
            <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow cursor-pointer">
              <div className="text-6xl mb-4">📤</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3">
                发送文件
              </h2>
              <p className="text-gray-600 mb-4">
                选择任意文件，系统会自动分片并生成二维码序列。接收端扫描后即可还原文件。
              </p>
              <ul className="space-y-2 text-sm text-gray-500">
                <li>✓ 支持任意文件类型</li>
                <li>✓ 自动分片编码</li>
                <li>✓ 实时进度显示</li>
                <li>✓ CRC32 校验保护</li>
              </ul>
              <div className="mt-6 text-indigo-600 font-semibold">
                进入发送端 →
              </div>
            </div>
          </Link>

          {/* Receive Card */}
          <Link href="/file-transfer/receive" className="block">
            <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow cursor-pointer">
              <div className="text-6xl mb-4">📥</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3">
                接收文件
              </h2>
              <p className="text-gray-600 mb-4">
                开启摄像头连续扫描，系统自动收集所有分片并重组文件。
              </p>
              <ul className="space-y-2 text-sm text-gray-500">
                <li>✓ 自动连续扫描</li>
                <li>✓ 智能去重</li>
                <li>✓ 完整性校验</li>
                <li>✓ 一键下载</li>
              </ul>
              <div className="mt-6 text-green-600 font-semibold">
                进入接收端 →
              </div>
            </div>
          </Link>
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            🔧 工作原理
          </h2>
          
          <div className="grid md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">📁</span>
              </div>
              <p className="text-sm font-semibold text-gray-700">选择文件</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">🔄</span>
              </div>
              <p className="text-sm font-semibold text-gray-700">Base64 编码</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">📦</span>
              </div>
              <p className="text-sm font-semibold text-gray-700">压缩分片</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">📱</span>
              </div>
              <p className="text-sm font-semibold text-gray-700">二维码传输</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">💾</span>
              </div>
              <p className="text-sm font-semibold text-gray-700">重组下载</p>
            </div>
          </div>
        </div>

        {/* Tech Specs */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            📊 技术规格
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-700 mb-3">编码方案</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• <strong>文件编码：</strong>Base64</li>
                <li>• <strong>压缩算法：</strong>LZ-String（压缩率 ~70%）</li>
                <li>• <strong>分片大小：</strong>1800 字符/片</li>
                <li>• <strong>校验方式：</strong>CRC32</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-700 mb-3">容量参考</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• <strong>100 KB 文件：</strong>约 60 个二维码（~2 分钟）</li>
                <li>• <strong>500 KB 文件：</strong>约 300 个二维码（~10 分钟）</li>
                <li>• <strong>1 MB 文件：</strong>约 600 个二维码（~20 分钟）</li>
                <li>• <strong>二维码密度：</strong>中等（可快速扫描）</li>
              </ul>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            ❓ 常见问题
          </h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">
                Q: 支持多大的文件？
              </h3>
              <p className="text-sm text-gray-600">
                A: 理论上无限制，但建议传输 5MB 以下的文件。大文件会产生大量二维码，传输时间较长。
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">
                Q: 传输过程中可以暂停吗？
              </h3>
              <p className="text-sm text-gray-600">
                A: 当前版本不支持断点续传。如果中断，需要重新开始。建议传输时保持环境稳定。
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">
                Q: 扫码失败怎么办？
              </h3>
              <p className="text-sm text-gray-600">
                A: 调整手机与屏幕的距离（建议 20-30cm），确保光线充足，二维码清晰完整。系统会自动去重，重复扫描不影响结果。
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">
                Q: 数据安全吗？
              </h3>
              <p className="text-sm text-gray-600">
                A: 完全离线传输，数据不经过任何服务器。每个分片都有 CRC32 校验，确保传输准确。
              </p>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-8 text-center">
          <Link href="/" className="text-indigo-600 hover:text-indigo-800 font-semibold">
            ← 返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
