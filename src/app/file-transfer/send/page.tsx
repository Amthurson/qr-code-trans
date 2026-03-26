'use client';

import React, { useState, useCallback, useRef } from 'react';
import {
  fileToBase64,
  chunkData,
  createFileMetadata,
  createEndMarker,
  encodeQRData,
  crc32,
  formatFileSize,
  estimateChunks,
} from '@/lib/file-transfer';
import QRCode from 'qrcode';

export default function SendFilePage() {
  const [file, setFile] = useState<File | null>(null);
  const [chunks, setChunks] = useState<any[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(-1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number } | null>(null);
  
  const transmissionTimer = useRef<NodeJS.Timeout | null>(null);
  const autoAdvanceRef = useRef(true);
  const [fps, setFps] = useState(2); // 默认 2 FPS，可调整
  const [loopCount, setLoopCount] = useState(0); // 循环次数

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setChunks([]);
      setCurrentChunkIndex(-1);
      setQrDataUrl(null);
      setFileMeta(null);
    }
  }, []);

  const handleGenerateChunks = useCallback(async () => {
    if (!file) return;

    setIsGenerating(true);
    setError(null);

    try {
      // 转换为 Base64
      const base64 = await fileToBase64(file);
      
      // 计算文件 CRC32
      const fileCrc = crc32(base64);
      
      // 分片
      const dataChunks = chunkData(base64, 1800);
      
      // 创建文件元数据（作为最后一个数据分片）
      const metaChunk = createFileMetadata(
        file.name,
        file.size,
        file.type || 'application/octet-stream',
        dataChunks.length,
        fileCrc
      );
      
      // 创建结束标识
      const endMarker = createEndMarker(metaChunk.fileId);
      
      // 合并所有分片：数据分片 + 元数据分片 + 结束标识
      const allChunks = [
        ...dataChunks,
        metaChunk,
        endMarker,
      ];
      
      setChunks(allChunks);
      setFileMeta({ name: file.name, size: file.size });
      setCurrentChunkIndex(0);
      
      // 生成第一个二维码
      const qrData = encodeQRData(allChunks[0]);
      const qrDataUrl = await QRCode.toDataURL(qrData, {
        width: 400,
        margin: 2,
        errorCorrectionLevel: 'M',
      });
      setQrDataUrl(qrDataUrl);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setIsGenerating(false);
    }
  }, [file]);

  const handleStartTransmission = useCallback(() => {
    setIsTransmitting(true);
    autoAdvanceRef.current = true;
  }, []);

  const handleStopTransmission = useCallback(() => {
    setIsTransmitting(false);
    autoAdvanceRef.current = false;
    if (transmissionTimer.current) {
      clearInterval(transmissionTimer.current);
      transmissionTimer.current = null;
    }
  }, []);

  const handleNextChunk = useCallback(async () => {
    if (currentChunkIndex < chunks.length - 1) {
      const nextIndex = currentChunkIndex + 1;
      setCurrentChunkIndex(nextIndex);
      
      const qrData = encodeQRData(chunks[nextIndex]);
      const qrDataUrl = await QRCode.toDataURL(qrData, {
        width: 400,
        margin: 2,
        errorCorrectionLevel: 'M',
      });
      setQrDataUrl(qrDataUrl);
      setProgress(((nextIndex + 1) / chunks.length) * 100);
    }
  }, [currentChunkIndex, chunks]);

  // 自动切换分片（支持循环播放）
  React.useEffect(() => {
    if (isTransmitting) {
      const interval = Math.round(1000 / fps); // 根据 FPS 计算间隔
      
      transmissionTimer.current = setInterval(() => {
        if (autoAdvanceRef.current) {
          if (currentChunkIndex < chunks.length - 1) {
            handleNextChunk();
          } else {
            // 到达最后一个分片，循环回第一个
            setCurrentChunkIndex(0);
            setLoopCount(prev => prev + 1);
            
            // 重新生成第一个二维码
            const qrData = encodeQRData(chunks[0]);
            QRCode.toDataURL(qrData, {
              width: 400,
              margin: 2,
              errorCorrectionLevel: 'M',
            }).then(setQrDataUrl);
            
            setProgress(0);
          }
        }
      }, interval);
    }

    return () => {
      if (transmissionTimer.current) {
        clearInterval(transmissionTimer.current);
      }
    };
  }, [isTransmitting, currentChunkIndex, chunks.length, chunks, fps, handleNextChunk]);

  const estimatedChunks = file ? estimateChunks(file.size) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            📤 文件发送端
          </h1>
          <p className="text-gray-600">
            选择文件 → 生成二维码序列 → 接收端扫描
          </p>
        </div>

        {/* File Selection */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">1️⃣ 选择文件</h2>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-500 transition-colors">
            <input
              type="file"
              id="file-input"
              onChange={handleFileSelect}
              className="hidden"
              accept="*/*"
            />
            <label
              htmlFor="file-input"
              className="cursor-pointer flex flex-col items-center"
            >
              <svg
                className="w-16 h-16 text-gray-400 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-gray-600 mb-2">
                {file ? file.name : '点击或拖拽文件到此处'}
              </span>
              {file && (
                <span className="text-sm text-gray-500">
                  {formatFileSize(file.size)}
                </span>
              )}
            </label>
          </div>

          {file && !chunks.length && (
            <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-800">
                📊 预估分片数量：<strong>{estimatedChunks + 2}</strong> 个二维码
                （包含元数据和结束标识）
              </p>
              <p className="text-xs text-yellow-600 mt-1">
                每个二维码约 2 秒，总耗时约 {Math.ceil((estimatedChunks + 2) * 2 / 60)} 分钟
              </p>
            </div>
          )}
        </div>

        {/* Generate Button */}
        {file && !chunks.length && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <button
              onClick={handleGenerateChunks}
              disabled={isGenerating}
              className="w-full py-3 px-6 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
            >
              {isGenerating ? '生成中...' : '2️⃣ 生成二维码序列'}
            </button>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
            ❌ {error}
          </div>
        )}

        {/* QR Code Display */}
        {chunks.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">
              3️⃣ 展示二维码
            </h2>

            {/* FPS Control */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">
                  ⚡ 刷新率 (FPS)
                </label>
                <span className="text-sm font-bold text-indigo-600">
                  {fps} FPS
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                disabled={isTransmitting}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1 FPS (稳定)</span>
                <span>10 FPS (快速)</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>
                  进度：{currentChunkIndex + 1} / {chunks.length}
                  {loopCount > 0 && (
                    <span className="ml-2 text-green-600">
                      (第 {loopCount + 1} 轮)
                    </span>
                  )}
                </span>
                <span>{progress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-indigo-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Current Chunk Info */}
            {currentChunkIndex >= 0 && currentChunkIndex < chunks.length && (
              <div className="text-center mb-6">
                <div className={`inline-block px-4 py-2 rounded-full text-sm font-semibold mb-4 ${
                  chunks[currentChunkIndex].type === 'end'
                    ? 'bg-green-100 text-green-700'
                    : chunks[currentChunkIndex].type === 'file-meta'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {chunks[currentChunkIndex].type === 'end'
                    ? '🏁 结束标识'
                    : chunks[currentChunkIndex].type === 'file-meta'
                    ? '📋 文件元数据'
                    : `📦 数据分片 ${currentChunkIndex + 1}/${chunks.length - 2}`}
                </div>

                {qrDataUrl && (
                  <div className="inline-block p-4 bg-white rounded-lg shadow-md">
                    <img src={qrDataUrl} alt="QR Code" className="w-64 h-64" />
                  </div>
                )}

                <p className="text-sm text-gray-500 mt-4">
                  {isTransmitting ? '🔄 自动切换中...' : '⏸️ 已暂停'}
                </p>
              </div>
            )}

            {/* Control Buttons */}
            <div className="flex gap-4">
              {!isTransmitting ? (
                <button
                  onClick={handleStartTransmission}
                  className="flex-1 py-3 px-6 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                >
                  ▶️ 开始传输
                </button>
              ) : (
                <button
                  onClick={handleStopTransmission}
                  className="flex-1 py-3 px-6 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 transition-colors"
                >
                  ⏸️ 暂停
                </button>
              )}

              {isTransmitting && (
                <button
                  onClick={handleNextChunk}
                  className="flex-1 py-3 px-6 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                >
                  ⏭️ 下一个
                </button>
              )}

              {/* Reset Button */}
              {!isTransmitting && currentChunkIndex >= chunks.length - 1 && (
                <button
                  onClick={() => {
                    setFile(null);
                    setChunks([]);
                    setCurrentChunkIndex(-1);
                    setQrDataUrl(null);
                    setFileMeta(null);
                  }}
                  className="flex-1 py-3 px-6 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors"
                >
                  🔄 重新选择
                </button>
              )}
            </div>

            {/* Completion Message */}
            {loopCount > 0 && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                <p className="text-green-800 font-semibold">
                  🔄 循环播放中 (第 {loopCount + 1} 轮)
                </p>
                <p className="text-sm text-green-600 mt-1">
                  接收端可以中途加入扫描，无需等待从头开始
                </p>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="font-semibold text-gray-700 mb-3">📖 使用说明</h3>
          <ol className="space-y-2 text-sm text-gray-600">
            <li>1. 选择要传输的文件（支持任意类型）</li>
            <li>2. 点击"生成二维码序列"，系统会自动分片并编码</li>
            <li>3. 调节 FPS（推荐 2-5 FPS，根据设备性能）</li>
            <li>4. 点击"开始传输"，二维码会循环播放</li>
            <li>5. 接收端使用摄像头连续扫描即可（支持中途加入）</li>
          </ol>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 <strong>提示：</strong> 确保接收端摄像头清晰对准二维码，保持设备稳定。
              大文件可能需要较长时间，请耐心等待。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
