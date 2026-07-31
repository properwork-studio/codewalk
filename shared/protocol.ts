import type { CodewalkFile } from './schema';

export interface WalkFileSummary {
  path: string;
  title: string;
}

export type SnippetPreviewResult =
  | { itemIndex: number; ok: true; content: string; language: string }
  | { itemIndex: number; ok: false; message: string };

export type HostToWebviewMessage =
  | { type: 'walkFileList'; files: WalkFileSummary[] }
  | {
      type: 'walkLoaded';
      walk: CodewalkFile;
      stepIndex: number;
      refDrifted: boolean;
      snippetPreviews: SnippetPreviewResult[];
    }
  | { type: 'stepChanged'; stepIndex: number; snippetPreviews: SnippetPreviewResult[] }
  | { type: 'loadError'; message: string }
  | { type: 'stepJumpError'; message: string };

export type WebviewToHostMessage =
  | { type: 'webviewReady' }
  | { type: 'selectWalkFile'; path: string }
  | { type: 'nextStep' }
  | { type: 'prevStep' }
  | { type: 'jumpToStep'; stepIndex: number }
  | { type: 'quizSubmitted'; answers: number[] }
  | { type: 'openReference'; url: string }
  | { type: 'jumpToSnippet'; stepIndex: number; itemIndex: number };

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
    case 'openReference':
      return typeof d.url === 'string' ? { type: 'openReference', url: d.url } : null;
    case 'jumpToSnippet':
      return typeof d.stepIndex === 'number' && typeof d.itemIndex === 'number'
        ? { type: 'jumpToSnippet', stepIndex: d.stepIndex, itemIndex: d.itemIndex }
        : null;
    default:
      return null;
  }
}
