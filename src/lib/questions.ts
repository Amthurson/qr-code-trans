/**
 * 示例问卷题库
 * 脊柱侧弯预问诊问卷
 */

import type { QuestionnaireTemplate } from '@/types';

export const scoliosisQuestionnaire: QuestionnaireTemplate = {
  id: 'scoliosis-v1',
  name: '脊柱侧弯预问诊问卷',
  version: '1.0',
  questions: [
    {
      id: 1,
      type: 'single',
      title: '您的性别？',
      required: true,
      options: [
        { id: 'M', label: '男' },
        { id: 'F', label: '女' },
      ],
    },
    {
      id: 2,
      type: 'numeric',
      title: '您的年龄？',
      required: true,
      min: 0,
      max: 120,
    },
    {
      id: 3,
      type: 'numeric',
      title: '身高（cm）',
      required: true,
      min: 50,
      max: 250,
    },
    {
      id: 4,
      type: 'numeric',
      title: '体重（kg）',
      required: true,
      min: 2,
      max: 300,
    },
    {
      id: 5,
      type: 'single',
      title: '是否有脊柱侧弯家族史？',
      required: true,
      options: [
        { id: 'A', label: '无' },
        { id: 'B', label: '有（一级亲属）' },
        { id: 'C', label: '有（其他亲属）' },
        { id: 'D', label: '不清楚' },
      ],
    },
    {
      id: 6,
      type: 'multiple',
      title: '以下哪些症状您有？（可多选）',
      required: false,
      maxSelect: 5,
      options: [
        { id: 'A', label: '双肩不等高' },
        { id: 'B', label: '背部不对称' },
        { id: 'C', label: '腰部疼痛' },
        { id: 'D', label: '容易疲劳' },
        { id: 'E', label: '呼吸不畅' },
        { id: 'F', label: '无明显症状' },
      ],
    },
    {
      id: 7,
      type: 'single',
      title: '是否已经确诊过脊柱侧弯？',
      required: true,
      options: [
        { id: 'A', label: '是，已确诊' },
        { id: 'B', label: '疑似，未确诊' },
        { id: 'C', label: '否' },
      ],
    },
    {
      id: 8,
      type: 'numeric',
      title: '如果已确诊，Cobb 角度数是多少？（如未知填 0）',
      required: false,
      min: 0,
      max: 180,
    },
    {
      id: 9,
      type: 'text',
      title: '目前是否在接受治疗？请简述治疗方式。',
      required: false,
      maxLength: 40,
      placeholder: '如：支具治疗、物理治疗、未治疗等',
    },
    {
      id: 10,
      type: 'long-text',
      title: '请描述您的主要不适或担忧（可选）',
      required: false,
      maxLength: 200,
      placeholder: '请详细描述您的症状、担忧或期望...',
    },
  ],
};

// 导出题库列表
export const questionnaires: QuestionnaireTemplate[] = [
  scoliosisQuestionnaire,
];

// 默认导出
export default scoliosisQuestionnaire;
