/**
 * 极限测试问卷 - 模拟最大容量
 * 测试二维码在 ≤2200 字符内能承载多少问卷数据
 */

import type { QuestionnaireTemplate } from '@/types';

export const stressTestQuestionnaire: QuestionnaireTemplate = {
  id: 'stress-test-v1',
  name: '极限容量测试问卷（40题）',
  version: '1.0',
  questions: [
    // ===== 单选题 x10（每题约 4 字符）=====
    { id: 1, type: 'single', title: '性别', required: true,
      options: [{ id: 'M', label: '男' }, { id: 'F', label: '女' }] },
    { id: 2, type: 'single', title: '婚姻状况', required: true,
      options: [{ id: 'A', label: '未婚' }, { id: 'B', label: '已婚' }, { id: 'C', label: '离异' }, { id: 'D', label: '丧偶' }] },
    { id: 3, type: 'single', title: '教育程度', required: false,
      options: [{ id: 'A', label: '小学' }, { id: 'B', label: '初中' }, { id: 'C', label: '高中' }, { id: 'D', label: '大专' }, { id: 'E', label: '本科' }, { id: 'F', label: '硕士及以上' }] },
    { id: 4, type: 'single', title: '是否有家族遗传病史', required: true,
      options: [{ id: 'A', label: '无' }, { id: 'B', label: '有' }, { id: 'C', label: '不清楚' }] },
    { id: 5, type: 'single', title: '是否吸烟', required: false,
      options: [{ id: 'A', label: '从不' }, { id: 'B', label: '偶尔' }, { id: 'C', label: '经常' }, { id: 'D', label: '已戒' }] },
    { id: 6, type: 'single', title: '饮酒频率', required: false,
      options: [{ id: 'A', label: '从不' }, { id: 'B', label: '偶尔' }, { id: 'C', label: '每周' }, { id: 'D', label: '每天' }] },
    { id: 7, type: 'single', title: '睡眠质量', required: false,
      options: [{ id: 'A', label: '很好' }, { id: 'B', label: '一般' }, { id: 'C', label: '较差' }, { id: 'D', label: '失眠' }] },
    { id: 8, type: 'single', title: '运动频率', required: false,
      options: [{ id: 'A', label: '从不' }, { id: 'B', label: '每周1-2次' }, { id: 'C', label: '每周3-5次' }, { id: 'D', label: '每天' }] },
    { id: 9, type: 'single', title: '疼痛程度 (VAS)', required: true,
      options: [{ id: 'A', label: '无痛(0)' }, { id: 'B', label: '轻微(1-3)' }, { id: 'C', label: '中度(4-6)' }, { id: 'D', label: '重度(7-9)' }, { id: 'E', label: '剧烈(10)' }] },
    { id: 10, type: 'single', title: '既往手术史', required: true,
      options: [{ id: 'A', label: '无' }, { id: 'B', label: '1次' }, { id: 'C', label: '2次' }, { id: 'D', label: '3次以上' }] },

    // ===== 多选题 x8（测试三种编码策略）=====
    // 多选1: 6选5 → 列表/位图/组合 都可能
    { id: 11, type: 'multiple', title: '目前症状（可多选）', required: true, maxSelect: 5,
      options: [
        { id: 'A', label: '双肩不等高' }, { id: 'B', label: '背部不对称' },
        { id: 'C', label: '腰痛' }, { id: 'D', label: '腿痛' },
        { id: 'E', label: '麻木' }, { id: 'F', label: '无力' },
      ] },
    // 多选2: 8选4 → 位图编码优势
    { id: 12, type: 'multiple', title: '过去就诊科室（可多选）', required: false, maxSelect: 4,
      options: [
        { id: 'A', label: '骨科' }, { id: 'B', label: '神经科' },
        { id: 'C', label: '康复科' }, { id: 'D', label: '疼痛科' },
        { id: 'E', label: '中医科' }, { id: 'F', label: '内科' },
        { id: 'G', label: '外科' }, { id: 'H', label: '其他' },
      ] },
    // 多选3: 5选3 → 组合映射可能（C(5,1)+C(5,2)+C(5,3)=25 < 36）
    { id: 13, type: 'multiple', title: '过敏史（可多选）', required: false, maxSelect: 3,
      options: [
        { id: 'A', label: '青霉素' }, { id: 'B', label: '头孢' },
        { id: 'C', label: '磺胺' }, { id: 'D', label: '花粉' },
        { id: 'E', label: '无过敏' },
      ] },
    // 多选4: 10选5 → 位图编码
    { id: 14, type: 'multiple', title: '伴随疾病（可多选）', required: false, maxSelect: 5,
      options: [
        { id: 'A', label: '高血压' }, { id: 'B', label: '糖尿病' },
        { id: 'C', label: '心脏病' }, { id: 'D', label: '哮喘' },
        { id: 'E', label: '甲状腺疾病' }, { id: 'F', label: '肝病' },
        { id: 'G', label: '肾病' }, { id: 'H', label: '贫血' },
        { id: 'I', label: '骨质疏松' }, { id: 'J', label: '无' },
      ] },
    // 多选5: 4选2 → 组合映射（C(4,1)+C(4,2)=10 < 36）
    { id: 15, type: 'multiple', title: '疼痛时间（可多选）', required: false, maxSelect: 2,
      options: [
        { id: 'A', label: '晨起' }, { id: 'B', label: '白天活动后' },
        { id: 'C', label: '夜间' }, { id: 'D', label: '持续性' },
      ] },
    // 多选6: 6选3
    { id: 16, type: 'multiple', title: '加重因素（可多选）', required: false, maxSelect: 3,
      options: [
        { id: 'A', label: '久坐' }, { id: 'B', label: '久站' },
        { id: 'C', label: '弯腰' }, { id: 'D', label: '负重' },
        { id: 'E', label: '天气变化' }, { id: 'F', label: '无明显因素' },
      ] },
    // 多选7: 7选4
    { id: 17, type: 'multiple', title: '目前用药（可多选）', required: false, maxSelect: 4,
      options: [
        { id: 'A', label: '止痛药' }, { id: 'B', label: '消炎药' },
        { id: 'C', label: '肌肉松弛剂' }, { id: 'D', label: '维生素D' },
        { id: 'E', label: '钙片' }, { id: 'F', label: '中药' },
        { id: 'G', label: '无用药' },
      ] },
    // 多选8: 5选5
    { id: 18, type: 'multiple', title: '治疗期望（可多选）', required: false, maxSelect: 5,
      options: [
        { id: 'A', label: '减轻疼痛' }, { id: 'B', label: '改善外观' },
        { id: 'C', label: '恢复功能' }, { id: 'D', label: '预防加重' },
        { id: 'E', label: '了解病情' },
      ] },

    // ===== 数值题 x10（每题约 5-6 字符，base36 编码）=====
    { id: 19, type: 'numeric', title: '年龄', required: true, min: 0, max: 120 },
    { id: 20, type: 'numeric', title: '身高(cm)', required: true, min: 50, max: 250 },
    { id: 21, type: 'numeric', title: '体重(kg)', required: true, min: 2, max: 300 },
    { id: 22, type: 'numeric', title: '腰围(cm)', required: false, min: 40, max: 200 },
    { id: 23, type: 'numeric', title: '血压-收缩压(mmHg)', required: false, min: 60, max: 300 },
    { id: 24, type: 'numeric', title: '血压-舒张压(mmHg)', required: false, min: 30, max: 200 },
    { id: 25, type: 'numeric', title: '心率(次/分)', required: false, min: 30, max: 220 },
    { id: 26, type: 'numeric', title: 'Cobb角(度)', required: false, min: 0, max: 180 },
    { id: 27, type: 'numeric', title: 'ATR胸椎(度)', required: false, min: 0, max: 90 },
    { id: 28, type: 'numeric', title: 'ATR腰椎(度)', required: false, min: 0, max: 90 },

    // ===== 填空题 x6（每题限制 20-30 字）=====
    { id: 29, type: 'text', title: '主要诊断', required: false, maxLength: 25, placeholder: '如：特发性脊柱侧弯' },
    { id: 30, type: 'text', title: '当前治疗方案', required: false, maxLength: 25, placeholder: '如：支具治疗' },
    { id: 31, type: 'text', title: '过敏药物名称', required: false, maxLength: 20, placeholder: '如：阿莫西林' },
    { id: 32, type: 'text', title: '手术名称(如有)', required: false, maxLength: 25, placeholder: '如：脊柱矫形术' },
    { id: 33, type: 'text', title: '转诊来源', required: false, maxLength: 20, placeholder: '如：XX医院骨科' },
    { id: 34, type: 'text', title: '紧急联系人', required: false, maxLength: 20, placeholder: '如：张三 13800138000' },

    // ===== 问答题 x6（限制 40-80 字）=====
    { id: 35, type: 'long-text', title: '主要不适描述', required: false, maxLength: 60, placeholder: '描述主要症状...' },
    { id: 36, type: 'long-text', title: '病情发展过程', required: false, maxLength: 60, placeholder: '简述病情发展...' },
    { id: 37, type: 'long-text', title: '既往治疗效果', required: false, maxLength: 50, placeholder: '描述治疗效果...' },
    { id: 38, type: 'long-text', title: '日常生活影响', required: false, maxLength: 50, placeholder: '对生活的影响...' },
    { id: 39, type: 'long-text', title: '特殊诉求', required: false, maxLength: 40, placeholder: '特殊需求...' },
    { id: 40, type: 'long-text', title: '其他补充信息', required: false, maxLength: 40, placeholder: '其他信息...' },
  ],
};

