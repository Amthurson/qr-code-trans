'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  decodeQRData,
  reassembleFile,
  base64ToBlob,
  formatFileSize,
  verifyChunk,
  type ChunkMetadata,
  type FileMetadata,
  type EndMarker,
} from '@/lib/file-transfer';

export default function ReceiveFilePage() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [chunks, setChunks] = useState<ChunkMetadata[]>([]);
  const [fileMeta, setFileMeta] = useState<FileMetadata | null>(null);
  const [endMarker, setEndMarker] = useState<EndMarker | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [mimeType, setMimeType] = useState<string>('');
  const [cameraPermission, setCameraPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [selectedCamera, setSelectedCamera] = useState<string>('environment'); // 'user' | 'environment'
  const [scanRate, setScanRate] = useState<number>(0); // 实时扫描速率 (Hz)
  const [debugMode, setDebugMode] = useState(false); // 调试模式
  const [receivedBytes, setReceivedBytes] = useState<number>(0); // 已接收字节数
  const [avgSpeed, setAvgSpeed] = useState<number>(0); // 平均速度 (kB/s)
  const [currentSpeed, setCurrentSpeed] = useState<number>(0); // 当前速度 (kB/s)
  
  // 检查是否为 HTTPS 环境
  const isSecureContext = typeof window !== 'undefined' && (window.location.protocol === 'https:' || window.location.hostname === 'localhost');
  const startTimeRef = useRef<number>(0);
  const scanCountRef = useRef<number>(0);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const chunkSetRef = useRef<Set<number>>(new Set());
  const lastScanTimeRef = useRef<number>(0);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const handleScanSuccess = useCallback(async (decodedText: string) => {
    const now = Date.now();
    
    // 防抖：避免重复扫描同一个二维码
    if (now - lastScanTimeRef.current < 300) {
      return;
    }
    lastScanTimeRef.current = now;

    console.log('📡 扫描到数据:', decodedText.substring(0, 50) + '...');

    // 更新扫描统计
    scanCountRef.current += 1;
    const elapsed = (now - startTimeRef.current) / 1000; // 秒
    if (elapsed > 0) {
      setScanRate(scanCountRef.current / elapsed);
      setAvgSpeed(receivedBytes / elapsed / 1024); // kB/s
    }

    const data = decodeQRData(decodedText);
    
    if (!data) {
      console.warn('⚠️ 无效的 QR 数据格式:', decodedText.substring(0, 100));
      return;
    }

    // 处理结束标识
    if ('type' in data && data.type === 'end') {
      setEndMarker(data);
      setIsScanning(false);
      stopScanner();
      return;
    }

    // 处理文件元数据
    if ('type' in data && data.type === 'file-meta') {
      setFileMeta(data);
      setFileName(data.fileName);
      setFileSize(data.fileSize);
      setMimeType(data.mimeType);
      console.log('收到文件元数据:', data.fileName);
      return;
    }

    // 处理数据分片
    const chunk = data as ChunkMetadata;
    
    // 验证分片完整性
    if (!verifyChunk(chunk)) {
      console.log('分片校验失败，跳过:', chunk.index);
      return;
    }

    // 去重：如果已经收到这个分片，跳过
    if (chunkSetRef.current.has(chunk.index)) {
      console.log('重复分片，跳过:', chunk.index);
      return;
    }

    // 添加分片
    chunkSetRef.current.add(chunk.index);
    setChunks(prev => [...prev, chunk]);
    
    // 更新接收统计（估算字节数：每片约 1800 字符，Base64 解码后约 1350 字节）
    const newReceivedBytes = receivedBytes + Math.round(chunk.data.length * 0.75);
    setReceivedBytes(newReceivedBytes);
    
    // 实时更新速度统计
    if (elapsed > 0) {
      const avg = newReceivedBytes / elapsed / 1024;
      setAvgSpeed(avg);
      
      // 计算瞬时速度（基于最近一次扫描）
      const timeSinceLastScan = now - lastScanTimeRef.current;
      if (timeSinceLastScan > 0 && timeSinceLastScan < 1000) {
        setCurrentSpeed(Math.round(chunk.data.length * 0.75) / (timeSinceLastScan / 1000) / 1024);
      }
    }
    
    console.log(`收到分片 ${chunk.index + 1}/${chunk.total}, 已接收：${formatFileSize(newReceivedBytes)}`);

  }, [receivedBytes]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
        scannerRef.current = null;
      } catch (err) {
        console.error('停止扫描仪失败:', err);
      }
    }
    setIsScanning(false);
  }, []);



  const startScanner = useCallback(async () => {
    // 重置状态
    setErrorMessage(null);
    setScanStatus('scanning');

    try {
      // 1. 先请求摄像头权限（和医院端一样）
      console.log('📷 请求摄像头权限...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: selectedCamera === 'user' ? 'user' : 'environment' } 
      });
      // 立即释放预览流
      stream.getTracks().forEach(t => t.stop());
      console.log('✅ 权限已获取');
      
      // 2. 获取摄像头列表
      const devices = await Html5Qrcode.getCameras();
      console.log('可用摄像头:', devices);
      
      if (devices.length === 0) {
        throw new Error('未找到摄像头设备');
      }
      
      // 3. 选择摄像头
      let selectedCam;
      if (selectedCamera === 'user') {
        // 前置摄像头
        selectedCam = devices.find(d => 
          d.label.toLowerCase().includes('front') ||
          d.label.toLowerCase().includes('user') ||
          d.label.toLowerCase().includes('face')
        ) || devices[0];
      } else {
        // 后置摄像头
        selectedCam = devices.find(d => 
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment')
        ) || devices[0];
      }
      console.log('选择摄像头:', selectedCam.label);
      
      // 4. 确保 DOM 元素存在
      const qrReaderElement = document.getElementById('qr-reader');
      if (!qrReaderElement) {
        throw new Error('扫码容器未找到');
      }
      qrReaderElement.innerHTML = '';
      
      // 5. 启动扫描器（使用 config 方式，更兼容移动端）
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false,
      };
      
      // 使用 config 方式启动（更兼容移动端）
      await scanner.start(
        { facingMode: selectedCamera === 'user' ? 'user' : 'environment' },
        config,
        handleScanSuccess,
        (error) => {
          console.warn('⚠️ 扫描错误:', error);
        }
      );

      setIsScanning(true);
      setCameraPermission('granted');
      setErrorMessage(null);
      console.log('✅ 扫描器已启动，持续扫描中...');
      
      // 监听扫描器状态变化
      setTimeout(() => {
        if (scannerRef.current && !isScanning) {
          console.log('⚠️ 扫描器似乎已停止，尝试重启...');
        }
      }, 5000);
    } catch (err: any) {
      console.error('启动扫描仪失败:', err);
      setCameraPermission('denied');
      setScanStatus('error');
      
      let errorMsg = '无法启动摄像头';
      if (err.name === 'NotAllowedError') {
        errorMsg = '摄像头权限被拒绝';
      } else if (err.name === 'NotFoundError') {
        errorMsg = '未找到摄像头设备';
      } else if (err.name === 'NotReadableError') {
        errorMsg = '摄像头正在被其他应用使用';
      }
      
      setErrorMessage(`${errorMsg}：${err.message || '请检查浏览器权限设置'}`);
    }
  }, [handleScanSuccess, selectedCamera]);

  const handleStartScan = useCallback(async () => {
    // 重置状态
    setChunks([]);
    setFileMeta(null);
    setEndMarker(null);
    setDownloadUrl(null);
    chunkSetRef.current.clear();
    setErrorMessage(null);
    setReceivedBytes(0);
    setScanRate(0);
    setAvgSpeed(0);
    setCurrentSpeed(0);
    scanCountRef.current = 0;
    startTimeRef.current = Date.now();
    
    await startScanner();
  }, [startScanner]);

  const handleStopScan = useCallback(async () => {
    await stopScanner();
    setScanStatus('idle');
  }, [stopScanner]);

  // 重组文件
  const handleReassemble = useCallback(async () => {
    if (!fileMeta || chunks.length === 0) {
      setErrorMessage('数据不完整，无法重组文件');
      return;
    }

    try {
      setScanStatus('scanning');
      
      // 检查是否收到所有分片
      if (chunks.length < fileMeta.totalChunks) {
        setErrorMessage(`分片不完整：收到 ${chunks.length}/${fileMeta.totalChunks}`);
        setScanStatus('error');
        return;
      }

      // 重组文件
      const base64Data = reassembleFile(chunks, '');
      
      // 转换为 Blob
      const blob = base64ToBlob(base64Data, fileMeta.mimeType);
      
      // 创建下载链接
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setFileName(fileMeta.fileName);
      setFileSize(fileMeta.fileSize);
      setMimeType(fileMeta.mimeType);
      
      setScanStatus('success');
      setErrorMessage(null);
    } catch (err) {
      console.error('重组文件失败:', err);
      setErrorMessage(err instanceof Error ? err.message : '重组失败');
      setScanStatus('error');
    }
  }, [chunks, fileMeta]);

  // 下载文件
  const handleDownload = useCallback(() => {
    if (!downloadUrl || !fileName) return;

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [downloadUrl, fileName]);

  // 清理
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        stopScanner();
      }
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl, stopScanner]);

  // 检查是否可以重组
  const canReassemble = fileMeta && chunks.length >= fileMeta.totalChunks && endMarker;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            📥 文件接收端
          </h1>
          <p className="text-gray-600">
            开启摄像头 → 连续扫描二维码 → 自动重组文件
          </p>
          <button
            onClick={() => setDebugMode(!debugMode)}
            className="mt-4 text-xs text-gray-400 hover:text-gray-600 underline"
          >
            {debugMode ? '隐藏调试信息' : '显示调试信息'}
          </button>
        </div>

        {/* HTTPS Warning */}
        {!isSecureContext && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-4 mb-6">
            <p className="font-semibold mb-2">⚠️ 当前网站未使用 HTTPS</p>
            <p className="text-sm">
              摄像头权限需要 HTTPS 环境才能使用。当前地址：<code className="bg-yellow-100 px-2 py-1 rounded">{typeof window !== 'undefined' ? window.location.href : ''}</code>
            </p>
            <p className="text-sm mt-2">
              <strong>解决方案：</strong>使用 Vercel 部署的 HTTPS 版本，或在本地 localhost 测试
            </p>
          </div>
        )}

        {/* Error Display */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
            <p className="font-semibold mb-2">❌ {errorMessage}</p>
            {isSecureContext ? (
              <div className="text-sm mt-3 space-y-1">
                <p><strong>解决方法：</strong></p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>点击浏览器地址栏左侧的 🔒 图标</li>
                  <li>找到"摄像头"权限</li>
                  <li>切换为"允许"</li>
                  <li>刷新页面</li>
                </ol>
              </div>
            ) : (
              <p className="text-sm mt-2">
                💡 请确保使用 HTTPS 环境访问（如 Vercel 部署地址或 localhost）
              </p>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              🔄 刷新页面
            </button>
          </div>
        )}

        {/* Scanner */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            1️⃣ 扫描二维码
          </h2>

          {/* Camera Selection - Simple Toggle */}
          {!isScanning && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📷 选择摄像头
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedCamera('environment')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedCamera === 'environment'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  📱 后置摄像头
                </button>
                <button
                  onClick={() => setSelectedCamera('user')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedCamera === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  🤳 前置摄像头
                </button>
              </div>
            </div>
          )}

          {!isScanning && scanStatus !== 'scanning' ? (
            <div className="text-center">
              {cameraPermission === 'denied' ? (
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                    <p className="font-semibold mb-2">⚠️ 摄像头权限被拒绝</p>
                    <p>请点击下方按钮刷新页面，然后允许摄像头权限</p>
                  </div>
                  <button
                    onClick={() => window.location.reload()}
                    className="py-3 px-8 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 transition-colors"
                  >
                    🔄 刷新页面
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={handleStartScan}
                    className="py-3 px-8 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center gap-2 mx-auto"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    开启摄像头扫描
                  </button>
                  <p className="text-sm text-gray-500 mt-3">
                    首次使用会请求摄像头权限，请点击"允许"
                  </p>
                </>
              )}
            </div>
          ) : (
            <div>
              {/* 摄像头容器 */}
              <div 
                ref={videoContainerRef}
                className="w-full bg-black rounded-lg overflow-hidden mb-4 relative"
                style={{ minHeight: '300px', minWidth: '300px' }}
              >
                <div id="qr-reader" className="w-full h-full" style={{ minHeight: '300px' }} />
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={handleStopScan}
                  className="flex-1 py-3 px-6 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                >
                  ⏹️ 停止扫描
                </button>
              </div>

              {/* Status */}
              {scanStatus === 'scanning' && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-blue-800 font-semibold flex items-center gap-2">
                    <span className="animate-pulse">🔄</span> 正在扫描中...
                  </p>
                  <p className="text-sm text-blue-600 mt-1">
                    请将手机对准发送端的二维码，保持设备稳定
                  </p>
                  {chunks.length > 0 && !fileMeta && (
                    <p className="text-xs text-blue-500 mt-2">
                      💡 提示：如果长时间未收到文件信息，可能是漏扫了前面的分片，请继续等待下一轮循环
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Debug Panel */}
        {debugMode && (
          <div className="bg-gray-800 text-green-400 rounded-lg p-4 mb-6 font-mono text-xs shadow-lg">
            <h3 className="font-bold mb-2">🔍 调试信息</h3>
            <div className="space-y-1">
              <p>扫描状态：{isScanning ? '✅ 扫描中' : '⏸️ 已暂停'}</p>
              <p>已接收分片：{chunks.length} 个</p>
              <p>分片索引：{[...chunkSetRef.current].sort((a,b) => a-b).join(', ') || '无'}</p>
              <p>文件元数据：{fileMeta ? `✅ ${fileMeta.fileName}` : '❌ 未收到'}</p>
              <p>结束标识：{endMarker ? '✅ 已收到' : '❌ 未收到'}</p>
            </div>
          </div>
        )}

        {/* Real-time Stats Bar (类似 QRSS) - 扫描时始终显示 */}
        {(isScanning || chunks.length > 0) && (
          <div className="bg-gray-900 text-white rounded-lg p-4 mb-6 font-mono text-sm shadow-lg">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              {/* 左侧：进度 */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-green-400 font-bold text-base">
                  {formatFileSize(receivedBytes)}
                </span>
                {fileMeta ? (
                  <>
                    <span className="text-gray-500">/</span>
                    <span className="text-gray-300">{formatFileSize(fileMeta.fileSize)}</span>
                    <span className="text-gray-500">
                      ({Math.round((receivedBytes / fileMeta.fileSize) * 100)}%)
                    </span>
                  </>
                ) : (
                  <span className="text-gray-400 text-xs">
                    (等待文件信息...)
                  </span>
                )}
              </div>
              
              {/* 右侧：性能指标 */}
              <div className="flex items-center gap-4 text-xs flex-shrink-0">
                <div className="text-center">
                  <div className="text-blue-400 font-bold">{scanRate.toFixed(1)} Hz</div>
                  <div className="text-gray-500 text-[10px]">扫描速率</div>
                </div>
                <div className="w-px h-6 bg-gray-700"></div>
                <div className="text-center">
                  <div className="text-yellow-400 font-bold">{currentSpeed.toFixed(2)} kB/s</div>
                  <div className="text-gray-500 text-[10px]">当前速度</div>
                </div>
                {avgSpeed > 0 && (
                  <>
                    <div className="w-px h-6 bg-gray-700"></div>
                    <div className="text-center">
                      <div className="text-gray-400 font-bold">{avgSpeed.toFixed(2)} kB/s</div>
                      <div className="text-gray-500 text-[10px]">平均速度</div>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {/* 进度条 */}
            {fileMeta && (
              <div className="mt-3">
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-green-500 to-green-400 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((receivedBytes / fileMeta.fileSize) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress */}
        {chunks.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">
              📊 接收进度
            </h2>

            {fileMeta && (
              <div className="space-y-4">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>文件名：{fileMeta.fileName}</span>
                  <span>{formatFileSize(fileMeta.fileSize)}</span>
                </div>

                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>已接收分片：{chunks.length} / {fileMeta.totalChunks}</span>
                    <span>{Math.round((chunks.length / fileMeta.totalChunks) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-green-600 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${(chunks.length / fileMeta.totalChunks) * 100}%` }}
                    />
                  </div>
                </div>

                {endMarker && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                    <p className="text-green-800 font-semibold">
                      🏁 传输完成！
                    </p>
                  </div>
                )}
              </div>
            )}

            {!fileMeta && (
              <div className="space-y-2">
                <p className="text-gray-600">
                  正在接收数据分片...
                </p>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    📡 已接收：<strong>{formatFileSize(receivedBytes)}</strong>
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    扫描速率：{scanRate.toFixed(1)} Hz | 速度：{currentSpeed.toFixed(2)} kB/s
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reassemble & Download */}
        {canReassemble && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">
              2️⃣ 重组并下载
            </h2>

            {scanStatus === 'success' && downloadUrl ? (
              <div className="text-center">
                <div className="p-4 bg-green-50 rounded-lg mb-4">
                  <p className="text-green-800 font-semibold text-lg">
                    ✅ 文件已就绪！
                  </p>
                  <p className="text-sm text-green-600 mt-2">
                    📄 {fileName} ({formatFileSize(fileSize)})
                  </p>
                </div>

                <button
                  onClick={handleDownload}
                  className="w-full py-3 px-6 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                >
                  💾 下载文件
                </button>
              </div>
            ) : (
              <button
                onClick={handleReassemble}
                disabled={scanStatus === 'scanning'}
                className="w-full py-3 px-6 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
              >
                {scanStatus === 'scanning' ? '扫描中...' : '🔧 重组文件'}
              </button>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="font-semibold text-gray-700 mb-3">📖 使用说明</h3>
          <ol className="space-y-2 text-sm text-gray-600">
            <li>1. 点击"开启摄像头扫描"，允许摄像头权限</li>
            <li>2. 将手机对准发送端的二维码屏幕</li>
            <li>3. 系统会自动识别并收集所有分片</li>
            <li>4. 检测到结束标识后，传输完成</li>
            <li>5. 点击"重组文件"，然后下载保存</li>
          </ol>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 <strong>提示：</strong> 
              • 扫描过程中请保持设备稳定，确保二维码清晰完整
              <br/>
              • 如果扫描失败，可以调整距离和角度（建议 20-30cm）
              <br/>
              • 确保环境光线充足
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
