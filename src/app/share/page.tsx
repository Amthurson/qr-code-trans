'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import QrCodeDisplay from '@/components/QrCodeDisplay';
import { buildOfflineIssueEnvelope } from '@/lib/offline-questionnaire';
import { offlineQuestionnaireBundles, questionnaires } from '@/lib/questions';

const DEFAULT_ORIGIN = 'https://qr-trans.test.conova.withinfuel.com';

export default function SharePage() {
  const [origin, setOrigin] = useState(DEFAULT_ORIGIN);
  const [bundleId, setBundleId] = useState(offlineQuestionnaireBundles[0]?.id || 'STUDIO-QUESTIONNAIRE-BUNDLE');
  const [templateIds, setTemplateIds] = useState<string[]>(
    offlineQuestionnaireBundles[0]?.templateIds || [questionnaires[0]?.id || 'scoliosis-v1']
  );
  const [envelope, setEnvelope] = useState(() => buildOfflineIssueEnvelope({
    bundleId,
    templateIds,
    publicBaseUrl: `${DEFAULT_ORIGIN}/patient`,
  }));

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    setEnvelope(buildOfflineIssueEnvelope({
      bundleId,
      templateIds,
      publicBaseUrl: `${origin}/patient`,
    }));
  }, [bundleId, origin, templateIds.join(',')]);

  const toggleTemplate = (templateId: string) => {
    setTemplateIds((current) => {
      if (current.includes(templateId)) {
        const next = current.filter((item) => item !== templateId);
        return next.length > 0 ? next : current;
      }
      return [...current, templateId];
    });
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">issue envelope simulator</div>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">院内发放模拟页</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            用于模拟 PMS 发放码。二维码内只放公网链接，链接里的 `ticket` 使用 `OQX/1 + Deflate + Base64URL`。
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">bundle</h2>
              <div className="mt-4 space-y-3">
                {offlineQuestionnaireBundles.map((bundle) => (
                  <label key={bundle.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-4">
                    <input
                      type="radio"
                      name="bundle"
                      checked={bundleId === bundle.id}
                      onChange={() => {
                        setBundleId(bundle.id);
                        setTemplateIds(bundle.templateIds);
                      }}
                      className="mt-1 h-4 w-4 accent-indigo-600"
                    />
                    <div>
                      <div className="font-semibold text-slate-900">{bundle.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{bundle.description}</div>
                      <div className="mt-2 text-xs text-slate-400">templateIds: {bundle.templateIds.join(', ')}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">templates</h2>
              <p className="mt-2 text-sm text-slate-500">用于本地联调 bundle 镜像未完成前的兜底配置。</p>
              <div className="mt-4 space-y-3">
                {questionnaires.map((questionnaire) => (
                  <label key={questionnaire.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-4">
                    <input
                      type="checkbox"
                      checked={templateIds.includes(questionnaire.id)}
                      onChange={() => toggleTemplate(questionnaire.id)}
                      className="mt-1 h-4 w-4 accent-indigo-600"
                    />
                    <div>
                      <div className="font-semibold text-slate-900">{questionnaire.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{questionnaire.questions.length} 题</div>
                      <div className="mt-2 text-xs text-slate-400">templateId: {questionnaire.id}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">发放二维码</h2>
              <div className="mt-5 flex justify-center">
                <QrCodeDisplay data={envelope.publicUrl} size={280} border={4} className="max-w-sm" />
              </div>
              <pre className="mt-5 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-200">{envelope.publicUrl}</pre>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">envelope</h2>
              <dl className="mt-4 space-y-3 text-sm text-slate-600">
                <div>bundleId: <span className="font-mono text-slate-900">{envelope.bundleId}</span></div>
                <div>exchangeId: <span className="font-mono break-all text-slate-900">{envelope.exchangeId}</span></div>
                <div>maskUuid: <span className="font-mono break-all text-slate-900">{envelope.maskUuid}</span></div>
                <div>templateIds: <span className="text-slate-900">{envelope.issuePayload.templateIds.join(', ')}</span></div>
              </dl>
              <pre className="mt-5 overflow-x-auto rounded-2xl bg-slate-100 p-4 text-xs leading-6 text-slate-700">{envelope.token}</pre>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <ol className="space-y-2 text-sm leading-7 text-slate-600">
                <li>1. 护士扫/发这个二维码给患者手机。</li>
                <li>2. 患者在 `/patient?ticket=...` 页面完成填写。</li>
                <li>3. 患者端生成 `offline-answer` 单码或喷泉码，等待院内导入页消费。</li>
              </ol>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/patient" className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">打开患者页</Link>
                <Link href="/" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">返回首页</Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
