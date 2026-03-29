'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import QrCodeDisplay from '@/components/QrCodeDisplay';
import { useQrScanner } from '@/hooks/useQrScanner';
import {
  buildLtQrTransport,
  buildOfflineImportEnvelope,
  parseOfflineIssueTicket,
  isQuestionnaireBundlePayload,
} from '@/lib/offline-questionnaire';
import type {
  Answer,
  OfflineIssuePayload,
  OfflineQuestionnaireBundlePayload,
  QuestionnaireTransferQuestion,
} from '@/types';

const EMPTY_ISSUE: OfflineIssuePayload = {
  version: 'OQX/1',
  transport: 'public-link',
  exchangeId: '',
  maskUuid: '',
  bundleId: '',
  templateIds: [],
};

function keyOf(question: QuestionnaireTransferQuestion): string {
  return `${question.templateId}:${question.id}`;
}

function isFilled(answer?: Answer): boolean {
  if (!answer) return false;
  if (answer.type === 'multiple') return answer.value.length > 0;
  if (answer.type === 'text' || answer.type === 'long-text') return answer.value.trim().length > 0;
  return true;
}

function placeholderOf(question: QuestionnaireTransferQuestion): string {
  if (question.placeholder) return question.placeholder;
  if (question.type === 'numeric') return '请输入数值';
  return question.type === 'long-text' ? '请详细描述' : '请输入回答';
}

function modeText(mode: 'single' | 'fountain'): string {
  return mode === 'single' ? '单码回传' : '喷泉码回传';
}

