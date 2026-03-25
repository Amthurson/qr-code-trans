/**
 * 问卷数据编码器
 * 将问卷答案编码为紧凑的字符串格式
 */

import type { Answer, Question, MultiSelectStrategy } from '@/types';

/**
 * 将答案编码为字符串
 */
export function encodeAnswer(questionId: number, answer: Answer): string {
  switch (answer.type) {
    case 'single':
      // 单选：1:SA
      return `${questionId}:S${answer.value}`;
    
    case 'multiple':
      // 多选：根据策略编码
      return encodeMultiple(questionId, answer);
    
    case 'numeric':
      // 数值：2:N1A (base36)
      return `${questionId}:N${toBase36(answer.value)}`;
    
    case 'text':
    case 'long-text':
      // 文本：3:Txxx (URI encode)
      const prefix = answer.type === 'text' ? 'T' : 'L';
      return `${questionId}:${prefix}${encodeURIComponent(answer.value)}`;
    
    default:
      throw new Error(`Unknown answer type: ${(answer as any).type}`);
  }
}

/**
 * 多选题编码（核心功能）
 */
function encodeMultiple(questionId: number, answer: Answer & { type: 'multiple' }): string {
  const { value: selected, strategy } = answer;
  
  switch (strategy) {
    case 'list':
      // 列表编码：MLABC
      return `${questionId}:ML${selected.sort().join('')}`;
    
    case 'bitmap':
      // 位图编码：MB1F
      return `${questionId}:MB${selectedToBitmap(selected)}`;
    
    case 'combo':
      // 组合映射：MC5
      return `${questionId}:MC${comboToIndex(selected)}`;
    
    default:
      throw new Error(`Unknown strategy: ${strategy}`);
  }
}

/**
 * 计算多选题最佳编码策略
 */
export function calculateMultiSelectStrategy(
  selected: string[],
  allOptions: string[],
  maxSelect: number
): MultiSelectStrategy {
  const n = allOptions.length;
  const k = selected.length;
  
  // 计算组合总数
  let totalCombinations = 0;
  for (let i = 1; i <= Math.min(maxSelect, n); i++) {
    totalCombinations += combinations(n, i);
  }
  
  // 列表编码长度 = 已选数量
  const listLength = k;
  const listEncoded = selected.sort().join('');
  
  // 位图编码长度 ≈ n * log₂ / log₃₆
  const bitmapValue = selectedToBitmap(selected);
  const bitmapLength = bitmapValue.length;
  
  // 组合映射可用性判断
  const comboAvailable = totalCombinations <= 1296 && n <= 12;
  const comboLength = totalCombinations <= 36 ? 1 : 2;
  const comboEncoded = comboAvailable ? comboToIndex(selected).toString() : '';
  
  // 选择最短的策略
  let recommended: 'list' | 'bitmap' | 'combo' = 'list';
  let minLength = listLength;
  
  if (bitmapLength < minLength) {
    minLength = bitmapLength;
    recommended = 'bitmap';
  }
  
  if (comboAvailable && comboLength < minLength) {
    recommended = 'combo';
  }
  
  return {
    optionCount: n,
    selectedCount: k,
    maxSelect,
    totalCombinations,
    strategies: {
      list: { length: listLength, encoded: listEncoded },
      bitmap: { length: bitmapLength, encoded: bitmapValue },
      combo: { length: comboLength, encoded: comboEncoded, available: comboAvailable },
    },
    recommended,
  };
}

/**
 * 数值转 Base36
 */
export function toBase36(num: number): string {
  if (num < 0) return `n${Math.abs(num).toString(36).toUpperCase()}`;
  return num.toString(36).toUpperCase();
}

/**
 * Base36 转数值
 */
export function fromBase36(str: string): number {
  if (str.startsWith('n')) {
    return -parseInt(str.slice(1), 36);
  }
  return parseInt(str, 36);
}

/**
 * 将选中项转换为位图（base36 编码）
 */
function selectedToBitmap(selected: string[]): string {
  // 假设选项按字母顺序 A=0, B=1, C=2...
  let bitmap = 0;
  for (const opt of selected) {
    const index = opt.charCodeAt(0) - 'A'.charCodeAt(0);
    bitmap |= (1 << index);
  }
  return bitmap.toString(36).toUpperCase();
}

/**
 * 将位图转换回选中项
 */
