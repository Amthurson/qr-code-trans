/**
 * 体积计算模块
 * 实时计算和监控二维码数据体积
 */

import type { VolumeInfo, QuestionVolume, Question, Answer } from '@/types';
import { CAPACITY_LIMITS } from '@/types';
import { encodeQuestionnaire } from './encoder';
import { compress } from './compressor';

/**
 * 计算总体积信息
 */
export function calculateVolume(
  patientInfo: { id: string; age: number; gender: string },
  answers: Record<number, Answer>
): VolumeInfo {
  // 原始 JSON 长度（估算）
  const rawData = JSON.stringify({ patientInfo, answers });
  const rawLength = rawData.length;
  
  // 编码后长度
  const encoded = encodeQuestionnaire(patientInfo, answers);
  const encodedLength = encoded.length;
  
  // 压缩后长度
  const compressed = compress(encoded);
  const compressedLength = compressed.length;
  
  // 压缩率
  const compressionRatio = Math.round((1 - compressedLength / rawLength) * 100);
  
  // 状态判断
  let status: VolumeInfo['status'] = 'safe';
  if (compressedLength >= CAPACITY_LIMITS.MAX) {
    status = 'exceeded';
  } else if (compressedLength >= CAPACITY_LIMITS.SAFE) {
    status = 'warning';
  }
  
  // 剩余容量
  const remainingCapacity = Math.max(0, CAPACITY_LIMITS.SAFE - compressedLength);
  
  return {
    rawLength,
    encodedLength,
    compressedLength,
    compressionRatio,
    status,
    remainingCapacity,
  };
}

/**
 * 计算单个题目的体积贡献
 */
export function calculateQuestionVolume(
  questionId: number,
  answer: Answer | undefined,
  question: Question,
  totalCompressedLength: number
): QuestionVolume {
  if (!answer) {
    return {
      questionId,
      type: question.type,
      charCount: 0,
      percentage: 0,
    };
  }
  
  // 估算该题的编码长度
  let charCount = 0;
  
  switch (answer.type) {
    case 'single':
      charCount = 3 + answer.value.length; // "1:SA"
      break;
    
    case 'multiple':
      if (answer.strategy === 'list') {
        charCount = 4 + answer.value.length; // "1:MLABC"
      } else if (answer.strategy === 'bitmap') {
        charCount = 4 + Math.ceil(question.options!.length / 5); // 位图
      } else {
        charCount = 4 + 2; // 组合映射
      }
      break;
    
    case 'numeric':
      charCount = 4 + answer.value.toString(36).length;
      break;
    
    case 'text':
    case 'long-text':
      charCount = 4 + encodeURIComponent(answer.value).length;
      break;
  }
  
  // 计算占比
  const percentage = totalCompressedLength > 0 
    ? Math.round((charCount / totalCompressedLength) * 100) 
    : 0;
  
  return {
    questionId,
    type: question.type,
    charCount,
    percentage,
  };
}

/**
 * 计算所有题目的体积分析
 */
export function calculateAllQuestionVolumes(
  questions: Question[],
  answers: Record<number, Answer>,
  totalCompressedLength: number
): QuestionVolume[] {
  return questions.map(q => 
    calculateQuestionVolume(q.id, answers[q.id], q, totalCompressedLength)
  );
}

/**
 * 获取状态颜色
 */
export function getStatusColor(status: VolumeInfo['status']): string {
  switch (status) {
    case 'safe':
      return 'text-green-600';
    case 'warning':
      return 'text-yellow-600';
    case 'exceeded':
      return 'text-red-600';
  }
}

/**
 * 获取状态图标
 */
export function getStatusIcon(status: VolumeInfo['status']): string {
  switch (status) {
    case 'safe':
      return '🟢';
    case 'warning':
      return '🟡';
    case 'exceeded':
      return '🔴';
  }
}

/**
 * 检查文本是否超限
 */
export function checkTextLimit(
  text: string,
  limit: number
): {
  current: number;
  max: number;
  remaining: number;
  isExceeded: boolean;
  isWarning: boolean;
} {
  const current = text.length;
  const remaining = limit - current;
  const isExceeded = current > limit;
  const isWarning = current > limit * 0.8 && !isExceeded;
  
  return {
    current,
    max: limit,
    remaining: Math.max(0, remaining),
    isExceeded,
    isWarning,
  };
}
