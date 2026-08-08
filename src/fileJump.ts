import { existsSync } from 'node:fs';
import { t } from '../shared/i18n';
import { resolveInWorkspace } from './workspacePath';

/** 跳轉目標的行段。行號 1-based、頭尾皆含,與 `.codewalk.json` 的欄位語意一致。 */
export interface JumpTarget {
  /** 相對於 workspace 根目錄的路徑。 */
  file: string;
  startLine: number;
  endLine: number;
}

/** 跳轉結果。失敗訊息已經過 t() 翻譯,可直接顯示給讀者。 */
export type JumpResult = { ok: true } | { ok: false; reason: 'fileNotFound'; message: string };

/**
 * 跳轉方式。
 *
 * `'select'`:開檔、選取目標行段、捲動到畫面中央。
 * `'openOnly'`:只開檔,不設 selection 也不捲動——用於失準的 step/snippet,
 * 因為原本的行號已經不可信,不假裝知道游標該落在哪(design.md 決策 6)。
 */
export type JumpMode = 'select' | 'openOnly';

/**
 * 在編輯器開啟目標檔案,並依 `mode` 選取行段、捲動到畫面中央。
 *
 * 開檔一律以非預覽分頁(`preview: false`)且不搶焦點的方式進行——焦點留在
 * CodeWalk 面板,讀者才能連按方向鍵連續切換步驟,否則第一次跳轉後快捷鍵就失效。
 *
 * @param target - `endLine` 超出檔案實際行數時會自動夾到最後一行
 * @returns 檔案不存在時回傳 `{ ok: false }` 而不拋出;呼叫端把訊息轉給 webview 顯示
 *
 * @remarks
 * 成功路徑需要真實的 vscode API(`revealRange`、`Selection`),在 Vitest 的 node
 * 環境無法驗證,依 design.md 的測試策略走手動驗證 checklist;單元測試只涵蓋
 * 「檔案不存在」這條可獨立驗證的分支。`vscode` 採動態 import,讓本模組在測試
 * 環境載入時不會因為找不到 vscode runtime 而失敗。
 */
export async function jumpToStep(
  workspaceRoot: string,
  target: JumpTarget,
  mode: JumpMode = 'select',
): Promise<JumpResult> {
  const absPath = resolveInWorkspace(workspaceRoot, target.file);
  if (absPath === null || !existsSync(absPath)) {
    return { ok: false, reason: 'fileNotFound', message: t('host.fileNotFound', { file: target.file }) };
  }

  const vscode = await import('vscode');
  const doc = await vscode.workspace.openTextDocument(absPath);
  // preserveFocus:true — 不搶走 CodeWalk 面板的焦點,讓方向鍵快捷鍵在連續切換
  // 好幾個 step 時持續有效(否則第一次跳轉後焦點就會留在編輯器,快捷鍵失效)。
  const editor = await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });
  if (mode === 'openOnly') {
    return { ok: true };
  }
  const startLine = target.startLine - 1;
  const endLine = Math.min(target.endLine - 1, doc.lineCount - 1);
  const range = new vscode.Range(startLine, 0, endLine, doc.lineAt(endLine).text.length);
  editor.selection = new vscode.Selection(range.start, range.end);
  editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
  return { ok: true };
}
