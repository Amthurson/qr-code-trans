'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import { scoliosisQuestionnaire } from '@/lib/questions';
import type { Question, Answer, PatientInfo, VolumeInfo } from '@/types';
import { encodeQuestionnaire } from '@/lib/encoder';
import { compress } from '@/lib/compressor';
import { calculateVolume, getStatusColor, getStatusIcon } from '@/lib/volume-calculator';

function PatientContent() {
  const searchParams = useSearchParams();
  const templateParam = searchParams.get('template');
  
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({
    id: '',
    name: '',
    age: 0,
    gender: 'M',
  });
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [volumeInfo, setVolumeInfo] = useState<VolumeInfo | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [encodedString, setEncodedString] = useState<string>('');
  const [showQR, setShowQR] = useState(false);

  // 实时计算体积
  const updateVolume = useCallback(() => {
    const hasAnswers = Object.keys(answers).length > 0;
    if (!hasAnswers || !patientInfo.id) {
      setVolumeInfo(null);
      return;
    }

    const volume = calculateVolume(patientInfo, answers);
    setVolumeInfo(volume);
  }, [patientInfo, answers]);

  // 处理单选
  const handleSingleSelect = (questionId: number, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { type: 'single', value },
    }));
  };

  // 处理多选
  const handleMultiSelect = (questionId: number, optionId: string, maxSelect: number) => {
    setAnswers(prev => {
      const current = prev[questionId];
      let selected: string[] = current?.type === 'multiple' ? current.value : [];
      
      if (selected.includes(optionId)) {
        selected = selected.filter(id => id !== optionId);
      } else {
        if (selected.length >= maxSelect) {
          return prev;
        }
        selected = [...selected, optionId];
      }
      
      // 自动选择最佳策略
      const strategy = calculateBestStrategy(
        selected,
        scoliosisQuestionnaire.questions.find(q => q.id === questionId)?.options?.map(o => o.id) || [],
        maxSelect
      );
      
      return {
        ...prev,
        [questionId]: { type: 'multiple', value: selected, strategy },
      };
    });
  };

  // 计算多选最佳策略
  const calculateBestStrategy = (
    selected: string[],
    allOptions: string[],
    maxSelect: number
  ): 'list' | 'bitmap' | 'combo' => {
    const n = allOptions.length;
    const k = selected.length;
    
    const listLength = k;
    const bitmapLength = Math.ceil(n / 5);
    
    let totalCombinations = 0;
    for (let i = 1; i <= Math.min(maxSelect, n); i++) {
      totalCombinations += combinations(n, i);
    }
    
    const comboAvailable = totalCombinations <= 1296 && n <= 12;
    const comboLength = totalCombinations <= 36 ? 1 : 2;
    
    if (comboAvailable && comboLength < listLength && comboLength < bitmapLength) {
      return 'combo';
    }
    if (bitmapLength < listLength) {
      return 'bitmap';
    }
    return 'list';
  };

  const combinations = (n: number, k: number): number => {
    if (k > n) return 0;
    if (k === 0 || k === n) return 1;
    let result = 1;
    for (let i = 0; i < k; i++) {
      result = result * (n - i) / (i + 1);
    }
    return result;
  };

  // 处理数值输入
  const handleNumericInput = (questionId: number, value: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { type: 'numeric', value },
    }));
  };

  // 处理文本输入
  const handleTextInput = (questionId: number, value: string, type: 'text' | 'long-text', maxLength: number) => {
    if (value.length > maxLength) {
      return;
    }
    setAnswers(prev => ({
      ...prev,
      [questionId]: { type, value },
    }));
  };

  // 生成二维码
  const generateQRCode = async () => {
    console.log('🔵 开始生成二维码...');
    console.log('患者信息:', patientInfo);
    console.log('答案数量:', Object.keys(answers).length);
    
    try {
      const encoded = encodeQuestionnaire(patientInfo, answers);
      console.log('编码后长度:', encoded.length);
      setEncodedString(encoded);
      
      const compressed = compress(encoded);
      console.log('压缩后长度:', compressed.length);
      
      const dataUrl = await QRCode.toDataURL(compressed, {
        width: 300,
        margin: 2,
        errorCorrectionLevel: 'M',
      });
      
      console.log('🟢 二维码生成成功!');
      setQrCodeDataUrl(dataUrl);
      setShowQR(true);
      updateVolume();
    } catch (error: any) {
      console.error('🔴 生成二维码失败:', error);
      alert('生成二维码失败：' + error.message);
    }
  };

  // 检查必填项
  const checkRequired = () => {
    console.log('🔵 检查必填项...');
    
    // 检查患者信息
    if (!patientInfo.id || !patientInfo.name || !patientInfo.age) {
      alert('请填写完整的患者信息（ID、姓名、年龄）');
      return false;
    }
    
    // 检查必填问题
    const requiredQuestions = scoliosisQuestionnaire.questions.filter(q => q.required);
    for (const q of requiredQuestions) {
      console.log(`检查题目 ${q.id}:`, answers[q.id]);
      if (!answers[q.id]) {
        alert(`请回答必填题：${q.title}`);
        return false;
      }
    }
    
    console.log('🟢 所有必填项已完成!');
    return true;
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* 头部 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => window.history.back()}
              className="text-blue-600 hover:underline"
            >
              ← 返回
            </button>
            <button
              onClick={() => window.location.href = '/share'}
              className="text-purple-600 hover:underline text-sm"
            >
              📱 生成问卷二维码
            </button>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            👤 患者问卷填写
          </h1>
          <p className="text-gray-600 mt-2">
            {scoliosisQuestionnaire.name} v{scoliosisQuestionnaire.version}
            {templateParam && <span className="ml-2 text-purple-600">(来自分享)</span>}
          </p>
        </div>

        {/* 患者信息 */}
        <section className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📝 基本信息
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                患者 ID *
              </label>
              <input
                type="text"
                value={patientInfo.id}
                onChange={(e) => setPatientInfo(prev => ({ ...prev, id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="如：P12345"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                姓名 *
              </label>
              <input
                type="text"
                value={patientInfo.name}
                onChange={(e) => setPatientInfo(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="如：张三"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                年龄 *
              </label>
              <input
                type="number"
                value={patientInfo.age || ''}
                onChange={(e) => setPatientInfo(prev => ({ ...prev, age: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="如：35"
              />
            </div>
          </div>
        </section>

        {/* 问卷题目 */}
        <section className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            📋 问卷题目
          </h2>
          
          <div className="space-y-6">
            {scoliosisQuestionnaire.questions.map((question) => (
              <div key={question.id} className="border-b border-gray-200 pb-6 last:border-0">
                <div className="flex items-start gap-2 mb-3">
                  <span className="font-medium text-gray-900">
                    {question.id}. {question.title}
                  </span>
                  {question.required && (
                    <span className="text-red-500 text-sm">*</span>
                  )}
                </div>

                {/* 单选题 */}
                {question.type === 'single' && question.options && (
                  <div className="space-y-2">
                    {question.options.map((option) => (
                      <label key={option.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`q${question.id}`}
                          checked={answers[question.id]?.type === 'single' && answers[question.id].value === option.id}
                          onChange={() => handleSingleSelect(question.id, option.id)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-gray-700">{option.label}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* 多选题 */}
                {question.type === 'multiple' && question.options && (
                  <div className="space-y-2">
                    {question.options.map((option) => {
                      const answer = answers[question.id];
                      const isSelected = answer?.type === 'multiple' && 
                        (answer.value as string[]).includes(option.id);
                      return (
                        <label key={option.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleMultiSelect(question.id, option.id, question.maxSelect || 99)}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span className="text-gray-700">{option.label}</span>
                        </label>
                      );
                    })}
                    <p className="text-sm text-gray-500 mt-2">
                      最多可选 {question.maxSelect} 项
                    </p>
                  </div>
                )}

                {/* 数值题 */}
                {question.type === 'numeric' && (
                  <input
                    type="number"
                    value={(answers[question.id]?.type === 'numeric' ? answers[question.id].value : '') as number | ''}
                    onChange={(e) => handleNumericInput(question.id, parseFloat(e.target.value) || 0)}
                    className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder={question.placeholder || '请输入数值'}
                    min={question.min}
                    max={question.max}
                  />
                )}

                {/* 填空题 */}
                {question.type === 'text' && (
                  <TextInput
                    value={(answers[question.id]?.type === 'text' ? answers[question.id].value : '') as string}
                    onChange={(val) => handleTextInput(question.id, val, 'text', question.maxLength || 40)}
                    maxLength={question.maxLength || 40}
                    placeholder={question.placeholder}
                  />
                )}

                {/* 问答题 */}
                {question.type === 'long-text' && (
                  <TextInput
                    value={(answers[question.id]?.type === 'long-text' ? answers[question.id].value : '') as string}
                    onChange={(val) => handleTextInput(question.id, val, 'long-text', question.maxLength || 200)}
                    maxLength={question.maxLength || 200}
                    placeholder={question.placeholder}
                    rows={4}
                  />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 体积信息 */}
        {volumeInfo && (
          <section className="bg-white rounded-xl shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              📊 数据体积
            </h2>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500">原始 JSON</div>
                <div className="text-2xl font-bold text-gray-900">{volumeInfo.rawLength}</div>
                <div className="text-xs text-gray-400">字符</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500">编码后</div>
                <div className="text-2xl font-bold text-gray-900">{volumeInfo.encodedLength}</div>
                <div className="text-xs text-gray-400">字符</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500">压缩后</div>
                <div className={`text-2xl font-bold ${getStatusColor(volumeInfo.status)}`}>
                  {volumeInfo.compressedLength}
                </div>
                <div className="text-xs text-gray-400">字符</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500">压缩率</div>
                <div className="text-2xl font-bold text-green-600">{volumeInfo.compressionRatio}%</div>
                <div className="text-xs text-gray-400">节省</div>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">
                  {getStatusIcon(volumeInfo.status)} 状态
                </span>
                <span className={`font-semibold ${getStatusColor(volumeInfo.status)}`}>
                  {volumeInfo.status === 'safe' && '安全'}
                  {volumeInfo.status === 'warning' && '警告'}
                  {volumeInfo.status === 'exceeded' && '超限'}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    volumeInfo.status === 'safe' ? 'bg-green-500' :
                    volumeInfo.status === 'warning' ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(100, (volumeInfo.compressedLength / 2200) * 100)}%` }}
                />
              </div>
              <div className="mt-2 text-sm text-gray-500">
                剩余容量：{volumeInfo.remainingCapacity} 字符
              </div>
            </div>
          </section>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-4 justify-center mb-8">
          <button
            onClick={() => {
              if (!checkRequired()) return;
              updateVolume();
              generateQRCode();
            }}
            className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            📱 生成数据二维码
          </button>
          <button
            onClick={() => setAnswers({})}
            className="px-8 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
          >
            🔄 重置
          </button>
        </div>

        {/* 二维码展示 */}
        {showQR && qrCodeDataUrl && (
          <section className="bg-white rounded-xl shadow p-8 max-w-md mx-auto">
            <h2 className="text-xl font-semibold text-gray-900 text-center mb-4">
              ✅ 数据二维码已生成
            </h2>
            <div className="flex justify-center mb-4">
              <img src={qrCodeDataUrl} alt="QR Code" className="border rounded-lg" />
            </div>
            <p className="text-sm text-gray-600 text-center mb-4">
              请出示此二维码给医院扫码
            </p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(encodedString);
                  alert('已复制编码字符串');
                }}
                className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                📋 复制编码字符串
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                🏠 返回首页
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

// 文本输入组件（带字数限制）
function TextInput({ 
  value, 
  onChange, 
  maxLength, 
  placeholder,
  rows = 2 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  maxLength: number; 
  placeholder?: string;
  rows?: number;
}) {
  const remaining = maxLength - value.length;
  const isWarning = remaining <= maxLength * 0.2 && remaining > 0;
  const isExceeded = remaining <= 0;

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        rows={rows}
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
          isExceeded ? 'border-red-500' : isWarning ? 'border-yellow-500' : 'border-gray-300'
        }`}
        placeholder={placeholder}
      />
      <div className={`text-sm mt-1 text-right ${
        isExceeded ? 'text-red-600' : isWarning ? 'text-yellow-600' : 'text-gray-500'
      }`}>
        {value.length} / {maxLength} {isExceeded ? '（超限）' : isWarning ? '（接近上限）' : ''}
      </div>
    </div>
  );
}

export default function PatientPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">加载中...</div>}>
      <PatientContent />
    </Suspense>
  );
}