export function bitmapToSelected(bitmapStr: string): string[] {
  const bitmap = parseInt(bitmapStr, 36);
  const selected: string[] = [];
  for (let i = 0; i < 26; i++) {
    if (bitmap & (1 << i)) {
      selected.push(String.fromCharCode('A'.charCodeAt(0) + i));
    }
  }
  return selected;
}

/**
 * 组合映射：将选中组合映射到索引
 * 仅适用于小组合数的场景
 */
function comboToIndex(selected: string[]): number {
  // 简化实现：将排序后的选项连接作为 key
  // 实际应用中需要预定义组合映射表
  const key = selected.sort().join('');
  return simpleHash(key);
}

/**
 * 简单哈希函数（用于组合映射）
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 1296;
}

/**
 * 计算组合数 C(n, k)
 */
function combinations(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1);
  }
  return result;
}

/**
 * 将完整答案对象编码为结构化字符串
 */
export function encodeQuestionnaire(
  patientInfo: { id: string; age: number; gender: string },
  answers: Record<number, Answer>
): string {
  const parts: string[] = [];
  
  // 版本
  parts.push('V2');
  
  // 患者信息
  parts.push(`P:${patientInfo.id}`);
  parts.push(`A:${patientInfo.age}`);
  parts.push(`S:${patientInfo.gender}`);
  
  // 答案（按题号排序）
  const sortedIds = Object.keys(answers).map(Number).sort((a, b) => a - b);
  for (const id of sortedIds) {
    parts.push(encodeAnswer(id, answers[id]));
  }
  
  return parts.join('|');
}

/**
 * 解码结构化字符串
 */
export function decodeQuestionnaire(encoded: string): {
  patientInfo: { id: string; age: number; gender: 'M' | 'F' };
  answers: Record<number, Answer>;
} {
  const parts = encoded.split('|');
  
  if (parts.length < 4) {
    throw new Error('Invalid encoded data format');
  }
  
  const version = parts[0];
  if (!version.startsWith('V')) {
    throw new Error('Invalid version');
  }
  
  const patientInfo = {
    id: '',
    age: 0,
    gender: 'M' as 'M' | 'F',
  };
  const answers: Record<number, Answer> = {};
  
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    
    const colonIndex = part.indexOf(':');
    if (colonIndex === -1) continue;
    
    const key = part.slice(0, colonIndex);
    const value = part.slice(colonIndex + 1);
    
    if (key === 'P') {
      patientInfo.id = value;
    } else if (key === 'A') {
      patientInfo.age = parseInt(value);
    } else if (key === 'S' && value.length === 1) {
      patientInfo.gender = value as 'M' | 'F';
    } else if (/^\d+$/.test(key)) {
      // 题目答案
      const questionId = parseInt(key);
      answers[questionId] = decodeAnswer(questionId, part);
    }
  }
  
  return { patientInfo, answers };
}

/**
 * 解码单个答案
 */
function decodeAnswer(questionId: number, encoded: string): Answer {
  const colonIndex = encoded.indexOf(':');
  if (colonIndex === -1) {
    throw new Error(`Invalid answer format for question ${questionId}`);
  }
  
  const typeCode = encoded.slice(colonIndex + 1, colonIndex + 2);
  const valueStr = encoded.slice(colonIndex + 2);
  
  switch (typeCode) {
    case 'S':
      return { type: 'single', value: valueStr };
    
    case 'N':
      return { type: 'numeric', value: fromBase36(valueStr) };
    
    case 'T':
      return { type: 'text', value: decodeURIComponent(valueStr) };
    
    case 'L':
      return { type: 'long-text', value: decodeURIComponent(valueStr) };
    
    case 'M':
      // 多选
      const multiType = valueStr[0];
      const multiValue = valueStr.slice(1);
      
      if (multiType === 'L') {
        return { type: 'multiple', value: multiValue.split(''), strategy: 'list' };
      } else if (multiType === 'B') {
        return { type: 'multiple', value: bitmapToSelected(multiValue), strategy: 'bitmap' };
      } else if (multiType === 'C') {
        // 组合映射需要反向查找，这里简化处理
        return { type: 'multiple', value: [], strategy: 'combo' };
      }
      throw new Error(`Unknown multi-select type: ${multiType}`);
    
    default:
      throw new Error(`Unknown answer type code: ${typeCode}`);
  }
}
