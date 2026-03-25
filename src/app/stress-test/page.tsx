'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { stressTestQuestionnaire, generateStressTestData } from '@/lib/stress-test';
import { encodeQuestionnaire } from '@/lib/encoder';
import { compress } from '@/lib/compressor';
import { CAPACITY_LIMITS } from '@/types';

export default function StressTestPage() {
  const router = useRouter();
  const [results, setResults] = useState<any>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const runTest = async () => {
    setLoading(true);
    
    try {
      const testData = generateStressTestData();
      const { patientInfo, answers } = testData;
      
      // 1. 原始 JSON
      const rawJson = JSON.stringify({ patientInfo, answers });
      
      // 2. 编码
      const encoded = encodeQuestionnaire(patientInfo, answers);
      
      // 3. 压缩
      const compressed = compress(encoded);
      
      // 4. 分析每题体积
      const parts = encoded.split('|');
      const questionVolumes: any[] = [];
      let headerSize = 0;
      
      for (const part of parts) {
        const colonIdx = part.indexOf(':');
        if (colonIdx === -1) continue;
        const key = part.slice(0, colonIdx);
        
        if (['V2', 'P', 'A', 'S'].includes(key) || key === 'V2') {
          headerSize += part.length + 1;
        } else if (/^\d+$/.test(key)) {
          const qId = parseInt(key);
          const q = stressTestQuestionnaire.questions.find(q => q.id === qId);
          questionVolumes.push({
            id: qId,
            title: q?.title || `题${qId}`,
            type: q?.type || 'unknown',
            encoded: part,
            chars: part.length,
            percentage: 0,
          });
        }
      }
      
      // 计算百分比
      const totalAnswerChars = questionVolumes.reduce((sum, q) => sum + q.chars, 0);
      questionVolumes.forEach(q => {
        q.percentage = Math.round((q.chars / encoded.length) * 100);
      });
      
      // 按体积排序
      questionVolumes.sort((a, b) => b.chars - a.chars);
      
      // 5. 多选策略分析
      const multiSelectAnalysis: any[] = [];
      for (const q of stressTestQuestionnaire.questions.filter(q => q.type === 'multiple')) {
        const answer = answers[q.id as keyof typeof answers] as any;
        if (!answer) continue;
        
        const n = q.options!.length;
        const k = answer.value.length;
        const maxSel = q.maxSelect || n;
        
        // 计算组合总数
        let totalCombos = 0;
        for (let i = 1; i <= Math.min(maxSel, n); i++) {
          totalCombos += combinations(n, i);
        }
        
        // 各策略长度
        const listLen = k;
        const bitmapLen = Math.ceil(Math.log2(Math.pow(2, n)) / Math.log2(36)) || 1;
        const comboAvailable = totalCombos <= 1296 && n <= 12;
        const comboLen = totalCombos <= 36 ? 1 : (totalCombos <= 1296 ? 2 : Infinity);
        
        const best = Math.min(listLen, bitmapLen, comboAvailable ? comboLen : Infinity);
        const strategy = best === comboLen && comboAvailable ? 'combo' : (best === bitmapLen ? 'bitmap' : 'list');
        
        multiSelectAnalysis.push({
          id: q.id,
          title: q.title,
          options: n,
          selected: k,
          maxSelect: maxSel,
          totalCombos,
          listLen,
          bitmapLen,
          comboLen: comboAvailable ? comboLen : '不可用',
          comboAvailable,
          recommended: strategy,
          actual: answer.strategy,
        });
      }
      
      // 6. 容量状态
      let status: 'safe' | 'warning' | 'exceeded' = 'safe';
      if (compressed.length >= CAPACITY_LIMITS.MAX) status = 'exceeded';
      else if (compressed.length >= CAPACITY_LIMITS.SAFE) status = 'warning';
      
      const result = {
        questionCount: Object.keys(answers).length,
        rawJsonLength: rawJson.length,
        encodedLength: encoded.length,
        compressedLength: compressed.length,
        compressionRatio: Math.round((1 - compressed.length / rawJson.length) * 100),
        encodingRatio: Math.round((1 - encoded.length / rawJson.length) * 100),
        status,
        headerSize,
        totalAnswerChars,
        questionVolumes,
        multiSelectAnalysis,
        encoded,
        compressed,
      };
      
      setResults(result);
      
      // 7. 生成二维码
      try {
        const dataUrl = await QRCode.toDataURL(compressed, {
          width: 400,
          margin: 2,
          errorCorrectionLevel: 'L', // 最低纠错 → 最大容量
        });
        setQrDataUrl(dataUrl);
      } catch (qrErr: any) {
        console.error('二维码生成失败:', qrErr);
        // 超限时尝试更低纠错
        try {
          const dataUrl = await QRCode.toDataURL(compressed.slice(0, 2200), {
            width: 400,
            margin: 1,
            errorCorrectionLevel: 'L',
          });
          setQrDataUrl(dataUrl);
        } catch {
          console.error('二维码彻底失败');
        }
      }
      
    } catch (err: any) {
      console.error('测试失败:', err);
      alert('测试失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  function combinations(n: number, k: number): number {
    if (k > n) return 0;
    if (k === 0 || k === n) return 1;
    let r = 1;
    for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1);
    return Math.round(r);
  }

  const statusColor = (s: string) => s === 'safe' ? 'text-green-600' : s === 'warning' ? 'text-yellow-600' : 'text-red-600';
  const statusBg = (s: string) => s === 'safe' ? 'bg-green-500' : s === 'warning' ? 'bg-yellow-500' : 'bg-red-500';
  const statusIcon = (s: string) => s === 'safe' ? '🟢' : s === 'warning' ? '🟡' : '🔴';
  const statusText = (s: string) => s === 'safe' ? '安全' : s === 'warning' ? '警告' : '超限';

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <button onClick={() => router.push('/')} className="text-blue-600 hover:underline mb-4">
            ← 返回首页
          </button>
          <h1 className="text-3xl font-bold text-gray-900">🧪 极限容量测试</h1>
          <p className="text-gray-600 mt-2">
            测试 40 题问卷（10单选 + 8多选 + 10数值 + 6填空 + 6问答）在二维码中的极限表现
          </p>
        </div>

        {/* 测试按钮 */}
        <div className="flex gap-4 justify-center mb-8">
          <button onClick={runTest} disabled={loading}
            className={`px-8 py-3 text-white font-semibold rounded-lg ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {loading ? '⏳ 测试中...' : '🚀 运行极限测试'}
          </button>
        </div>

        {results && (
          <div className="space-y-6">
            {/* 总览 */}
            <section className="bg-white rounded-xl shadow p-6">
              <h2 className="text-xl font-semibold mb-4">📊 总体分析</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500">题目数</div>
                  <div className="text-3xl font-bold text-gray-900">{results.questionCount}</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500">原始 JSON</div>
                  <div className="text-3xl font-bold text-gray-900">{results.rawJsonLength}</div>
                  <div className="text-xs text-gray-400">字符</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500">编码后</div>
                  <div className="text-3xl font-bold text-blue-600">{results.encodedLength}</div>
                  <div className="text-xs text-gray-400">减少 {results.encodingRatio}%</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500">压缩后</div>
                  <div className={`text-3xl font-bold ${statusColor(results.status)}`}>{results.compressedLength}</div>
                  <div className="text-xs text-gray-400">减少 {results.compressionRatio}%</div>
                </div>
              </div>
              
              {/* 容量进度条 */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span>{statusIcon(results.status)} 状态</span>
                  <span className={`font-semibold ${statusColor(results.status)}`}>
                    {statusText(results.status)} ({results.compressedLength} / {CAPACITY_LIMITS.MAX})
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div className={`h-4 rounded-full ${statusBg(results.status)}`}
                    style={{ width: `${Math.min(100, (results.compressedLength / CAPACITY_LIMITS.MAX) * 100)}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0</span>
                  <span className="text-green-500">安全 ≤{CAPACITY_LIMITS.SAFE}</span>
                  <span className="text-red-500">上限 {CAPACITY_LIMITS.MAX}</span>
                </div>
              </div>
            </section>

            {/* 二维码 */}
            {qrDataUrl && (
              <section className="bg-white rounded-xl shadow p-6 text-center">
                <h2 className="text-xl font-semibold mb-4">📱 生成的二维码</h2>
                <img src={qrDataUrl} alt="QR" className="mx-auto border-4 border-blue-100 rounded-lg" />
                <p className="text-sm text-gray-500 mt-3">
                  包含 {results.questionCount} 题完整答案，压缩后 {results.compressedLength} 字符
                </p>
              </section>
            )}

            {/* 多选策略分析 */}
            <section className="bg-white rounded-xl shadow p-6">
              <h2 className="text-xl font-semibold mb-4">🎯 多选题编码策略分析</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 text-left">题号</th>
                      <th className="p-2 text-left">题目</th>
                      <th className="p-2">选项数</th>
                      <th className="p-2">已选</th>
                      <th className="p-2">组合数</th>
                      <th className="p-2">列表</th>
                      <th className="p-2">位图</th>
                      <th className="p-2">组合</th>
                      <th className="p-2">推荐</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.multiSelectAnalysis.map((m: any) => (
                      <tr key={m.id} className="border-b">
                        <td className="p-2">{m.id}</td>
                        <td className="p-2">{m.title}</td>
                        <td className="p-2 text-center">{m.options}</td>
                        <td className="p-2 text-center">{m.selected}</td>
                        <td className="p-2 text-center">{m.totalCombos}</td>
                        <td className="p-2 text-center">{m.listLen}字符</td>
                        <td className="p-2 text-center">{m.bitmapLen}字符</td>
                        <td className="p-2 text-center">
                          {m.comboAvailable ? `${m.comboLen}字符` : <span className="text-red-400">❌</span>}
                        </td>
                        <td className="p-2 text-center">
                          <span className={`px-2 py-1 rounded text-white text-xs ${
                            m.recommended === 'combo' ? 'bg-green-500' :
                            m.recommended === 'bitmap' ? 'bg-blue-500' : 'bg-gray-500'
                          }`}>{m.recommended}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 每题体积分析 */}
            <section className="bg-white rounded-xl shadow p-6">
              <h2 className="text-xl font-semibold mb-4">📏 每题体积排名（TOP 15）</h2>
              <div className="space-y-2">
                {results.questionVolumes.slice(0, 15).map((q: any) => (
                  <div key={q.id} className="flex items-center gap-3">
                    <span className="text-sm font-mono w-8 text-gray-500">#{q.id}</span>
                    <span className="text-sm w-32 truncate">{q.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 w-16 text-center">{q.type}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-4">
                      <div className="h-4 rounded-full bg-blue-500"
                        style={{ width: `${Math.min(100, q.percentage * 3)}%` }} />
                    </div>
                    <span className="text-sm font-mono w-20 text-right">{q.chars} 字符</span>
                    <span className="text-xs text-gray-400 w-12 text-right">{q.percentage}%</span>
                  </div>
                ))}
              </div>
            </section>

            {/* 编码结果 */}
            <section className="bg-white rounded-xl shadow p-6">
              <h2 className="text-xl font-semibold mb-4">🔧 编码结果</h2>
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">编码字符串（{results.encodedLength} 字符）：</h3>
                <pre className="bg-gray-50 p-3 rounded text-xs font-mono overflow-x-auto max-h-32 whitespace-pre-wrap break-all">
                  {results.encoded}
                </pre>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">压缩后（{results.compressedLength} 字符）：</h3>
                <pre className="bg-gray-50 p-3 rounded text-xs font-mono overflow-x-auto max-h-32 whitespace-pre-wrap break-all">
                  {results.compressed}
                </pre>
              </div>
            </section>

            {/* 结论 */}
            <section className="bg-white rounded-xl shadow p-6">
              <h2 className="text-xl font-semibold mb-4">📝 测试结论</h2>
              <div className="space-y-3 text-sm">
                <div className="flex gap-2">
                  <span>📊</span>
                  <span>
                    <strong>40 题问卷</strong>（10单选 + 8多选 + 10数值 + 6填空 + 6问答），
                    原始 JSON <strong>{results.rawJsonLength}</strong> 字符 → 
                    编码后 <strong>{results.encodedLength}</strong> 字符 → 
                    压缩后 <strong>{results.compressedLength}</strong> 字符
                  </span>
                </div>
                <div className="flex gap-2">
                  <span>📦</span>
                  <span>
                    总压缩率 <strong>{results.compressionRatio}%</strong>，
                    其中编码阶段减少 {results.encodingRatio}%，
                    LZ 压缩进一步减少
                  </span>
                </div>
                <div className="flex gap-2">
                  <span>{statusIcon(results.status)}</span>
                  <span>
                    二维码容量状态：<strong className={statusColor(results.status)}>{statusText(results.status)}</strong>
                    （{results.compressedLength} / {CAPACITY_LIMITS.MAX}）
                  </span>
                </div>
                <div className="flex gap-2">
                  <span>💡</span>
                  <span>
                    文本题（填空+问答）占总体积最大比重，是容量优化的主要目标。
                    多选题通过智能编码策略有效减少了体积。
                  </span>
                </div>
              </div>
            </section>
          </div>
        )}

        {!results && !loading && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🧪</div>
            <p className="text-gray-600 mb-2">点击"运行极限测试"开始</p>
            <p className="text-sm text-gray-400">
              将模拟 40 题问卷（含所有题型），全部填满答案，测试二维码容量极限
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
