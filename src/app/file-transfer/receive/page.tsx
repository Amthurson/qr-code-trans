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
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const chunkSetRef = useRef<Set<number>>(new Set());
  const lastScanTimeRef = useRef<number>(0);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const handleScanSuccess = useCallback(async (decodedText: string) => {
    // 防抖：避免重复扫描同一个二维码
    const now = Date.now();
    if (now - lastScanTimeRef.current < 500) {
      return;
    }
    lastScanTimeRef.current = now;

    const data = decodeQRData(decodedText);
    
    if (!data) {
      console.log('无效的 QR 数据格式');
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
    console.log(`收到分片 ${chunk.index + 1}/${chunk.total}`);

  }, []);

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
    // 先请求摄像头权限
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      // 权限授予，停止流（稍后由 html5-qrcode 重新打开）
      stream.getTracks().forEach(track => track.stop());
      setCameraPermission('granted');
    } catch (err) {
      console.error('摄像头权限被拒绝:', err);
      setCameraPermission('denied');
      setErrorMessage('无法访问摄像头：请确保已授予摄像头权限');
      setScanStatus('error');
      return;
    }

    // 等待 DOM 更新
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await scanner.start(
        { facingMode: 'environment' },
        config,
        handleScanSuccess,
        (error) => {
          // 扫描错误通常是因为没有检测到二维码，可以忽略
        }
      );

      setIsScanning(true);
      setScanStatus('scanning');
      setErrorMessage(null);
    } catch (err) {
      console.error('启动扫描仪失败:', err);
      setErrorMessage(err instanceof Error ? err.message : '启动摄像头失败');
      setScanStatus('error');
    }
  }, [handleScanSuccess]);

  const handleStartScan = useCallback(() => {
    // 重置状态
    setChunks([]);
    setFileMeta(null);
    setEndMarker(null);
    setDownloadUrl(null);
    chunkSetRef.current.clear();
    setErrorMessage(null);
    startScanner();
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
        </div>

        {/* Error Display */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
            ❌ {errorMessage}
          </div>
        )}

        {/* Scanner */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            1️⃣ 扫描二维码
          </h2>

          {!isScanning && scanStatus !== 'scanning' ? (
            <div className="text-center">
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
                首次使用需要授予摄像头权限
              </p>
            </div>
          ) : (
            <div>
              {/* 摄像头容器 */}
              <div 
                ref={videoContainerRef}
                className="w-full bg-black rounded-lg overflow-hidden mb-4"
                style={{ minHeight: '300px' }}
              >
                <div id="qr-reader" className="w-full" />
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
                </div>
              )}
            </div>
          )}
        </div>

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
              <p className="text-gray-600">
                正在接收数据分片...
              </p>
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
