import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { t } from '../shared/i18n';

export interface JumpTarget {
  file: string;
  startLine: number;
  endLine: number;
}

export type JumpResult = { ok: true } | { ok: false; reason: 'fileNotFound'; message: string };

/** 'openOnly':只開檔、不設 selection、不 revealRange——用於失準的 step/snippet,
 * 不假裝知道游標該落在哪(design.md 決策 6)。 */
export type JumpMode = 'select' | 'openOnly';

/**
 * 正常跳轉並高亮的成功路徑需要真實 vscode API(revealRange、Selection),
 * 無法在 Vitest(node 環境)裡驗證,依 design.md 的測試策略走手動驗證 checklist。
 * 這裡只把可獨立驗證的「檔案不存在」錯誤分支抽出來做 TDD。
 */
export async function jumpToStep(
  workspaceRoot: string,
  target: JumpTarget,
  mode: JumpMode = 'select',
): Promise<JumpResult> {
  const absPath = join(workspaceRoot, target.file);
  if (!existsSync(absPath)) {
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
