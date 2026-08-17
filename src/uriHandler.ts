/*
 * `vscode://{publisher}.{name}/open?walk=<workspace 相對路徑>&step=<0-based 索引,選填>`
 * 的解析——agent 產完導讀後可以直接開面板並跳到指定步驟(design.md 決策 7)。
 * 路徑與 workspace 邊界的檢查全部交給 `WalkPlayerViewProvider.openWalkFromUri()`,
 * 這裡只做 URI 本身的語法解析,刻意不碰 `vscode` API 好讓解析邏輯可以獨立測試。
 */

import type { WalkPlayerViewProvider } from './viewProvider';

/** `vscode.Uri` 中這支函式實際用到的部分——用結構型別而非 import `vscode`,讓解析邏輯不依賴 vscode 模組。 */
export interface OpenUriLike {
  path: string;
  query: string;
}

/** 解析出的 `open` 請求;`uri.path` 不是 `/open` 或缺少 `walk` 參數時為 `null`。 */
export function parseOpenUri(uri: OpenUriLike): { walk: string; stepIndex?: number } | null {
  if (uri.path !== '/open') return null;
  const params = new URLSearchParams(uri.query);
  const walk = params.get('walk');
  if (!walk) return null;
  const stepParam = params.get('step');
  if (stepParam === null) return { walk };
  const stepIndex = Number(stepParam);
  if (!Number.isInteger(stepIndex) || stepIndex < 0) return { walk };
  return { walk, stepIndex };
}

/** 註冊給 `vscode.window.registerUriHandler` 的 handler 物件。 */
export function createUriHandler(provider: WalkPlayerViewProvider): { handleUri(uri: OpenUriLike): void } {
  return {
    handleUri(uri: OpenUriLike): void {
      const parsed = parseOpenUri(uri);
      if (!parsed) return;
      void provider.openWalkFromUri(parsed.walk, parsed.stepIndex);
    },
  };
}
