'use client';

import { useState } from 'react';

export default function TestQRPage() {
  const [testUrl, setTestUrl] = useState('http://192.168.31.99:3000/patient?template=scoliosis-v1');
  const [qrUrl, setQrUrl] = useState('');

  const generateTestQR = () => {
    const api1 = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(testUrl)}&margin=10`;
    const api2 = `https://quickchart.io/qr?text=${encodeURIComponent(testUrl)}&size=400&margin=10`;
    
    setQrUrl(api1);
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">🧪 二维码生成测试</h1>
        
        {/* 输入框 */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">测试链接</label>
          <input
            type="text"
            value={testUrl}
            onChange={(e) => setTestUrl(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        {/* 生成按钮 */}
        <button
          onClick={generateTestQR}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg mb-6"
        >
          生成测试二维码
        </button>

        {/* API 1 */}
        {qrUrl && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">API 1: qrserver.com</h2>
            <div className="bg-white p-4 rounded-lg shadow">
              <img src={qrUrl} alt="QR Code" className="mx-auto" />
            </div>
            <div className="mt-2 text-xs text-gray-500 break-all">{qrUrl}</div>
          </div>
        )}

        {/* API 2 */}
        {qrUrl && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">API 2: quickchart.io</h2>
            <div className="bg-white p-4 rounded-lg shadow">
              <img 
                src={`https://quickchart.io/qr?text=${encodeURIComponent(testUrl)}&size=400&margin=10`} 
                alt="QR Code" 
                className="mx-auto"
              />
            </div>
          </div>
        )}

        {/* 说明 */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">📝 测试说明</h3>
          <ul className="text-sm space-y-1">
            <li>1. 检查哪个 API 能正常显示二维码</li>
            <li>2. 打开浏览器控制台查看网络请求</li>
            <li>3. 如果都失败，检查网络连接</li>
            <li>4. 如果 API 1 成功，使用默认方案</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
