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
  const ticket = searchParams.get('ticket') || searchParams.get('t') || '';
  const bundleFrame = searchParams.get('f') || searchParams.get('bundleFrame') || '';

  const [issue, setIssue] = useState<OfflineIssuePayload>(EMPTY_ISSUE);
  const [issueSource, setIssueSource] = useState<'empty' | 'ticket' | 'bundle'>('empty');
  const [issueWarning, setIssueWarning] = useState('点击“扫码获取问卷”后，对准院内屏幕上的问卷码继续接收内容。');
  const [issueError, setIssueError] = useState('');
  const [bundlePayload, setBundlePayload] = useState<OfflineQuestionnaireBundlePayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [receiveError, setReceiveError] = useState('');
  const [submission, setSubmission] = useState<(ReturnType<typeof buildOfflineImportEnvelope> & ReturnType<typeof buildLtQrTransport>) | null>(null);
  const [submissionFrameIndex, setSubmissionFrameIndex] = useState(0);
  const [reticleActive, setReticleActive] = useState(false);

  useEffect(() => {
    if (!ticket) {
      setIssue(EMPTY_ISSUE);
      setIssueSource('empty');
      setIssueError('');
      setIssueWarning('点击“扫码获取问卷”后，对准院内屏幕上的问卷码继续接收内容。');
      return;
    }

    try {
      const parsedIssue = parseOfflineIssueTicket(ticket);
      setIssue(parsedIssue);
      setIssueSource('ticket');
      setIssueError('');
      setIssueWarning(bundleFrame
        ? '已打开填写入口，请点击“扫码获取问卷”并继续扫描同一组喷泉码。'
        : '已进入填写入口，请点击“扫码获取问卷”并对准院内问卷码。');
    } catch (error) {
      setIssue(EMPTY_ISSUE);
      setIssueSource('empty');
      setIssueError(error instanceof Error ? error.message : '发放码解析失败');
      setIssueWarning('已回退为空白入口页，请重新扫描入口二维码。');
    }
  }, [bundleFrame, ticket]);

  const {
    videoRef,
    isScanning,
    progress,
    isComplete,
    error,
    lastDetectedAt,
    startScan,
    stopScan,
    ingestCode,
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

  useEffect(() => {
    if (!bundleFrame) return;
    ingestCode(bundleFrame);
  }, [bundleFrame, ingestCode]);

  useEffect(() => {
    if (!lastDetectedAt) return undefined;
    setReticleActive(true);
    const timer = window.setTimeout(() => setReticleActive(false), 320);
    return () => window.clearTimeout(timer);
  }, [lastDetectedAt]);

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

  if (!bundlePayload) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-black text-white">
        <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted />
        <div className={`absolute inset-0 transition-colors ${isScanning ? 'bg-black/28' : 'bg-black/78'}`} />

        <div className="relative z-10 flex min-h-screen flex-col">
          <div className="flex items-start justify-between gap-4 px-5 py-5">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">offline public fill</div>
              <h1 className="text-3xl font-bold">扫码获取问卷</h1>
              {!isScanning && (
                <p className="max-w-2xl text-sm leading-7 text-slate-200">
                  患者用微信扫描院内屏幕上的任意一帧问卷码即可进入此页。点击下方按钮后开启摄像头，再继续扫描同一组喷泉码接收题目内容。
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right text-xs text-slate-200 backdrop-blur">
              <div>来源：{issueSource === 'ticket' ? '一体化问卷码' : '等待扫码'}</div>
              <div className="mt-1">bundleId：<span className="font-mono">{issue.bundleId || '-'}</span></div>
            </div>
          </div>

          <div className="relative flex flex-1 items-center justify-center px-5 py-4">
            {isScanning && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-[62vmin] w-[62vmin] max-h-[72vh] max-w-[72vw] min-h-[260px] min-w-[260px]">
                  <div className={`absolute inset-0 rounded-[36px] border-2 transition-all duration-150 ${
                    reticleActive ? 'border-emerald-300 shadow-[0_0_0_2px_rgba(110,231,183,0.22),0_0_26px_rgba(110,231,183,0.48)]' : 'border-white/75 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]'
                  }`} />
                  <div className={`absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-colors ${
                    reticleActive ? 'border-emerald-300 bg-emerald-300/12' : 'border-sky-200/90 bg-sky-200/8'
                  }`} />
                  <div className={`absolute left-1/2 top-1/2 h-px w-24 -translate-x-1/2 -translate-y-1/2 transition-colors ${
                    reticleActive ? 'bg-emerald-300' : 'bg-sky-100/90'
                  }`} />
                  <div className={`absolute left-1/2 top-1/2 h-24 w-px -translate-x-1/2 -translate-y-1/2 transition-colors ${
                    reticleActive ? 'bg-emerald-300' : 'bg-sky-100/90'
                  }`} />
                </div>
              </div>
            )}

            {!isScanning && (
              <div className="w-full max-w-xl text-center">
                <div className="space-y-5 rounded-[32px] border border-white/12 bg-black/30 px-6 py-8 shadow-2xl backdrop-blur-sm">
                  <div className="text-2xl font-semibold">点击扫码获取问卷</div>
                  <div className="text-sm leading-7 text-slate-200">
                    摄像头启动后，整个屏幕都会作为取景区域；中央准星变绿表示当前帧已经被成功识别。
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={startScan}
                      className="rounded-full bg-sky-500 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/30"
                    >
                      点击扫码获取问卷
                    </button>
                    <button
                      onClick={() => {
                        reset();
                        setReceiveError('');
                      }}
                      className="rounded-full border border-white/18 px-8 py-3 text-sm font-semibold text-white/90"
                    >
                      重新开始
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="relative z-10 grid gap-3 px-4 pb-5 md:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[24px] border border-white/10 bg-black/36 p-4 backdrop-blur">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-white">接收进度</span>
                <span className="text-sky-200">{progress.percent}%</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${progress.percent}%` }} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs text-slate-200">
                <div className="rounded-2xl bg-black/20 p-3">总块数 {progress.total}</div>
                <div className="rounded-2xl bg-black/20 p-3">已解码 {progress.decoded}</div>
                <div className="rounded-2xl bg-black/20 p-3">已接收 {progress.encoded}</div>
              </div>
              {bundleFrame && (
                <div className="mt-4 rounded-2xl bg-emerald-500/14 px-4 py-3 text-sm text-emerald-100">
                  已收到入口帧，继续扫描同一组喷泉码即可完成整包接收。
                </div>
              )}
              {isScanning && (
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={stopScan}
                    className="rounded-full bg-white/15 px-6 py-2.5 text-sm font-semibold text-white"
                  >
                    暂停扫码
                  </button>
                  <button
                    onClick={() => {
                      reset();
                      setReceiveError('');
                    }}
                    className="rounded-full border border-white/18 px-6 py-2.5 text-sm font-semibold text-white/90"
                  >
                    重新开始
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-white/10 bg-black/36 p-4 backdrop-blur">
              <div className="text-sm font-semibold text-white">当前会话</div>
              <div className="mt-4 space-y-2 text-xs leading-6 text-slate-200">
                <div>exchangeId：<span className="font-mono break-all">{issue.exchangeId || '-'}</span></div>
                <div>maskUuid：<span className="font-mono break-all">{issue.maskUuid || '-'}</span></div>
                <div>模板：{issue.templateIds.length ? issue.templateIds.join(' / ') : '待接收'}</div>
              </div>
              {(issueError || issueWarning || receiveError || error) && (
                <div className="mt-4 space-y-3 text-sm">
                  {issueError && <div className="rounded-2xl bg-rose-500/18 px-4 py-3 text-rose-100">{issueError}</div>}
                  {issueWarning && <div className="rounded-2xl bg-amber-400/14 px-4 py-3 text-amber-50">{issueWarning}</div>}
                  {(receiveError || error) && (
                    <div className="rounded-2xl bg-rose-500/18 px-4 py-3 text-rose-100">
                      {receiveError || error?.message}
                    </div>
                  )}
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/" className="rounded-full border border-white/16 px-4 py-2 text-sm font-semibold text-white/90">
                  返回首页
                </Link>
                <Link href="/hospital" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950">
                  打开医院导入页
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600">offline public fill</div>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">公网患者填写页</h1>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                患者可微信扫描院内问卷码的任意一帧进入本页。进入后继续扫描同一组喷泉码，题目和模拟资料会逐步接收到手机端。
              </p>
            </div>
            <div className="grid min-w-[280px] gap-3 rounded-2xl bg-slate-950 p-4 text-sm text-slate-200">
              <div>来源：{issueSource === 'bundle' ? '一体化问卷码' : issueSource === 'ticket' ? '问卷入口 ticket' : '空白入口'}</div>
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
      </div>
    </main>
  );
}
