/**
 * 数据解码器
 * 将二维码字符串解码为可读数据
 */

import type { DecodedData, Question, QuestionnaireTemplate } from '@/types';
import { decompress } from './compressor';
import { decodeQuestionnaire } from './encoder';

/**
 * 解码二维码数据
 */
export function decodeQRCode(
  qrString: string,
  template: QuestionnaireTemplate
): DecodedData {
  try {
    // 尝试直接解码或先解压
    let decoded: {
      patientInfo: { id: string; age: number; gender: 'M' | 'F' };
      answers: Record<number, { type: string; value: any }>;
    };
    
    try {
      // 先尝试直接解码（可能是未压缩格式）
      decoded = decodeQuestionnaire(qrString);
    } catch {
      // 尝试解压后解码
      const decompressed = decompress(qrString);
      decoded = decodeQuestionnaire(decompressed);
    }
    
    // 将答案转换为可读格式
    const answers: DecodedData['answers'] = {};
    
    for (const [questionIdStr, answer] of Object.entries(decoded.answers)) {
      const questionId = parseInt(questionIdStr);
      const question = template.questions.find(q => q.id === questionId);
      
      if (!question) {
        continue;
      }
      
      answers[questionId] = {
        question,
        answer: answer as any,
        displayText: formatAnswerDisplay(answer, question),
      };
    }
    
    return {
      version: 'V2',
      patientInfo: {
        ...decoded.patientInfo,
        name: '', // 解码数据中不包含姓名
      },
      answers,
      isValid: true,
    };
  } catch (error) {
    return {
      version: 'unknown',
      patientInfo: { id: '', name: '', age: 0, gender: 'M' },
      answers: {},
      isValid: false,
      error: error instanceof Error ? error.message : '解码失败',
    };
  }
}

/**
 * 格式化答案显示文本
 */
function formatAnswerDisplay(
  answer: any,
  question: Question
): string {
  switch (answer.type) {
    case 'single': {
      const option = question.options?.find(o => o.id === answer.value);
      return option?.label || answer.value;
    }
    
    case 'multiple': {
      const labels = answer.value
        .map((v: string) => question.options?.find(o => o.id === v)?.label || v)
        .join(', ');
      return labels;
    }
    
    case 'numeric':
      return `${answer.value}`;
    
    case 'text':
    case 'long-text':
      return answer.value;
    
    default:
      return '未知答案';
  }
}

/**
 * 验证数据完整性
 */
export function validateDecodedData(data: DecodedData, template: QuestionnaireTemplate): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 检查必填题
  for (const question of template.questions) {
    if (question.required && !data.answers[question.id]) {
      errors.push(`必填题 ${question.id} 未回答`);
    }
  }
  
  // 检查患者信息
  if (!data.patientInfo.id) {
    warnings.push('患者 ID 缺失');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