export default function PatientPageClient() {
  const searchParams = useSearchParams();
  const ticket = searchParams.get('ticket') || '';

  const [issue, setIssue] = useState<OfflineIssuePayload>(EMPTY_ISSUE);
  const [issueSource, setIssueSource] = useState<'empty' | 'ticket' | 'bundle'>('empty');
  const [issueWarning, setIssueWarning] = useState('当前页面为空白入口页，请点击“开始扫码接收问卷”并对准院内屏幕上的问卷传输码。');
  const [issueError, setIssueError] = useState('');
  const [bundlePayload, setBundlePayload] = useState<OfflineQuestionnaireBundlePayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [receiveError, setReceiveError] = useState('');
  const [submission, setSubmission] = useState<(ReturnType<typeof buildOfflineImportEnvelope> & ReturnType<typeof buildLtQrTransport>) | null>(null);
  const [submissionFrameIndex, setSubmissionFrameIndex] = useState(0);

  useEffect(() => {
    if (!ticket) {
      setIssue(EMPTY_ISSUE);
      setIssueSource('empty');
      setIssueError('');
      setIssueWarning('当前页面为空白入口页，请点击“开始扫码接收问卷”并对准院内屏幕上的问卷传输码。');
      return;
    }

    try {
      const parsedIssue = parseOfflineIssueTicket(ticket);
      setIssue(parsedIssue);
      setIssueSource('ticket');
      setIssueError('');
      setIssueWarning('已收到发放会话，但题目内容不会跟随链接下发，请继续扫描院内问卷传输码。');
    } catch (error) {
      setIssue(EMPTY_ISSUE);
      setIssueSource('empty');
      setIssueError(error instanceof Error ? error.message : '发放码解析失败');
      setIssueWarning('已回退为空白入口页，请重新扫描入口二维码。');
    }
  }, [ticket]);

  const {
    videoRef,
    isScanning,
    progress,
    isComplete,
    error,
    startScan,
    stopScan,
    reset,
  } = useQrScanner({
    onDecoded: (data) => {
      try {
        const text = new TextDecoder().decode(data);
        const parsed = JSON.parse(text);
        if (!isQuestionnaireBundlePayload(parsed)) {
          throw new Error('当前二维码不是问卷下发包');
        }
        setBundlePayload(parsed);
        setIssue({
          version: parsed.version,
          transport: 'public-link',
          exchangeId: parsed.exchangeId,
          maskUuid: parsed.maskUuid,
          bundleId: parsed.bundleId,
          templateIds: parsed.templateIds,
        });
        setIssueSource('bundle');
        setIssueWarning('');
        setIssueError('');
        setReceiveError('');
        setAnswers({});
        setSubmission(null);
      } catch (decodeError) {
        setReceiveError(decodeError instanceof Error ? decodeError.message : '问卷内容解析失败');
      }
    },
    onError: (scanError) => {
      setReceiveError(scanError.message);
    },
    maxScansPerSecond: 30,
  });

  const questions = bundlePayload?.questions || [];
  const requiredTotal = questions.filter((question) => question.required).length;
  const requiredDone = questions.filter((question) => isFilled(answers[keyOf(question)])).length;
  const canSubmit = Boolean(bundlePayload) && requiredTotal > 0 && requiredTotal === requiredDone;

  useEffect(() => {
    setSubmissionFrameIndex(0);
    if (!submission || submission.mode !== 'fountain') return undefined;
    const timer = window.setInterval(() => {
      setSubmissionFrameIndex((current) => (current + 1) % submission.frames.length);
    }, 480);
    return () => window.clearInterval(timer);
  }, [submission]);

  const answerEntries = useMemo(() => {
    return questions.reduce((list, question) => {
      const answer = answers[keyOf(question)];
      if (!answer) return list;
      list.push({
        templateId: question.templateId,
        questionId: question.id,
        questionType: answer.type,
        value: answer.type === 'multiple' ? [...answer.value].sort() : answer.value,
      });
      return list;
    }, [] as Array<{ templateId: string; questionId: number; questionType: Answer['type']; value: string | number | string[] }>);
  }, [answers, questions]);

  const updateAnswer = (question: QuestionnaireTransferQuestion, answer?: Answer) => {
    const answerKey = keyOf(question);
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

  const sourceTemplateLabels = Array.from(new Set(questions.map((question) => question.templateLabel)));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600">offline public fill</div>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">公网患者填写页</h1>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                入口链接本身不带题目数据。患者进入页面后，需要继续扫描院内屏幕上的问卷传输码，题目和模拟资料才会被下发到手机端。
              </p>
            </div>
            <div className="grid min-w-[280px] gap-3 rounded-2xl bg-slate-950 p-4 text-sm text-slate-200">
              <div>来源：{issueSource === 'bundle' ? '扫码接收问卷内容' : issueSource === 'ticket' ? '入口 ticket' : '空白入口'}</div>
              <div>bundleId：<span className="font-mono">{issue.bundleId || '-'}</span></div>
              <div>exchangeId：<span className="font-mono break-all">{issue.exchangeId || '-'}</span></div>
              <div>maskUuid：<span className="font-mono break-all">{issue.maskUuid || '-'}</span></div>
              <div>模板：{issue.templateIds.length ? issue.templateIds.join(', ') : '待接收'}</div>
            </div>
          </div>
          {(issueError || issueWarning) && (
            <div className="mt-4 space-y-2 text-sm">
              {issueError && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-rose-700">入口码错误：{issueError}</div>}
              {issueWarning && <div className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-700">{issueWarning}</div>}
            </div>
          )}
        </section>

        {!bundlePayload && (
          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">接收问卷内容</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                先保持当前页面打开，再把手机摄像头对准院内 PMS 屏幕上的“接收问卷内容”二维码。如果题目包较大，页面会自动连续接收喷泉码。
              </p>
              <div className="relative mt-6 overflow-hidden rounded-3xl bg-black aspect-video">
                <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
                {!isScanning && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-center text-sm text-white">
                    <div className="space-y-3">
                      <div>点击下方按钮启动摄像头</div>
                      <div>将手机对准院内屏幕上的问卷传输二维码</div>
                    </div>
                  </div>
                )}
                {isComplete && (
                  <div className="absolute inset-0 flex items-center justify-center bg-emerald-600/80 text-2xl font-bold text-white">
                    接收完成
                  </div>
                )}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                {!isScanning && (
                  <button onClick={startScan} className="rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white">
                    开始扫码接收
                  </button>
                )}
                {isScanning && (
                  <button onClick={stopScan} className="rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-white">
                    暂停扫码
                  </button>
                )}
                <button
                  onClick={() => {
                    reset();
                    setReceiveError('');
                  }}
                  className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600"
                >
                  重置扫描
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-slate-900">接收进度</h2>
                <div className="mt-4 rounded-2xl bg-slate-100 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>解码进度</span>
                    <span>{progress.percent}%</span>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-sky-600 transition-all" style={{ width: `${progress.percent}%` }} />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs text-slate-500">
                    <div className="rounded-2xl bg-white p-3">总块数 {progress.total}</div>
                    <div className="rounded-2xl bg-white p-3">已解码 {progress.decoded}</div>
                    <div className="rounded-2xl bg-white p-3">已接收 {progress.encoded}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-slate-900">提示</h2>
                <ol className="mt-4 space-y-2 text-sm leading-7 text-slate-600">
                  <li>1. 先扫入口二维码打开当前页面。</li>
                  <li>2. 再点“开始扫码接收”，对准院内屏幕上的问卷传输码。</li>
                  <li>3. 问卷包里包含 3 份模拟资料，多选题会在下发前自动合并。</li>
                </ol>
                {(receiveError || error) && (
                  <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {receiveError || error?.message}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {bundlePayload && (
          <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
            <section className="space-y-6">
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{bundlePayload.questionnaireTitle}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      已接收 {questions.length} 道题，来源模板：{sourceTemplateLabels.join(' / ')}
                    </p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                    issuedAt {new Date(bundlePayload.issuedAt).toLocaleString()}
                  </div>
                </div>

                {bundlePayload.mockFiles.length > 0 && (
                  <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">模拟资料（3 份）</div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      {bundlePayload.mockFiles.map((file) => (
                        <div key={file.id} className="rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-sm">
                          <div className="font-semibold text-slate-900">{file.name}</div>
                          <div className="mt-1">{file.mimeType} · {file.sizeKb} KB</div>
                          <div className="mt-2 text-xs leading-6 text-slate-500">{file.summary}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {questions.map((question) => {
                    const answer = answers[keyOf(question)];
                    return (
                      <div key={keyOf(question)} className="rounded-2xl border border-slate-200 p-4">
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                          <label className="block text-sm font-semibold text-slate-900">
                            {question.id}. {question.title}
                            {question.required && <span className="ml-1 text-rose-500">*</span>}
                          </label>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-600">
                            {question.templateLabel}
                          </span>
                        </div>
                        {question.type === 'single' && (
                          <div className="space-y-2">
                            {question.options?.map((option) => (
                              <label key={option.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                <input
                                  type="radio"
                                  name={keyOf(question)}
                                  checked={answer?.type === 'single' && answer.value === option.id}
                                  onChange={() => updateAnswer(question, { type: 'single', value: option.id })}
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
                                      updateAnswer(question, next.length > 0 ? { type: 'multiple', value: next, strategy: 'list' } : undefined);
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
                              question,
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
                                question,
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
            </section>

            <aside className="space-y-6">
              <section className="rounded-3xl bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-slate-900">回传摘要</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-slate-950 p-4 text-slate-100">必填完成：{requiredDone} / {requiredTotal}</div>
                  <div className="rounded-2xl bg-sky-50 p-4 text-sky-900">已答题数：{answerEntries.length}</div>
                </div>
                <button
                  onClick={() => {
                    if (!bundlePayload) return;
                    const answerEnvelope = buildOfflineImportEnvelope({
                      exchangeId: bundlePayload.exchangeId,
                      maskUuid: bundlePayload.maskUuid,
                      templateIds: bundlePayload.templateIds,
                      answers: answerEntries,
                    });
                    const qrTransport = buildLtQrTransport(answerEnvelope.payload);
                    setSubmission({
                      ...answerEnvelope,
                      ...qrTransport,
                    });
                  }}
                  disabled={!canSubmit}
                  className="mt-5 w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  生成回传码
                </button>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  回传时只带 `exchangeId`、`maskUuid`、`templateIds` 和答案值。医院端使用同一套 LT 二维码解码能力导入。
                </p>
              </section>

              {submission && (
                <section className="rounded-3xl bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-bold text-slate-900">回传载荷</h2>
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{modeText(submission.mode)}</div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-slate-600">
                    <div className="rounded-2xl bg-slate-50 p-3">压缩后 {submission.payloadBytes} bytes</div>
                    <div className="rounded-2xl bg-slate-50 p-3">预计 {submission.estimatedFrames} 帧</div>
                    <div className="rounded-2xl bg-slate-50 p-3">answerSheet 已生成</div>
                  </div>
                  <div className="mt-5 flex justify-center">
                    <QrCodeDisplay
                      data={submission.frames[submission.mode === 'single' ? 0 : submissionFrameIndex] || ''}
                      size={260}
                      border={4}
                      className="max-w-sm"
                    />
                  </div>
                  <div className="mt-3 text-center text-xs text-slate-500">
                    {submission.mode === 'single'
                      ? '单帧二维码，可直接给院内导入页扫码'
                      : `第 ${submissionFrameIndex + 1}/${submission.frames.length} 帧 · 自动轮播中`}
                  </div>
                  <pre className="mt-5 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-200">
                    {JSON.stringify(submission.payload, null, 2)}
                  </pre>
                </section>
              )}

              <section className="rounded-3xl bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-slate-900">入口</h2>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href="/" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">返回首页</Link>
                  <Link href="/hospital" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white">打开医院导入页</Link>
                </div>
              </section>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
