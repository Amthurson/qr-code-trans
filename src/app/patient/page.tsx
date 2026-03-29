'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import QrCodeDisplay from '@/components/QrCodeDisplay';
import { useQrFountain } from '@/hooks/useQrFountain';
import {
  buildOfflineImportEnvelope,
  buildOfflineIssueEnvelope,
  parseOfflineIssueTicket,
  serializeOfflineAnswers,
} from '@/lib/offline-questionnaire';
import { findBundleById, resolveTemplates } from '@/lib/questions';
import type { Answer, OfflineIssuePayload, Question, QuestionnaireTemplate } from '@/types';

const DEFAULT_ORIGIN = 'https://qr-trans.test.conova.withinfuel.com';
const DEFAULT_BUNDLE = 'STUDIO-QUESTIONNAIRE-BUNDLE';
const DEFAULT_TEMPLATE = ['scoliosis-v1'];

function keyOf(templateId: string, questionId: number): string {
  return `${templateId}:${questionId}`;
}

function isFilled(answer?: Answer): boolean {
  if (!answer) return false;
  if (answer.type === 'multiple') return answer.value.length > 0;
  if (answer.type === 'text' || answer.type === 'long-text') return answer.value.trim().length > 0;
  return true;
}

function placeholderOf(question: Question): string {
  if (question.placeholder) return question.placeholder;
  if (question.type === 'numeric') return '请输入数值';
  return question.type === 'long-text' ? '请详细描述' : '请输入回答';
}

function modeText(mode: 'single' | 'fountain'): string {
  return mode === 'single' ? '单码回传' : '喷泉码回传';
}

