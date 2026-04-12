import pako from 'pako';
import { Base64 } from 'js-base64';
import { blockToBinary, createEncoder, toBase64 } from '@/lib/lt-encoder';
import type {
  Answer,
  OfflineAnswerEntry,
  OfflineImportPayload,
  OfflineIssuePayload,
  OfflineQuestionnaireBundlePayload,
  OfflineTransportMode,
  QuestionType,
} from '@/types';

export const OFFLINE_PROTOCOL_VERSION = 'OQX/1';
export const DEFAULT_SINGLE_QR_CAPACITY = 1600;

function toUrlSafeBase64(value: string): string {
  return String(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromUrlSafeBase64(value: string): string {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padLength = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  return `${normalized}${'='.repeat(padLength)}`;
}

export function normalizePatientBundleFrame(rawValue: string): string {
  if (!rawValue) return '';
  const wrappedFrame = extractPatientBundleFrame(rawValue);
  if (wrappedFrame?.frame) return wrappedFrame.frame;
  if (/^[A-Za-z0-9+/_-]+$/.test(rawValue) && !/[?&=]/.test(rawValue)) {
    return fromUrlSafeBase64(rawValue);
  }
  return rawValue;
}

export function createOfflineExchangeId(prefix = 'oqr'): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`.toUpperCase();
}

export function createMaskUuid(prefix = 'm'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`.toUpperCase();
}

export function createAnswerSheetId(prefix = 'ans'): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${random}`.toUpperCase();
}

export function encodeOfflinePayload(payload: unknown): string {
  const source = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const compressed = pako.deflate(source);
  return toUrlSafeBase64(Base64.fromUint8Array(compressed));
}

export function decodeOfflinePayload<T>(payload: string): T {
  const compressed = Base64.toUint8Array(fromUrlSafeBase64(payload));
  const decoded = pako.inflate(compressed, { to: 'string' });
  return JSON.parse(decoded) as T;
}

export function estimateOfflineTransport(
  payload: unknown,
  options: { frameCapacity?: number; alreadyEncoded?: boolean } = {}
): {
  mode: OfflineTransportMode;
  size: number;
  estimatedFrames: number;
} {
  const frameCapacity = options.frameCapacity || DEFAULT_SINGLE_QR_CAPACITY;
  const encoded = options.alreadyEncoded
    ? String(payload)
    : encodeOfflinePayload(payload);
  const size = encoded.length;
  const estimatedFrames = Math.max(1, Math.ceil(size / frameCapacity));
  const mode: OfflineTransportMode = estimatedFrames > 1 ? 'fountain' : 'single';

  return {
    mode,
    size,
    estimatedFrames,
  };
}

export function serializeOfflineAnswers(
  answers: Record<string, Answer>
): OfflineAnswerEntry[] {
  return Object.entries(answers)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, answer]) => {
      const [templateId, questionId] = key.split(':');
      return {
        templateId,
        fieldKey: '',
        questionId: Number(questionId),
        questionType: answer.type as QuestionType,
        value: normalizeAnswerValue(answer),
      };
    });
}

function normalizeAnswerValue(answer: Answer): string | number | string[] {
  if (answer.type === 'multiple') {
    return [...answer.value].sort();
  }

  return answer.value;
}

export function buildOfflineIssueEnvelope(options: {
  exchangeId?: string;
  maskUuid?: string;
  bundleId?: string;
  templateIds?: string[];
  publicBaseUrl?: string;
} = {}) {
  const exchangeId = options.exchangeId || createOfflineExchangeId();
  const maskUuid = options.maskUuid || createMaskUuid();
  const templateIds = Array.isArray(options.templateIds) ? options.templateIds.filter(Boolean) : [];
  const bundleId = options.bundleId || 'STUDIO-QUESTIONNAIRE-BUNDLE';
  const publicBaseUrl = options.publicBaseUrl || 'https://qr-trans.test.conova.withinfuel.com/patient';
  const issuePayload: OfflineIssuePayload = {
    version: OFFLINE_PROTOCOL_VERSION,
    transport: 'public-link',
    exchangeId,
    maskUuid,
    bundleId,
    templateIds,
  };
  const token = encodeOfflinePayload(issuePayload);

  return {
    exchangeId,
    maskUuid,
    bundleId,
    token,
    issuePayload,
    publicUrl: `${publicBaseUrl}?ticket=${encodeURIComponent(token)}`,
  };
}

export function buildPatientBundleFrameLink(options: {
  publicUrl: string;
  frame: string;
  frameIndex?: number;
  frameCount?: number;
}) {
  const target = new URL(options.publicUrl);
  const ticket = target.searchParams.get('ticket') || target.searchParams.get('t') || '';
  target.search = '';
  if (ticket) target.searchParams.set('t', ticket);
  target.searchParams.set('f', toUrlSafeBase64(options.frame));
  if (options.frameIndex) target.searchParams.set('i', String(options.frameIndex));
  if (options.frameCount) target.searchParams.set('n', String(options.frameCount));
  return target.toString();
}

export function extractPatientBundleFrame(rawValue: string): {
  frame: string;
  ticket: string;
  frameIndex: number;
  frameCount: number;
  href: string;
} | null {
  if (!rawValue) return null;
  try {
    const url = new URL(rawValue);
    const ticket = url.searchParams.get('ticket') || url.searchParams.get('t') || '';
    const compactFrame = url.searchParams.get('f') || '';
    const legacyFrame = url.searchParams.get('bundleFrame') || '';
    const frame = compactFrame ? fromUrlSafeBase64(compactFrame) : legacyFrame;
    if (!frame) return null;
    return {
      frame,
      ticket,
      frameIndex: Number(url.searchParams.get('i') || url.searchParams.get('frameIndex') || 0),
      frameCount: Number(url.searchParams.get('n') || url.searchParams.get('frameCount') || 0),
      href: url.toString(),
    };
  } catch (error) {
    return null;
  }
}

export function buildOfflineImportEnvelope(options: {
  exchangeId?: string;
  maskUuid?: string;
  answerSheetId?: string;
  templateIds?: string[];
  answers?: OfflineAnswerEntry[];
  frameCapacity?: number;
} = {}) {
  const payload: OfflineImportPayload = {
    version: OFFLINE_PROTOCOL_VERSION,
    transport: 'offline-answer',
    exchangeId: options.exchangeId || createOfflineExchangeId(),
    maskUuid: options.maskUuid || createMaskUuid(),
    answerSheetId: options.answerSheetId || createAnswerSheetId(),
    templateIds: Array.isArray(options.templateIds) ? options.templateIds.filter(Boolean) : [],
    answers: Array.isArray(options.answers) ? options.answers : [],
  };

  const token = encodeOfflinePayload(payload);
  const transport = estimateOfflineTransport(token, {
    frameCapacity: options.frameCapacity,
    alreadyEncoded: true,
  });

  return {
    ...transport,
    payload,
    token,
  };
}

export function parseOfflineIssueTicket(ticket: string): OfflineIssuePayload {
  const payload = decodeOfflinePayload<OfflineIssuePayload>(ticket);

  if (payload.version !== OFFLINE_PROTOCOL_VERSION || payload.transport !== 'public-link') {
    throw new Error('发放码版本或传输类型不匹配');
  }

  return payload;
}

export function buildLtQrTransport(payload: unknown, options: { sliceSize?: number } = {}) {
  const source = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const encoder = createEncoder(source, {
    sliceSize: options.sliceSize || 420,
    compress: true,
  });
  const mode: OfflineTransportMode = encoder.k > 1 ? 'fountain' : 'single';
  const frames: string[] = [];

  if (mode === 'single') {
    frames.push(toBase64(blockToBinary(encoder.createBlock([0]))));
  } else {
    const iterator = encoder.fountain();
    const totalFrames = Math.max(encoder.k + 6, encoder.k * 3);
    for (let index = 0; index < totalFrames; index += 1) {
      frames.push(toBase64(blockToBinary(iterator.next().value)));
    }
  }

  return {
    mode,
    estimatedFrames: frames.length,
    payloadBytes: encoder.bytes,
    frames,
  };
}

export function isQuestionnaireBundlePayload(payload: unknown): payload is OfflineQuestionnaireBundlePayload {
  return Boolean(
    payload &&
    typeof payload === 'object' &&
    (payload as OfflineQuestionnaireBundlePayload).version === OFFLINE_PROTOCOL_VERSION &&
    (payload as OfflineQuestionnaireBundlePayload).transport === 'questionnaire-bundle'
  );
}
