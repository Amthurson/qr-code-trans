// 问卷数据类型定义

/**
 * 题目类型
 */
export type QuestionType = 
  | 'single'      // 单选题
  | 'multiple'    // 多选题
  | 'numeric'     // 数值题
  | 'text'        // 填空题（短文本）
  | 'long-text';  // 问答题（长文本）

/**
 * 选项定义
 */
export interface Option {
  id: string;
  label: string;
}

/**
 * 题目定义
 */
export interface Question {
  id: number;
  type: QuestionType;
  title: string;
  required: boolean;
  options?: Option[];           // 选择题的选项
  maxSelect?: number;           // 多选最大可选数
  maxLength?: number;           // 文本最大长度
  placeholder?: string;         // 输入框占位符
  min?: number;                 // 数值最小值
  max?: number;                 // 数值最大值
}

/**
 * 患者基本信息
 */
export interface PatientInfo {
  id: string;
  name: string;
  age: number;
  gender: 'M' | 'F';
}

/**
 * 答案类型
 */
export type Answer = 
  | { type: 'single'; value: string }
  | { type: 'multiple'; value: string[]; strategy: 'list' | 'bitmap' | 'combo' }
  | { type: 'numeric'; value: number }
  | { type: 'text'; value: string }
  | { type: 'long-text'; value: string };

/**
 * 问卷答案记录
 */
export interface QuestionnaireAnswers {
  patientInfo: PatientInfo;
  answers: Record<number, Answer>;
}

/**
 * 编码后的数据结构
 */
export interface EncodedData {
  version: string;
  patientInfo: string;
  encodedAnswers: string;
  rawLength: number;
  encodedLength: number;
  compressedLength: number;
  compressionRatio: number;
}

/**
 * 体积状态
 */
export type VolumeStatus = 'safe' | 'warning' | 'exceeded';

/**
 * 体积信息
 */
export interface VolumeInfo {
  rawLength: number;
  encodedLength: number;
  compressedLength: number;
  compressionRatio: number;
  status: VolumeStatus;
  remainingCapacity: number;
}

/**
 * 多选题策略分析结果
 */
export interface MultiSelectStrategy {
  optionCount: number;
  selectedCount: number;
  maxSelect: number;
  totalCombinations: number;
  strategies: {
    list: { length: number; encoded: string };
    bitmap: { length: number; encoded: string };
    combo: { length: number; encoded: string; available: boolean };
  };
  recommended: 'list' | 'bitmap' | 'combo';
}

/**
 * 题目体积分析
 */
export interface QuestionVolume {
  questionId: number;
  type: QuestionType;
  charCount: number;
  percentage: number;
}

/**
 * 解码后的数据
 */
export interface DecodedData {
  version: string;
  patientInfo: PatientInfo;
  answers: Record<number, {
    question: Question;
    answer: Answer;
    displayText: string;
  }>;
  isValid: boolean;
  error?: string;
}

/**
 * 题库配置
 */
export interface QuestionnaireTemplate {
  id: string;
  name: string;
  version: string;
  questions: Question[];
}

export type OfflineTransportMode = 'single' | 'fountain';

export interface OfflineIssuePayload {
  version: 'OQX/1';
  transport: 'public-link';
  exchangeId: string;
  maskUuid: string;
  bundleId: string;
  templateIds: string[];
}

export interface OfflineAnswerEntry {
  templateId: string;
  templateLabel?: string;
  questionId: number;
  questionTitle?: string;
  fieldKey: string;
  questionType: QuestionType;
  value: string | number | string[];
}

export interface OfflineImportPayload {
  version: 'OQX/1';
  transport: 'offline-answer';
  exchangeId: string;
  maskUuid: string;
  answerSheetId: string;
  templateIds: string[];
  answers: OfflineAnswerEntry[];
}

export interface OfflineQuestionnaireBundle {
  id: string;
  name: string;
  description: string;
  templateIds: string[];
}

export interface QuestionnaireTransferQuestion extends Question {
  key: string;
  templateId: string;
  templateLabel: string;
  sourceTemplateIds?: string[];
  mergeKey?: string;
}

export interface QuestionnaireTransferFile {
  id: string;
  name: string;
  mimeType: string;
  sizeKb: number;
  summary: string;
}

export interface OfflineQuestionnaireBundlePayload {
  version: 'OQX/1';
  transport: 'questionnaire-bundle';
  exchangeId: string;
  maskUuid: string;
  bundleId: string;
  templateIds: string[];
  questionnaireTitle: string;
  issuedAt: string;
  questions: QuestionnaireTransferQuestion[];
  mockFiles: QuestionnaireTransferFile[];
  notes?: string[];
}

// 容量限制常量
export const CAPACITY_LIMITS = {
  SAFE: 1500,
  MAX: 2200,
} as const;

// 文本长度限制
export const TEXT_LIMITS = {
  SHORT: 40,      // 短填空
  MEDIUM: 120,    // 中文本
  LONG: 200,      // 长问答
} as const;