export default function PatientPage() {
  const searchParams = useSearchParams();
  const ticket = searchParams.get('ticket') || '';
  const bundleId = searchParams.get('bundleId') || DEFAULT_BUNDLE;
  const templateIds = (searchParams.get('template') || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const fallbackTemplateIds = templateIds.length > 0 ? templateIds : DEFAULT_TEMPLATE;

  const [origin, setOrigin] = useState(DEFAULT_ORIGIN);
  const [previewIssue, setPreviewIssue] = useState(() => buildOfflineIssueEnvelope({
    bundleId,
    templateIds: fallbackTemplateIds,
    publicBaseUrl: `${DEFAULT_ORIGIN}/patient`,
  }));
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [submission, setSubmission] = useState<ReturnType<typeof buildOfflineImportEnvelope> | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    setPreviewIssue(buildOfflineIssueEnvelope({
      bundleId,
      templateIds: fallbackTemplateIds,
      publicBaseUrl: `${origin}/patient`,
    }));
  }, [bundleId, fallbackTemplateIds.join(','), origin]);

  let issue: OfflineIssuePayload = previewIssue.issuePayload;
  let issueError = '';
  let issueWarning = '当前为本地预览会话，可直接联调公网填写页。';
  let source = 'preview';

  if (ticket) {
    try {
      issue = parseOfflineIssueTicket(ticket);
      issueWarning = '';
      source = 'ticket';
    } catch (error) {
      issueError = error instanceof Error ? error.message : '发放码解析失败';
      issueWarning = '已回退到本地预览问卷。';
    }
  }

  const bundle = findBundleById(issue.bundleId);
  const resolvedTemplateIds = issue.templateIds.length > 0
    ? issue.templateIds
    : bundle?.templateIds?.length
      ? bundle.templateIds
      : fallbackTemplateIds;
  const templates = resolveTemplates(resolvedTemplateIds);
  const missingTemplates = resolvedTemplateIds.filter((id) => !templates.find((item) => item.id === id));
  const requiredTotal = templates.reduce((sum, template) => sum + template.questions.filter((item) => item.required).length, 0);
  const requiredDone = templates.reduce((sum, template) => sum + template.questions.filter((question) => {
    return question.required && isFilled(answers[keyOf(template.id, question.id)]);
  }).length, 0);
  const canSubmit = templates.length > 0 && requiredTotal > 0 && requiredTotal === requiredDone;

  useEffect(() => {
    setAnswers({});
    setSubmission(null);
  }, [issue.exchangeId, issue.maskUuid, resolvedTemplateIds.join(',')]);

  const fountain = useQrFountain({
    data: submission?.mode === 'fountain' ? submission.token : '',
    compress: false,
    sliceSize: 900,
    fps: 12,
  });

  const updateAnswer = (templateId: string, questionId: number, answer?: Answer) => {
    const answerKey = keyOf(templateId, questionId);
    setAnswers((current) => {
      if (!answer) {
        const next = { ...current };
        delete next[answerKey];
        return next;
      }
      return { ...current, [answerKey]: answer };
    });
    setSubmission(null);
  };

  const answerEntries = serializeOfflineAnswers(answers);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600">offline public fill</div>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">公网患者填写页</h1>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                院内仅发放脱敏问卷票据，患者在公网填写，完成后生成 `offline-answer` 回传码。
              </p>
            </div>
            <div className="grid min-w-[260px] gap-3 rounded-2xl bg-slate-950 p-4 text-sm text-slate-200">
              <div>来源：{source === 'ticket' ? '院内发放码' : '本地预览'}</div>
              <div>bundleId：<span className="font-mono">{issue.bundleId}</span></div>
              <div>exchangeId：<span className="font-mono break-all">{issue.exchangeId}</span></div>
              <div>maskUuid：<span className="font-mono break-all">{issue.maskUuid}</span></div>
              <div>模板：{resolvedTemplateIds.join(', ')}</div>
            </div>
          </div>
          {(issueError || issueWarning || missingTemplates.length > 0) && (
            <div className="mt-4 space-y-2 text-sm">
              {issueError && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-rose-700">发放码解析失败：{issueError}</div>}
              {issueWarning && <div className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-700">{issueWarning}</div>}
              {missingTemplates.length > 0 && (
                <div className="rounded-2xl bg-slate-100 px-4 py-3 text-slate-700">
                  本地镜像缺少模板：{missingTemplates.join(', ')}
                </div>
              )}
            </div>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <section className="space-y-6">
            {templates.map((template: QuestionnaireTemplate) => (
              <div key={template.id} className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{template.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">templateId: {template.id}</p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{template.questions.length} 题</div>
                </div>
                <div className="space-y-4">
                  {template.questions.map((question) => {
                    const answer = answers[keyOf(template.id, question.id)];
                    return (
                      <div key={keyOf(template.id, question.id)} className="rounded-2xl border border-slate-200 p-4">
                        <label className="mb-3 block text-sm font-semibold text-slate-900">
                          {question.id}. {question.title}
                          {question.required && <span className="ml-1 text-rose-500">*</span>}
                        </label>
                        {question.type === 'single' && (
                          <div className="space-y-2">
                            {question.options?.map((option) => (
                              <label key={option.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                <input
                                  type="radio"
                                  name={keyOf(template.id, question.id)}
                                  checked={answer?.type === 'single' && answer.value === option.id}
                                  onChange={() => updateAnswer(template.id, question.id, { type: 'single', value: option.id })}
                                  className="h-4 w-4 accent-sky-600"
                                />
                                <span>{option.label}</span>
                              </label>
                            ))}
                          </div>
                        )}
                        {question.type === 'multiple' && (
                          <div className="space-y-2">
                            {question.options?.map((option) => {
                              const current = answer?.type === 'multiple' ? answer.value : [];
                              return (
                                <label key={option.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={current.includes(option.id)}
                                    onChange={(event) => {
                                      const next = event.target.checked
                                        ? [...current, option.id]
                                        : current.filter((item) => item !== option.id);
                                      updateAnswer(
                                        template.id,
                                        question.id,
                                        next.length > 0 ? { type: 'multiple', value: next, strategy: 'list' } : undefined
                                      );
                                    }}
                                    className="h-4 w-4 accent-sky-600"
                                  />
                                  <span>{option.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                        {question.type === 'numeric' && (
                          <input
                            type="number"
                            value={answer?.type === 'numeric' ? answer.value : ''}
                            min={question.min}
                            max={question.max}
                            onChange={(event) => updateAnswer(
                              template.id,
                              question.id,
                              event.target.value === '' ? undefined : { type: 'numeric', value: Number(event.target.value) }
                            )}
                            placeholder={placeholderOf(question)}
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
                          />
                        )}
                        {(question.type === 'text' || question.type === 'long-text') && (
                          <>
                            <textarea
                              value={(answer?.type === 'text' || answer?.type === 'long-text') ? answer.value : ''}
                              rows={question.type === 'long-text' ? 5 : 3}
                              maxLength={question.maxLength || 200}
                              onChange={(event) => updateAnswer(
                                template.id,
                                question.id,
                                event.target.value === ''
                                  ? undefined
                                  : question.type === 'text'
                                    ? { type: 'text', value: event.target.value }
                                    : { type: 'long-text', value: event.target.value }
                              )}
                              placeholder={placeholderOf(question)}
                              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
                            />
                            <div className="mt-2 text-right text-xs text-slate-500">
                              {(answer?.type === 'text' || answer?.type === 'long-text') ? answer.value.length : 0} / {question.maxLength || 200}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {templates.length === 0 && <div className="rounded-3xl bg-white p-10 text-center text-sm text-slate-500 shadow-sm">当前没有可用模板。</div>}
          </section>

          <aside className="space-y-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">回传摘要</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-slate-950 p-4 text-slate-100">必填完成：{requiredDone} / {requiredTotal}</div>
                <div className="rounded-2xl bg-sky-50 p-4 text-sky-900">已答题数：{answerEntries.length}</div>
              </div>
              <button
                onClick={() => setSubmission(buildOfflineImportEnvelope({
                  exchangeId: issue.exchangeId,
                  maskUuid: issue.maskUuid,
                  templateIds: resolvedTemplateIds,
                  answers: answerEntries,
                }))}
                disabled={!canSubmit}
                className="mt-5 w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                生成回传码
              </button>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                回传内容仅包含 `exchangeId`、`maskUuid`、`templateIds` 和答案值，不含实名信息。
              </p>
            </section>

            {submission && (
              <section className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-slate-900">回传载荷</h2>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{modeText(submission.mode)}</div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-slate-600">
                  <div className="rounded-2xl bg-slate-50 p-3">长度 {submission.size}</div>
                  <div className="rounded-2xl bg-slate-50 p-3">预计 {submission.estimatedFrames} 帧</div>
                  <div className="rounded-2xl bg-slate-50 p-3">answerSheetId 已生成</div>
                </div>
                <div className="mt-5 flex justify-center">
                  {submission.mode === 'single'
                    ? <QrCodeDisplay data={submission.token} size={260} border={4} className="max-w-sm" />
                    : fountain.qrData
                      ? <QrCodeDisplay data={fountain.qrData} size={260} border={4} className="max-w-sm" />
                      : <div className="flex h-[260px] w-[260px] items-center justify-center rounded-3xl bg-slate-100 text-sm text-slate-500">喷泉码准备中...</div>}
                </div>
                <pre className="mt-5 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-200">{submission.token}</pre>
                <ol className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
                  <li>1. 单码模式直接让院内导入页扫码。</li>
                  <li>2. 喷泉码模式保持手机常亮，连续播码直到采集完成。</li>
                  <li>3. 导入端用 `exchangeId` 与 `maskUuid` 关联回候诊患者。</li>
                </ol>
              </section>
            )}

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">入口</h2>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/share" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white">发放模拟页</Link>
                <Link href="/" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">返回首页</Link>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
