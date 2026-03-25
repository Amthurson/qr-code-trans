'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import { decompress } from '@/lib/compressor';
import { decodeQuestionnaire } from '@/lib/encoder';
import { scoliosisQuestionnaire } from '@/lib/questions';

export default function HospitalPage() {
  const router = useRouter();
  const [inputMode, setInputMode] = useState<'input' | 'scan' | 'upload'>('input');
  const [qrString, setQrString] = useState('');
  const [decodedData, setDecodedData] = useState<any>(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraId, setCameraId] = useState('');
  const [cameras, setCameras] = useState<{id: string, label: string}[]>([]);
  const [uploading, setUploading] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 一键启动摄像头（获取权限 + 选择后置 + 启动）
  const startScanner = async () => {
    try {
      setError('');
      
      // 1. 请求摄像头权限
      console.log('📷 请求摄像头权限...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      // 立即释放预览流
      stream.getTracks().forEach(t => t.stop());
      console.log('✅ 权限已获取');
      
      // 2. 获取摄像头列表
      const devices = await Html5Qrcode.getCameras();
      console.log('可用摄像头:', devices);
      setCameras(devices);
      
      if (devices.length === 0) {
        throw new Error('未找到摄像头');
      }
      
      // 3. 选择后置摄像头
      const backCamera = devices.find(d =>
        d.label.toLowerCase().includes('back') ||
        d.label.toLowerCase().includes('rear') ||
        d.label.toLowerCase().includes('environment')
      );
      const selectedCam = backCamera || devices[0];
      console.log('选择摄像头:', selectedCam.label);
      setCameraId(selectedCam.id);
      
      // 4. 确保 DOM 元素存在
      const qrReaderElement = document.getElementById('qr-reader');
      if (!qrReaderElement) {
        throw new Error('扫码容器未找到');
      }
      qrReaderElement.innerHTML = '';
      
      // 5. 启动扫码
      setScanning(true);
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      
      const onSuccess = (decodedText: string) => {
        console.log('✅ 扫码成功:', decodedText);
        handleDecode(decodedText);
        stopScanner();
      };
      
      // 尝试方案1：设备 ID
      try {
        console.log('🎥 方案1: 设备 ID:', selectedCam.id);
        await scanner.start(
          selectedCam.id,
          { fps: 10, qrbox: { width: 250, height: 250 } },
          onSuccess, () => {}
        );
        console.log('✅ 方案1成功');
        return;
      } catch (e1: any) {
        console.warn('⚠️ 方案1失败:', e1.message);
        try { await scanner.stop(); } catch {}
        qrReaderElement.innerHTML = '';
      }
      
      // 尝试方案2：facingMode environment
      try {
        console.log('🎥 方案2: facingMode environment');
        const scanner2 = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner2;
        await scanner2.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          onSuccess, () => {}
        );
        console.log('✅ 方案2成功');
        return;
      } catch (e2: any) {
        console.warn('⚠️ 方案2失败:', e2.message);
        try { if (scannerRef.current) await scannerRef.current.stop(); } catch {}
        qrReaderElement.innerHTML = '';
      }
      
      // 尝试方案3：facingMode user（前置摄像头兜底）
      try {
        console.log('🎥 方案3: facingMode user（前置兜底）');
        const scanner3 = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner3;
        await scanner3.start(
          { facingMode: 'user' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          onSuccess, () => {}
        );
        console.log('✅ 方案3成功（前置摄像头）');
        return;
      } catch (e3: any) {
        console.warn('⚠️ 方案3也失败:', e3.message);
      }
      
      throw new Error('所有摄像头启动方案均失败，请尝试上传图片');
      
    } catch (err: any) {
      console.error('❌ 启动失败:', err);
      let msg = err.message || '未知错误';
      if (err.name === 'NotAllowedError') msg = '摄像头权限被拒绝';
      if (err.name === 'NotFoundError') msg = '未找到摄像头';
      if (err.name === 'NotReadableError') msg = '摄像头被占用';
      setError(`启动失败：${msg}`);
      setScanning(false);
    }
  };

  // 切换摄像头（手动选择后重启）
  const switchCamera = async (newCamId: string) => {
    setCameraId(newCamId);
    await stopScanner();
    
    setTimeout(async () => {
      const qrReaderElement = document.getElementById('qr-reader');
      if (!qrReaderElement) return;
      qrReaderElement.innerHTML = '';
      
      try {
        setScanning(true);
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;
        await scanner.start(
          newCamId,
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => { handleDecode(decodedText); stopScanner(); },
          () => {}
        );
      } catch (err: any) {
        setError(`切换失败：${err.message}`);
        setScanning(false);
      }
    }, 300);
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
      setScanning(false);
    }
  };

  const handleDecode = (code: string) => {
    setQrString(code);
    try {
      let decoded: any;
      try { decoded = decodeQuestionnaire(code); }
      catch { decoded = decodeQuestionnaire(decompress(code)); }

      const answers: any = {};
      for (const [qid, answer] of Object.entries(decoded.answers)) {
        const question = scoliosisQuestionnaire.questions.find(q => q.id === parseInt(qid));
        if (!question) continue;
        answers[parseInt(qid)] = {
          question, answer,
          displayText: formatAnswer(answer, question),
        };
      }
      setDecodedData({ version: 'V2', patientInfo: decoded.patientInfo, answers, isValid: true });
      setError('');
    } catch (e: any) {
      setError(e.message || '解码失败');
      setDecodedData(null);
    }
  };

  const formatAnswer = (answer: any, question: any): string => {
    switch (answer.type) {
      case 'single': return question.options?.find((o: any) => o.id === answer.value)?.label || answer.value;
      case 'multiple': return answer.value.map((v: string) => question.options?.find((o: any) => o.id === v)?.label || v).join(', ');
      case 'numeric': return `${answer.value}`;
      case 'text': case 'long-text': return answer.value;
      default: return '未知';
    }
  };

  const handleReset = () => {
    setQrString('');
    setDecodedData(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      if (!file.type.startsWith('image/')) throw new Error('请上传图片文件');
      if (file.size > 5 * 1024 * 1024) throw new Error('图片大小不能超过 5MB');
      const scanner = new Html5Qrcode('qr-reader-hidden');
      const decodedText = await scanner.scanFile(file, true);
      if (!decodedText) throw new Error('未在图片中找到二维码');
      handleDecode(decodedText);
    } catch (err: any) {
      setError(err.message || '图片解析失败');
      setDecodedData(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* 头部 */}
        <div className="mb-8">
          <button onClick={() => router.push('/')} className="text-blue-600 hover:underline mb-4">
            ← 返回首页
          </button>
          <h1 className="text-3xl font-bold text-gray-900">🏥 医院端扫码解码</h1>
          <p className="text-gray-600 mt-2">扫码或输入二维码内容，还原问卷数据</p>
        </div>

        {/* 输入方式选择 */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <div className="flex flex-wrap gap-3 mb-6">
            <button onClick={() => { setInputMode('input'); stopScanner(); }}
              className={`px-4 py-2 rounded-lg font-medium ${inputMode === 'input' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              📝 手动输入
            </button>
            <button onClick={() => setInputMode('scan')}
              className={`px-4 py-2 rounded-lg font-medium ${inputMode === 'scan' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              📷 摄像头扫码
            </button>
            <button onClick={() => { setInputMode('upload'); stopScanner(); }}
              className={`px-4 py-2 rounded-lg font-medium ${inputMode === 'upload' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              🖼️ 上传图片
            </button>
          </div>

          {/* 手动输入 */}
          {inputMode === 'input' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">二维码内容</label>
              <textarea value={qrString} onChange={(e) => setQrString(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm" rows={4}
                placeholder="粘贴或输入二维码编码字符串..." />
              <div className="flex gap-4 mt-4">
                <button onClick={() => handleDecode(qrString)}
                  className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                  🔍 解码
                </button>
                <button onClick={handleReset}
                  className="px-6 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300">
                  🔄 重置
                </button>
              </div>
            </div>
          )}

          {/* 摄像头扫码 */}
          {inputMode === 'scan' && (
            <div className="text-center py-4">
              {!decodedData && !error && !scanning && (
                <div className="py-8">
                  <div className="text-6xl mb-4">📷</div>
                  <p className="text-gray-600 mb-6">一键启动后置摄像头扫码</p>
                  <button onClick={startScanner}
                    className="px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-lg">
                    📷 启动摄像头扫码
                  </button>
                  <p className="text-sm text-gray-500 mt-4">
                    💡 默认使用后置摄像头，自动尝试多种启动方式
                  </p>
                </div>
              )}

              {/* 扫码画面 */}
              {scanning && (
                <div>
                  {cameras.length > 1 && (
                    <div className="mb-3 max-w-md mx-auto">
                      <label className="text-sm text-gray-600 mr-2">切换摄像头：</label>
                      <select value={cameraId} onChange={(e) => switchCamera(e.target.value)}
                        className="px-3 py-1 border rounded-lg text-sm">
                        {cameras.map((cam) => (
                          <option key={cam.id} value={cam.id}>{cam.label || `摄像头 ${cam.id}`}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
              
              {/* 扫码容器 - 始终存在 */}
              <div className="mt-2">
                <div id="qr-reader" className="max-w-md mx-auto" style={{ minHeight: scanning ? '300px' : '0' }}></div>
              </div>
              
              {scanning && (
                <button onClick={stopScanner}
                  className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                  ⏹️ 停止扫码
                </button>
              )}
              {error && !scanning && (
                <div>
                  <div className="text-6xl mb-4">⚠️</div>
                  <p className="text-red-600 mb-4 font-medium">{error}</p>
                  <div className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
                    <p className="mb-2">💡 可能的原因：</p>
                    <ul className="text-left space-y-1">
                      <li>• 浏览器未授权摄像头权限</li>
                      <li>• 没有可用的摄像头设备</li>
                      <li>• 摄像头正在被其他应用使用</li>
                      <li>• 需要 HTTPS 环境（Vercel 已支持）</li>
                    </ul>
                  </div>
                  <div className="flex gap-4 justify-center flex-wrap">
                    <button onClick={startScanner}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                      🔄 重试摄像头
                    </button>
                    <button onClick={() => setInputMode('upload')}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                      🖼️ 上传图片
                    </button>
                    <button onClick={() => setInputMode('input')}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      📝 手动输入
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 图片上传 */}
          {inputMode === 'upload' && (
            <div className="text-center py-8">
              {!decodedData && !uploading && !error && (
                <>
                  <div className="text-6xl mb-4">🖼️</div>
                  <p className="text-gray-600 mb-6">上传包含二维码的图片进行解析</p>
                  <div onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-xl p-8 mb-4 cursor-pointer hover:border-blue-500">
                    <div className="text-4xl mb-2">📤</div>
                    <p className="text-gray-600 mb-2">点击选择图片</p>
                    <p className="text-sm text-gray-500">支持 PNG、JPG 格式，最大 5MB</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  <div className="text-sm text-gray-500">
                    <p>💡 可以上传截图中的二维码</p>
                  </div>
                </>
              )}
              {uploading && (
                <div>
                  <div className="text-4xl mb-4">⏳</div>
                  <p className="text-gray-600">正在解析图片...</p>
                </div>
              )}
              {error && !uploading && !decodedData && (
                <div>
                  <div className="text-6xl mb-4">❌</div>
                  <p className="text-red-600 mb-4">{error}</p>
                  <button onClick={() => { setError(''); fileInputRef.current?.click(); }}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    🔄 重新上传
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 隐藏的扫码器用于图片解析 */}
          <div id="qr-reader-hidden" style={{ display: 'none' }}></div>
        </div>

        {/* 通用错误提示 */}
        {error && inputMode === 'input' && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">❌ {error}</p>
          </div>
        )}

        {/* 解码结果 */}
        {decodedData && decodedData.isValid && (
          <div className="space-y-6">
            <section className="bg-white rounded-xl shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">👤 患者信息</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-gray-500">患者 ID</div>
                  <div className="text-lg font-medium text-gray-900">{decodedData.patientInfo.id || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">姓名</div>
                  <div className="text-lg font-medium text-gray-900">{decodedData.patientInfo.name || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">年龄 / 性别</div>
                  <div className="text-lg font-medium text-gray-900">
                    {decodedData.patientInfo.age}岁 / {decodedData.patientInfo.gender === 'M' ? '男' : '女'}
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-xl shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">📋 问卷答案</h2>
              <div className="space-y-4">
                {Object.entries(decodedData.answers).map(([id, item]: [string, any]) => (
                  <div key={id} className="border-b border-gray-200 pb-4 last:border-0">
                    <div className="flex items-start gap-2 mb-2">
                      <span className="font-medium text-gray-900">
                        {item.question.id}. {item.question.title}
                      </span>
                      {item.question.required && <span className="text-red-500 text-sm">*</span>}
                    </div>
                    <div className="text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                      {item.displayText || '未回答'}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex gap-4 justify-center flex-wrap">
              <button onClick={() => alert('数据已保存至系统（模拟）')}
                className="px-8 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">
                💾 保存至系统
              </button>
              <button onClick={handleReset}
                className="px-8 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300">
                🔄 继续扫码
              </button>
            </div>
          </div>
        )}

        {!decodedData && !error && inputMode !== 'input' && !scanning && !uploading && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📱</div>
            <p className="text-gray-600">请选择解码方式</p>
          </div>
        )}
      </div>
    </main>
  );
}
