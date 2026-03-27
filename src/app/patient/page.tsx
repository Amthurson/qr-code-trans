/**
 * 患者端 - 填写问卷并生成喷泉码二维码
 * 基于 Qrs 项目的 Luby Transform 实现
 */

'use client'

import { useState, useCallback } from 'react'
import { useQrFountain } from '@/hooks/useQrFountain'
import QrCodeDisplay from '@/components/QrCodeDisplay'
import { scoliosisQuestionnaire } from '@/lib/questions'
import type { QuestionnaireAnswers, Answer } from '@/types'

export default function PatientPage() {
  const [answers, setAnswers] = useState<Record<number, Answer>>({})
  const [generatedData, setGeneratedData] = useState<Uint8Array | null>(null)

  // 处理答案变化
  const handleAnswerChange = useCallback((questionId: number, value: Answer) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value,
    }))
  }, [])

  // 生成问卷数据
  const generateQuestionnaireData = useCallback(() => {
    // 将答案转换为 JSON 字符串
    const jsonData = JSON.stringify({
      version: '2.0',
      type: 'questionnaire',
      timestamp: Date.now(),
      answers,
    })

    // 转换为 Uint8Array
    const data = new TextEncoder().encode(jsonData)
    setGeneratedData(data)
  }, [answers])

  // 使用喷泉码生成二维码
  const {
    qrData,
    block,
    count,
    fps,
    bitrate,
    totalBytes,
    isReady,
    error,
  } = useQrFountain({
    data: generatedData || '',
    sliceSize: 1000,
    compress: true,
    fps: 20,
  })

  // 计算容量状态
  const getCapacityStatus = () => {
    if (!block) return { status: 'safe', text: '等待生成', color: 'text-gray-600' }
    
    // 估算压缩后大小
    const estimatedSize = totalBytes
    if (estimatedSize < 1500) {
      return { status: 'safe', text: '🟢 安全', color: 'text-green-600' }
    } else if (estimatedSize < 2200) {
      return { status: 'warning', text: '🟡 警告', color: 'text-yellow-600' }
    } else {
      return { status: 'danger', text: '🔴 超限', color: 'text-red-600' }
    }
  }

  const capacityStatus = getCapacityStatus()

  // 检查是否所有必填题都已回答
  const allRequiredAnswered = scoliosisQuestionnaire.questions
    .filter(q => q.required)
    .every(q => answers[q.id] !== undefined)

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* 头部 */}
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            👤 患者端 - 问卷填写
          </h1>
          <p className="text-gray-600">
            填写问卷后，系统将生成二维码序列，医院扫码即可还原数据
          </p>
        </header>

        {/* 问卷表单 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            📋 脊柱侧弯预问诊问卷
          </h2>

          <div className="space-y-6">
            {scoliosisQuestionnaire.questions.map((question) => (
              <div key={question.id} className="border-b pb-4 last:border-0">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {question.id}. {question.title}
                  {question.required && <span className="text-red-500 ml-1">*</span>}
                </label>

                {question.type === 'single' && (
                  <div className="space-y-2">
                    {question.options?.map((option) => (
                      <label key={option.id} className="flex items-center">
                        <input
                          type="radio"
                          name={`q${question.id}`}
                          value={option.id}
                          checked={answers[question.id]?.type === 'single' && answers[question.id].value === option.id}
                          onChange={() => handleAnswerChange(question.id, { type: 'single', value: option.id })}
                          className="h-4 w-4 text-blue-600"
                        />
                        <span className="ml-2 text-gray-700">{option.label}</span>
                      </label>
                    ))}
                  </div>
                )}

                {question.type === 'multiple' && (
                  <div className="space-y-2">
                    {question.options?.map((option) => {
                      const currentValue = answers[question.id]
                      const isSelected = currentValue?.type === 'multiple' && currentValue.value.includes(option.id)
                      
                      return (
                        <label key={option.id} className="flex items-center">
                          <input
                            type="checkbox"
                            value={option.id}
                            checked={isSelected}
                            onChange={(e) => {
                              const current = (currentValue?.type === 'multiple' ? currentValue.value : [])
                              const next = e.target.checked
                                ? [...current, option.id]
                                : current.filter(v => v !== option.id)
                              handleAnswerChange(question.id, { 
                                type: 'multiple', 
                                value: next,
                                strategy: 'list',
                              })
                            }}
                            className="h-4 w-4 text-blue-600 rounded"
                          />
                          <span className="ml-2 text-gray-700">{option.label}</span>
                        </label>
                      )
                    })}
                  </div>
                )}

                {question.type === 'numeric' && (
                  <input
                    type="number"
                    value={(answers[question.id]?.type === 'numeric' ? answers[question.id].value : '') as number}
                    onChange={(e) => handleAnswerChange(question.id, { 
                      type: 'numeric', 
                      value: parseFloat(e.target.value) || 0,
                    })}
                    placeholder={`请输入${'数值'}`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}

                {question.type === 'text' && (
                  <textarea
                    value={(answers[question.id]?.type === 'text' ? answers[question.id].value : '') as string}
                    onChange={(e) => handleAnswerChange(question.id, { 
                      type: 'text', 
                      value: e.target.value,
                    })}
                    placeholder="请输入回答"
                    rows={3}
                    maxLength={question.maxLength || 200}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}

                {question.type === 'long-text' && (
                  <textarea
                    value={(answers[question.id]?.type === 'long-text' ? answers[question.id].value : '') as string}
                    onChange={(e) => handleAnswerChange(question.id, { 
                      type: 'long-text', 
                      value: e.target.value,
                    })}
                    placeholder="请详细描述"
                    rows={5}
                    maxLength={question.maxLength || 500}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}

                {/* 字数统计 */}
                {(question.type === 'text' || question.type === 'long-text') && (
                  <p className="text-xs text-gray-500 mt-1 text-right">
                    {String(answers[question.id]?.type === 'text' || answers[question.id]?.type === 'long-text' 
                      ? answers[question.id].value 
                      : '').length} / {question.maxLength || 200}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* 生成按钮 */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={generateQuestionnaireData}
              disabled={!allRequiredAnswered}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              生成二维码
            </button>
          </div>
        </div>

        {/* 二维码显示区域 */}
        {generatedData && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              📱 扫描二维码（喷泉码模式）
            </h2>

            {/* 状态信息 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <p className="text-sm text-gray-500">已生成帧数</p>
                <p className="text-2xl font-bold text-blue-600">{count}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">实时 FPS</p>
                <p className="text-2xl font-bold text-green-600">{fps.toFixed(1)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">数据大小</p>
                <p className="text-2xl font-bold text-purple-600">{(totalBytes / 1024).toFixed(2)} KB</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">容量状态</p>
                <p className={`text-2xl font-bold ${capacityStatus.color}`}>{capacityStatus.text}</p>
              </div>
            </div>

            {/* 二维码显示 */}
            {qrData && (
              <div className="flex justify-center mb-6">
                <QrCodeDisplay
                  data={qrData}
                  size={280}
                  border={4}
                  className="max-w-sm"
                />
              </div>
            )}

            {/* 使用说明 */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2">📖 使用说明</h3>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                <li>保持手机屏幕常亮，二维码会自动刷新</li>
                <li>医院端使用摄像头连续扫描</li>
                <li>扫描进度达到 100% 后自动完成解码</li>
                <li>喷泉码特性：无需按顺序，任意帧都可解码</li>
              </ol>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">❌ 错误：{error.message}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
