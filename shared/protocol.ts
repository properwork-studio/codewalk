import type { CodewalkFile } from './schema';

export interface AttemptSummary {
  at: number;
  score: number;
  total: number;
  passed: boolean;
}

export interface WalkFileSummary {
  path: string;
  title: string;
  lastAttempt?: AttemptSummary;
}

export type SnippetPreviewResult =
  | { itemIndex: number; ok: true; content: string; language: string }
  | { itemIndex: number; ok: false; message: string };

/** VS Code 主題 JSON 的 tokenColors 條目;scope 可以是單一字串或字串陣列。 */
export interface ThemeTokenColorRule {
  scope: string | string[];
  settings: { foreground?: string; fontStyle?: string };
}

/**
 * 由 host 解析讀者當前 VS Code 主題後送往 webview 的結果。name 由 host 每次
 * 解析時遞增產生,不重複使用——Shiki 的 loadTheme() 對同名主題重載是 no-op
 * (已實測),同名會讓「切換主題後重繪」失效,見 design.md 決策 3 的修訂。
 */
export interface ResolvedEditorTheme {
  name: string;
  kind: 'light' | 'dark';
  tokenColors: ThemeTokenColorRule[];
}

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
  | { type: 'stepJumpError'; message: string }
  | {
      type: 'themeChanged';
      /** host 無法解析讀者當前主題時為 null,webview 改依 kind 選用內建主題。 */
      theme: ResolvedEditorTheme | null;
      kind: 'light' | 'dark';
    };

export type WebviewToHostMessage =
  | { type: 'webviewReady' }
  | { type: 'selectWalkFile'; path: string }
  | { type: 'nextStep' }
  | { type: 'prevStep' }
  | { type: 'jumpToStep'; stepIndex: number }
  | { type: 'quizSubmitted'; answers: number[] }
  | { type: 'openReference'; url: string }
  | { type: 'jumpToSnippet'; stepIndex: number; itemIndex: number }
  | { type: 'clearAttempt'; path: string };

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
    case 'clearAttempt':
      return typeof d.path === 'string' ? { type: 'clearAttempt', path: d.path } : null;
    default:
      return null;
  }
}
