'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { questionnaires } from '@/lib/questions';
import QRCode from 'qrcode';

export default function SharePage() {
  const router = useRouter();
  const [selected, setSelected] = useState(questionnaires[0]?.id || 'scoliosis-v1');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    console.log('🔵 按钮被点击了！');
    setLoading(true);
    setError('');
    
    try {
      const url = `${window.location.protocol}//${window.location.host}/patient?template=${selected}`;
      console.log('🔵 生成链接:', url);
      
      // 生成二维码图片
      const dataUrl = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
      });
      
      console.log('🟢 生成成功！');
      setQrDataUrl(dataUrl);
      setShowQR(true);
    } catch (err: any) {
      console.error('🔴 错误:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.download = `问卷二维码-${selected}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold mb-4">📱 生成问卷二维码</h1>
        
        {/* 问卷选择 */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">选择问卷</label>
          <div className="space-y-2">
            {questionnaires.map((q) => (
              <label key={q.id} className="flex items-center gap-2 p-3 border rounded cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="q"
                  value={q.id}
                  checked={selected === q.id}
                  onChange={(e) => {
                    console.log('选择问卷:', e.target.value);
                    setSelected(e.target.value);
                  }}
                  className="w-4 h-4"
                />
                <span>{q.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 生成按钮 */}
        <div className="mb-6">
          <button
            onClick={() => {
              console.log('🔵 按钮 onClick 触发');
              handleGenerate();
            }}
            disabled={loading}
            className={`px-6 py-3 text-white font-semibold rounded-lg ${
              loading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {loading ? '⏳ 生成中...' : '🔗 生成问卷二维码'}
          </button>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded">
            ❌ {error}
          </div>
        )}

        {/* 二维码展示 */}
        {showQR && qrDataUrl && (
          <div className="border-t pt-6">
            <div className="text-center mb-4">
              <div className="text-lg font-bold">✅ 二维码已生成</div>
            </div>
            
            <div className="flex justify-center mb-4">
              <img src={qrDataUrl} alt="QR" className="border-4 border-indigo-100 rounded-lg" />
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  console.log('🔵 下载按钮点击');
                  handleDownload();
                }}
                className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700"
              >
                💾 下载二维码图片
              </button>
              
              <button
                onClick={() => router.push('/')}
                className="w-full py-3 bg-white border text-gray-700 rounded-lg hover:bg-gray-50"
              >
                🏠 返回首页
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
