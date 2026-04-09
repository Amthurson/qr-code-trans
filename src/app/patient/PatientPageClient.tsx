'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import QrCodeDisplay from '@/components/QrCodeDisplay';
import { useQrScanner } from '@/hooks/useQrScanner';
import {
  buildLtQrTransport,
  buildOfflineImportEnvelope,
  isQuestionnaireBundlePayload,
  parseOfflineIssueTicket,
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

interface QuestionnaireGroup {
  id: string;
  label: string;
  questions: QuestionnaireTransferQuestion[];
  requiredTotal: number;
  requiredDone: number;
  completed: boolean;
}

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
  const [activeQuestionnaireId, setActiveQuestionnaireId] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [needsRegenerate, setNeedsRegenerate] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [modalQrSize, setModalQrSize] = useState(320);

  useEffect(() => {
    const updateModalQrSize = () => {
      setModalQrSize(Math.max(240, Math.min(window.innerWidth - 48, 420)));
    };
    updateModalQrSize();
    window.addEventListener('resize', updateModalQrSize);
    return () => window.removeEventListener('resize', updateModalQrSize);
  }, []);

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

  const applyBundlePayload = useCallback((data: Uint8Array) => {
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
      setShowQrModal(false);
      setActiveQuestionnaireId(null);
      setCurrentQuestionIndex(0);
      setNeedsRegenerate(false);
    } catch (decodeError) {
      setReceiveError(decodeError instanceof Error ? decodeError.message : '问卷内容解析失败');
    }
  }, []);

  const {
    videoRef,
    isScanning,
    progress,
    isComplete,
    decodedData,
    error,
    lastDetectedAt,
    startScan,
    stopScan,
    ingestCode,
    reset,
  } = useQrScanner({
    onDecoded: (data) => {
      applyBundlePayload(data);
    },
    onError: (scanError) => {
      setReceiveError(scanError.message);
    },
    maxScansPerSecond: 30,
  });

  useEffect(() => {
    if (!decodedData || bundlePayload) return;
    applyBundlePayload(decodedData);
  }, [applyBundlePayload, bundlePayload, decodedData]);

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

  const questionnaires = useMemo(() => {
    if (!bundlePayload) return [] as QuestionnaireGroup[];
    return bundlePayload.templateIds
      .map((templateId) => {
        const groupQuestions = questions.filter((question) => question.templateId === templateId);
        if (!groupQuestions.length) return null;
        const requiredTotal = groupQuestions.filter((question) => question.required).length;
        const requiredDone = groupQuestions.filter((question) => question.required && isFilled(answers[keyOf(question)])).length;
        return {
          id: templateId,
          label: groupQuestions[0]?.templateLabel || templateId,
          questions: groupQuestions,
          requiredTotal,
          requiredDone,
          completed: requiredTotal === 0 || requiredDone >= requiredTotal,
        };
      })
      .filter(Boolean) as QuestionnaireGroup[];
  }, [answers, bundlePayload, questions]);

  const activeQuestionnaire = useMemo(
    () => questionnaires.find((item) => item.id === activeQuestionnaireId) || null,
    [activeQuestionnaireId, questionnaires],
  );

  const currentQuestion = activeQuestionnaire?.questions[currentQuestionIndex] || null;
  const currentAnswer = currentQuestion ? answers[keyOf(currentQuestion)] : undefined;
  const questionnaireCount = questionnaires.length;
  const completedQuestionnaireCount = questionnaires.filter((item) => item.completed).length;
  const requiredTotal = questions.filter((question) => question.required).length;
  const requiredDone = questions.filter((question) => question.required && isFilled(answers[keyOf(question)])).length;
  const canSubmit = Boolean(bundlePayload) && requiredDone >= requiredTotal;

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
        templateLabel: question.templateLabel,
        questionId: question.id,
        questionTitle: question.title,
        fieldKey: question.key,
        questionType: answer.type,
        value: answer.type === 'multiple' ? [...answer.value].sort() : answer.value,
      });
      return list;
    }, [] as Array<{
      templateId: string;
      templateLabel: string;
      questionId: number;
      questionTitle: string;
      fieldKey: string;
      questionType: Answer['type'];
      value: string | number | string[];
    }>);
  }, [answers, questions]);

  const updateAnswer = useCallback((question: QuestionnaireTransferQuestion, answer?: Answer) => {
    const answerKey = keyOf(question);
    setAnswers((current) => {
      if (!answer) {
        const next = { ...current };
        delete next[answerKey];
        return next;
      }
      return { ...current, [answerKey]: answer };
    });
    if (submission) {
      setSubmission(null);
      setShowQrModal(false);
      setNeedsRegenerate(true);
    }
  }, [submission]);

  const openQuestionnaire = useCallback((questionnaireId: string) => {
    const target = questionnaires.find((item) => item.id === questionnaireId);
    if (!target) return;
    const firstPendingIndex = target.questions.findIndex((question) => question.required && !isFilled(answers[keyOf(question)]));
    setActiveQuestionnaireId(questionnaireId);
    setCurrentQuestionIndex(firstPendingIndex > -1 ? firstPendingIndex : 0);
  }, [answers, questionnaires]);

  const closeQuestionnaire = useCallback(() => {
    setActiveQuestionnaireId(null);
    setCurrentQuestionIndex(0);
  }, []);

  const moveQuestion = useCallback((direction: 'prev' | 'next') => {
    if (!activeQuestionnaire) return;
    if (direction === 'prev') {
      setCurrentQuestionIndex((current) => Math.max(0, current - 1));
      return;
    }
    if (currentQuestionIndex >= activeQuestionnaire.questions.length - 1) {
      closeQuestionnaire();
      return;
    }
    setCurrentQuestionIndex((current) => Math.min(activeQuestionnaire.questions.length - 1, current + 1));
  }, [activeQuestionnaire, closeQuestionnaire, currentQuestionIndex]);

  const generateSubmission = useCallback(() => {
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
    setShowQrModal(true);
    setNeedsRegenerate(false);
  }, [answerEntries, bundlePayload]);

  const activeQuestionAnswered = currentQuestion ? !currentQuestion.required || isFilled(currentAnswer) : false;
  const mobileFrameClasses = 'mx-auto min-h-screen w-full max-w-[390px] bg-white sm:min-h-[820px] sm:rounded-[38px] sm:border sm:border-[#cfd9ff] sm:shadow-[0_28px_90px_rgba(82,112,228,0.18)]';

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
                <div className="relative h-[58vmin] w-[58vmin] max-h-[68vh] max-w-[68vw] min-h-[220px] min-w-[220px]">
                  <div className={`absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-colors ${
                    reticleActive ? 'border-emerald-300 bg-emerald-300/12' : 'border-sky-200/90 bg-sky-200/8'
                  }`} />
                  <div className={`absolute left-1/2 top-1/2 h-px w-24 -translate-x-1/2 -translate-y-1/2 transition-colors ${
                    reticleActive ? 'bg-emerald-300' : 'bg-sky-100/90'
                  }`} />
                  <div className={`absolute left-1/2 top-1/2 h-24 w-px -translate-x-1/2 -translate-y-1/2 transition-colors ${
                    reticleActive ? 'bg-emerald-300' : 'bg-sky-100/90'
                  }`} />
                  <div className={`absolute inset-x-[18%] top-[16%] h-px transition-colors ${
                    reticleActive ? 'bg-emerald-300/45' : 'bg-white/20'
                  }`} />
                  <div className={`absolute inset-x-[18%] bottom-[16%] h-px transition-colors ${
                    reticleActive ? 'bg-emerald-300/45' : 'bg-white/20'
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
              {bundleFrame && progress.percent < 100 && (
                <div className="mt-4 rounded-2xl bg-emerald-500/14 px-4 py-3 text-sm text-emerald-100">
                  已收到入口帧，继续扫描同一组喷泉码即可完成整包接收。
                </div>
              )}
              {isComplete && !bundlePayload && !receiveError && (
                <div className="mt-4 rounded-2xl bg-sky-500/14 px-4 py-3 text-sm text-sky-100">
                  问卷数据已接收完成，正在打开表单。
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
    <main className="min-h-screen bg-[linear-gradient(180deg,#eef3ff_0%,#e5edff_100%)] px-0 py-0 sm:px-6 sm:py-8">
      <div className="mx-auto flex max-w-[980px] justify-center">
        <div className={mobileFrameClasses}>
          <div className="px-5 pb-8 pt-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>14:30</span>
              <span className="font-mono">{bundlePayload.bundleId}</span>
            </div>
            {activeQuestionnaire && currentQuestion ? (
              <section className="mt-4 space-y-5">
                <div className="flex items-center justify-between">
                  <button
                    onClick={closeQuestionnaire}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dbe4ff] text-lg text-[#4d67d8]"
                  >
                    ‹
                  </button>
                  <div className="text-center">
                    <div className="text-[20px] font-semibold text-[#1f3573]">{activeQuestionnaire.label}</div>
                    <div className="mt-1 text-xs text-[#7c8cbd]">患者端 · 原 APP 问卷交互样式</div>
                  </div>
                  <button
                    onClick={closeQuestionnaire}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dbe4ff] text-lg text-[#4d67d8]"
                  >
                    ×
                  </button>
                </div>

                <div className="h-1.5 overflow-hidden rounded-full bg-[#e8edff]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#5f7cff_0%,#6f86ff_100%)]"
                    style={{ width: `${((currentQuestionIndex + 1) / activeQuestionnaire.questions.length) * 100}%` }}
                  />
                </div>

                <div className="text-center text-[44px] font-semibold leading-none text-[#24439b]">
                  {currentQuestionIndex + 1}/{activeQuestionnaire.questions.length}
                </div>

                <div className="space-y-3 rounded-[28px] border border-[#dbe4ff] bg-white px-4 py-5 shadow-[0_16px_42px_rgba(104,128,244,0.12)]">
                  <div className="text-[23px] font-semibold text-[#20315f]">问卷填写页</div>
                  <div className="text-xs text-[#8b9ac3]">关联字段：{currentQuestion.key}</div>
                  <p className="pt-2 text-[22px] leading-[1.55] text-[#20315f]">
                    {currentQuestion.id}. {currentQuestion.title}
                    {currentQuestion.required && <span className="ml-1 text-[#ff5a67]">*</span>}
                  </p>

                  {currentQuestion.type === 'single' && (
                    <div className="space-y-3 pt-2">
                      {currentQuestion.options?.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => updateAnswer(currentQuestion, { type: 'single', value: option.id })}
                          className={`flex w-full items-center gap-3 rounded-[20px] border px-4 py-4 text-left text-base transition ${
                            currentAnswer?.type === 'single' && currentAnswer.value === option.id
                              ? 'border-[#5f7cff] bg-[#eef2ff] text-[#24439b]'
                              : 'border-[#dbe4ff] bg-white text-[#20315f]'
                          }`}
                        >
                          <span className={`h-5 w-5 rounded-full border ${
                            currentAnswer?.type === 'single' && currentAnswer.value === option.id
                              ? 'border-[#5f7cff] bg-[#5f7cff] shadow-[inset_0_0_0_4px_#fff]'
                              : 'border-[#bcc8f2]'
                          }`} />
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {currentQuestion.type === 'multiple' && (
                    <div className="space-y-3 pt-2">
                      <div className="text-sm text-[#7f8db7]">可多选，最多 {currentQuestion.maxSelect || currentQuestion.options?.length || 1} 项</div>
                      {currentQuestion.options?.map((option) => {
                        const selected = currentAnswer?.type === 'multiple' ? currentAnswer.value : [];
                        const checked = selected.includes(option.id);
                        return (
                          <button
                            key={option.id}
                            onClick={() => {
                              const currentValues = currentAnswer?.type === 'multiple' ? currentAnswer.value : [];
                              const nextValues = checked
                                ? currentValues.filter((item) => item !== option.id)
                                : currentValues.length >= (currentQuestion.maxSelect || currentQuestion.options?.length || 1)
                                  ? currentValues
                                  : currentValues.concat(option.id);
                              updateAnswer(
                                currentQuestion,
                                nextValues.length ? { type: 'multiple', value: nextValues, strategy: 'list' } : undefined,
                              );
                            }}
                            className={`flex w-full items-center gap-3 rounded-[20px] border px-4 py-4 text-left text-base transition ${
                              checked
                                ? 'border-[#5f7cff] bg-[#eef2ff] text-[#24439b]'
                                : 'border-[#dbe4ff] bg-white text-[#20315f]'
                            }`}
                          >
                            <span className={`flex h-5 w-5 items-center justify-center rounded-md border text-[12px] ${
                              checked
                                ? 'border-[#5f7cff] bg-[#5f7cff] text-white'
                                : 'border-[#bcc8f2] text-transparent'
                            }`}>
                              ✓
                            </span>
                            <span>{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {currentQuestion.type === 'numeric' && (
                    <div className="pt-2">
                      <input
                        type="number"
                        min={currentQuestion.min}
                        max={currentQuestion.max}
                        value={currentAnswer?.type === 'numeric' ? String(currentAnswer.value) : ''}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          updateAnswer(
                            currentQuestion,
                            nextValue === '' ? undefined : { type: 'numeric', value: Number(nextValue) },
                          );
                        }}
                        placeholder={placeholderOf(currentQuestion)}
                        className="w-full rounded-[22px] border border-[#dbe4ff] bg-[#f8faff] px-4 py-4 text-[18px] text-[#20315f] outline-none focus:border-[#5f7cff]"
                      />
                    </div>
                  )}

                  {currentQuestion.type === 'text' && (
                    <div className="pt-2">
                      <input
                        type="text"
                        value={currentAnswer?.type === 'text' ? currentAnswer.value : ''}
                        maxLength={currentQuestion.maxLength || 80}
                        onChange={(event) => {
                          updateAnswer(
                            currentQuestion,
                            event.target.value === '' ? undefined : { type: 'text', value: event.target.value },
                          );
                        }}
                        placeholder={placeholderOf(currentQuestion)}
                        className="w-full rounded-[22px] border border-[#dbe4ff] bg-[#f8faff] px-4 py-4 text-[18px] text-[#20315f] outline-none focus:border-[#5f7cff]"
                      />
                    </div>
                  )}

                  {currentQuestion.type === 'long-text' && (
                    <div className="pt-2">
                      <textarea
                        rows={6}
                        value={currentAnswer?.type === 'long-text' ? currentAnswer.value : ''}
                        maxLength={currentQuestion.maxLength || 200}
                        onChange={(event) => {
                          updateAnswer(
                            currentQuestion,
                            event.target.value === '' ? undefined : { type: 'long-text', value: event.target.value },
                          );
                        }}
                        placeholder={placeholderOf(currentQuestion)}
                        className="w-full rounded-[22px] border border-[#dbe4ff] bg-[#f8faff] px-4 py-4 text-[17px] leading-7 text-[#20315f] outline-none focus:border-[#5f7cff]"
                      />
                      <div className="mt-2 text-right text-xs text-[#91a0c8]">
                        {currentAnswer?.type === 'long-text' ? currentAnswer.value.length : 0}/{currentQuestion.maxLength || 200}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {currentQuestionIndex > 0 && (
                    <button
                      onClick={() => moveQuestion('prev')}
                      className="w-full rounded-[18px] border border-[#dbe4ff] bg-white px-5 py-4 text-base font-semibold text-[#4d67d8]"
                    >
                      上一题
                    </button>
                  )}
                  <button
                    onClick={() => moveQuestion('next')}
                    disabled={!activeQuestionAnswered}
                    className="w-full rounded-[18px] bg-[linear-gradient(90deg,#5f7cff_0%,#6f86ff_100%)] px-5 py-4 text-base font-semibold text-white shadow-[0_14px_32px_rgba(92,120,241,0.28)] disabled:cursor-not-allowed disabled:bg-[#d8def5] disabled:shadow-none"
                  >
                    {currentQuestionIndex >= activeQuestionnaire.questions.length - 1 ? '完成本问卷' : '下一题'}
                  </button>
                </div>
              </section>
            ) : (
              <section className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <button className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dbe4ff] text-lg text-[#4d67d8]">
                    ←
                  </button>
                  <div className="text-center">
                    <div className="text-[21px] font-semibold text-[#20315f]">问卷与预评估互动</div>
                    <div className="mt-1 text-xs text-[#8a99c3]">患者端 · 接收并完成问卷</div>
                  </div>
                  <div className="h-9 w-9 rounded-full border border-transparent" />
                </div>

                <div className="rounded-[26px] border border-[#dbe4ff] bg-white px-4 py-5 shadow-[0_16px_42px_rgba(104,128,244,0.12)]">
                  <h2 className="text-[28px] font-semibold text-[#20315f]">问卷与预评估</h2>
                  <div className="mt-5 space-y-3 text-[15px] text-[#41598f]">
                    <div className="flex items-center justify-between">
                      <span>问卷交换号</span>
                      <b className="font-semibold text-[#20315f]">{bundlePayload.exchangeId}</b>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>完成进度</span>
                      <b className="font-semibold text-[#20315f]">{completedQuestionnaireCount}/{questionnaireCount}</b>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>已接收资料</span>
                      <b className="font-semibold text-[#20315f]">{bundlePayload.mockFiles.length} 份</b>
                    </div>
                  </div>

                  <div className="mt-5 rounded-[20px] border border-[#dbe4ff] bg-[#f7f9ff] px-3 py-2">
                    <div className="pb-2 text-[15px] font-semibold text-[#20315f]">待填写问卷</div>
                    <div className="space-y-2">
                      {questionnaires.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-[16px] bg-white px-3 py-3">
                          <div className="min-w-0">
                            <div className="truncate text-[15px] font-medium text-[#20315f]">{item.label}</div>
                            <div className="mt-1 text-xs text-[#8a99c3]">
                              必填 {item.requiredDone > item.requiredTotal ? item.requiredTotal : item.requiredDone}/{item.requiredTotal}
                            </div>
                          </div>
                          <button
                            onClick={() => openQuestionnaire(item.id)}
                            className="rounded-[14px] border border-[#dbe4ff] px-4 py-2 text-sm font-semibold text-[#5f7cff]"
                          >
                            {item.completed ? '修改' : '去填写'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={generateSubmission}
                    disabled={!canSubmit}
                    className="mt-5 w-full rounded-[18px] bg-[linear-gradient(90deg,#5f7cff_0%,#6f86ff_100%)] px-5 py-4 text-base font-semibold text-white shadow-[0_14px_32px_rgba(92,120,241,0.28)] disabled:cursor-not-allowed disabled:bg-[#d8def5] disabled:shadow-none"
                  >
                    提交问卷并生成二维码
                  </button>

                  {!canSubmit && (
                    <div className="mt-3 text-center text-xs leading-6 text-[#8a99c3]">
                      请先完成全部必填题目，再生成回传二维码。
                    </div>
                  )}
                </div>

                {needsRegenerate && !submission && (
                  <div className="rounded-[22px] border border-[#ffe1b0] bg-[#fff5e5] px-4 py-4 text-sm leading-6 text-[#9b6a17]">
                    你刚刚修改了问卷答案，之前生成的二维码已失效，请重新点击“提交问卷并生成二维码”。
                  </div>
                )}

                {submission && (
                  <div className="rounded-[26px] border border-[#dbe4ff] bg-white px-4 py-5 shadow-[0_16px_42px_rgba(104,128,244,0.12)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[20px] font-semibold text-[#20315f]">问卷回传二维码</div>
                          <div className="mt-1 text-xs text-[#8a99c3]">{modeText(submission.mode)} · 点击二维码可全屏显示</div>
                      </div>
                      <button
                        onClick={generateSubmission}
                        className="rounded-[14px] border border-[#dbe4ff] px-4 py-2 text-sm font-semibold text-[#5f7cff]"
                      >
                        重新生成
                      </button>
                    </div>

                    <div className="mt-5 flex justify-center rounded-3xl bg-[#f7f9ff] px-4 py-4">
                        <button
                          onClick={() => setShowQrModal(true)}
                          className="cursor-pointer rounded-2xl transition hover:opacity-80"
                        >
                      <QrCodeDisplay
                        data={submission.frames[submission.mode === 'single' ? 0 : submissionFrameIndex] || ''}
                        size={236}
                        border={4}
                        className="w-full max-w-[250px]"
                      />
                        </button>
                    </div>

                    <div className="mt-3 text-center text-xs leading-6 text-[#8a99c3]">
                        {submission.mode === 'single'
                          ? '请把这张二维码给院内端扫码导入（点击二维码可全屏显示）。'
                          : `正在轮播第 ${submissionFrameIndex + 1}/${submission.frames.length} 帧，请保持手机亮屏给院内端连续扫码（点击可全屏显示）。`}
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-[#6075ae]">
                      <div className="rounded-[16px] bg-[#f7f9ff] px-2 py-3">必填 {requiredDone}/{requiredTotal}</div>
                      <div className="rounded-[16px] bg-[#f7f9ff] px-2 py-3">压缩后 {submission.payloadBytes} bytes</div>
                      <div className="rounded-[16px] bg-[#f7f9ff] px-2 py-3">预计 {submission.estimatedFrames} 帧</div>
                    </div>
                  </div>
                )}

                  {/* 二维码全屏弹窗 */}
                  {showQrModal && submission && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-0">
                      <div className="relative w-full max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:max-w-[500px]">
                        <button
                          onClick={() => setShowQrModal(false)}
                          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#f0f4ff] text-[#5f7cff] hover:bg-[#e6ebff]"
                        >
                          ✕
                        </button>

                        <div className="mb-6 text-center pr-8">
                          <div className="text-xl font-semibold text-[#20315f]">{modeText(submission.mode)}</div>
                          {submission.mode === 'fountain' && (
                            <div className="mt-2 text-sm text-[#8a99c3]">第 {submissionFrameIndex + 1}/{submission.frames.length} 帧</div>
                          )}
                        </div>

                        <div className="flex w-full justify-center bg-[#f7f9ff] p-6 rounded-2xl">
                          <QrCodeDisplay
                            data={submission.frames[submission.mode === 'single' ? 0 : submissionFrameIndex] || ''}
                            size={modalQrSize}
                            border={4}
                            className="w-full"
                          />
                        </div>

                        <div className="mt-6 text-center text-sm leading-6 text-[#8a99c3]">
                          {submission.mode === 'single'
                            ? '请将二维码给院内端扫码导入。'
                            : '请保持手机亮屏给院内端连续扫码。'}
                        </div>

                        <button
                          onClick={() => setShowQrModal(false)}
                          className="mt-6 w-full rounded-xl bg-[linear-gradient(90deg,#5f7cff_0%,#6f86ff_100%)] py-3 text-white font-semibold hover:shadow-lg transition"
                        >
                          关闭
                        </button>
                      </div>
                    </div>
                  )}

                <div className="rounded-[22px] border border-[#dbe4ff] bg-white px-4 py-4 text-sm leading-7 text-[#667ab1]">
                  已接收 {questions.length} 道题，回传载荷会携带每一道题对应的预问诊字段 key，院内端可直接关联到 N2 采集表单。
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
