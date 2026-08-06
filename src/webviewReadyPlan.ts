import type { AnchorReport, HostToWebviewMessage, SnippetPreviewResult } from '../shared/protocol';
import type { CodewalkFile } from '../shared/schema';

export interface ActiveWalkState {
  walk: CodewalkFile;
  stepIndex: number;
  refDrifted: boolean;
  anchorReport: AnchorReport;
}

/**
 * webviewReady 時是否該回灌目前導讀,以及回灌的訊息內容——host 端仍持有
 * `active` 代表 webview 在同一個 session 內被重建(view 被拖到別的容器、
 * 資源壓力回收);host 重啟後這個值必為 undefined,不會誤觸發跨重啟的回灌
 * (design.md 決策 1)。不依賴 vscode runtime,純函式可獨立測試。
 */
export function buildWalkRestoredMessage(
  active: ActiveWalkState | undefined,
  snippetPreviews: SnippetPreviewResult[],
): HostToWebviewMessage | null {
  if (!active) return null;
  return {
    type: 'walkRestored',
    walk: active.walk,
    stepIndex: active.stepIndex,
    refDrifted: active.refDrifted,
    anchorReport: active.anchorReport,
    snippetPreviews,
  };
}