/**
 * 生成极限测试数据（所有题目都填满答案）
 */
export function generateStressTestData() {
  return {
    patientInfo: {
      id: 'P99001',
      name: '测试患者',
      age: 35,
      gender: 'M' as const,
    },
    answers: {
      // 10 个单选题
      1: { type: 'single' as const, value: 'M' },
      2: { type: 'single' as const, value: 'B' },
      3: { type: 'single' as const, value: 'E' },
      4: { type: 'single' as const, value: 'A' },
      5: { type: 'single' as const, value: 'A' },
      6: { type: 'single' as const, value: 'B' },
      7: { type: 'single' as const, value: 'B' },
      8: { type: 'single' as const, value: 'C' },
      9: { type: 'single' as const, value: 'C' },
      10: { type: 'single' as const, value: 'A' },

      // 8 个多选题（测试不同策略）
      11: { type: 'multiple' as const, value: ['A', 'B', 'C', 'E'], strategy: 'list' as const },
      12: { type: 'multiple' as const, value: ['A', 'C', 'E', 'F'], strategy: 'bitmap' as const },
      13: { type: 'multiple' as const, value: ['A', 'C'], strategy: 'combo' as const },
      14: { type: 'multiple' as const, value: ['A', 'B', 'I'], strategy: 'bitmap' as const },
      15: { type: 'multiple' as const, value: ['A', 'C'], strategy: 'combo' as const },
      16: { type: 'multiple' as const, value: ['A', 'C', 'D'], strategy: 'list' as const },
      17: { type: 'multiple' as const, value: ['A', 'B', 'E'], strategy: 'list' as const },
      18: { type: 'multiple' as const, value: ['A', 'B', 'C', 'D', 'E'], strategy: 'bitmap' as const },

      // 10 个数值题
      19: { type: 'numeric' as const, value: 35 },
      20: { type: 'numeric' as const, value: 168 },
      21: { type: 'numeric' as const, value: 65 },
      22: { type: 'numeric' as const, value: 82 },
      23: { type: 'numeric' as const, value: 128 },
      24: { type: 'numeric' as const, value: 82 },
      25: { type: 'numeric' as const, value: 72 },
      26: { type: 'numeric' as const, value: 35 },
      27: { type: 'numeric' as const, value: 12 },
      28: { type: 'numeric' as const, value: 8 },

      // 6 个填空题（每题写满）
      29: { type: 'text' as const, value: '青少年特发性脊柱侧弯AIS' },
      30: { type: 'text' as const, value: 'Boston支具+物理治疗' },
      31: { type: 'text' as const, value: '青霉素、头孢类' },
      32: { type: 'text' as const, value: '后路脊柱矫形内固定术' },
      33: { type: 'text' as const, value: '市第一人民医院骨科' },
      34: { type: 'text' as const, value: '张三 13812345678' },

      // 6 个问答题（每题写满）
      35: { type: 'long-text' as const, value: '右侧背部隆起明显，站立时躯干向左偏移约2cm，久坐后腰部酸痛加重，影响学习注意力' },
      36: { type: 'long-text' as const, value: '12岁体检发现侧弯，Cobb角20度，近一年增至35度，生长期快速进展' },
      37: { type: 'long-text' as const, value: '支具佩戴1年，角度稳定但外观改善不明显，物理治疗有轻度缓解' },
      38: { type: 'long-text' as const, value: '无法长时间坐着学习，体育课受限，对外观有心理压力' },
      39: { type: 'long-text' as const, value: '希望了解手术方案和风险，暑假是否适合手术' },
      40: { type: 'long-text' as const, value: '家族中母亲有轻度侧弯，月经已初潮半年' },
    },
  };
}
