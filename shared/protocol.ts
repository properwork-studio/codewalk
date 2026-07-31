import type { CodewalkFile } from './schema';

export interface WalkFileSummary {
  path: string;
  title: string;
}

export type HostToWebviewMessage =
  | { type: 'walkFileList'; files: WalkFileSummary[] }
  | { type: 'walkLoaded'; walk: CodewalkFile; stepIndex: number; refDrifted: boolean }
  | { type: 'stepChanged'; stepIndex: number }
  | { type: 'loadError'; message: string };

export type WebviewToHostMessage =
  | { type: 'webviewReady' }
  | { type: 'selectWalkFile'; path: string }
  | { type: 'nextStep' }
  | { type: 'prevStep' }
  | { type: 'jumpToStep'; stepIndex: number }
  | { type: 'quizSubmitted'; answers: number[] };

function isStringArrayLike(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'number');
}

export function parseWebviewToHostMessage(data: unknown): WebviewToHostMessage | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const d = data as Record<string, unknown>;

  switch (d.type) {
    case 'webviewReady':
      return { type: 'webviewReady' };
    case 'selectWalkFile':
      return typeof d.path === 'string' ? { type: 'selectWalkFile', path: d.path } : null;
    case 'nextStep':
      return { type: 'nextStep' };
    case 'prevStep':
      return { type: 'prevStep' };
    case 'jumpToStep':
      return typeof d.stepIndex === 'number' ? { type: 'jumpToStep', stepIndex: d.stepIndex } : null;
    case 'quizSubmitted':
      return isStringArrayLike(d.answers) ? { type: 'quizSubmitted', answers: d.answers } : null;
    default:
      return null;
  }
}
