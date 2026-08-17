/*
 * workspace 相對路徑與絕對路徑之間的轉換,雙向都在這裡——解析相對路徑時要擋
 * 逸出,顯示絕對路徑時要盡量換成相對路徑,兩者都圍繞同一個 workspace 邊界。
 */

import { relative, resolve, sep } from 'node:path';

/**
 * 解析 `file` 相對於 workspace 根目錄的絕對路徑,越界時回傳 `null`。
 *
 * @param file - 導讀檔的 `file` 欄位,預期是 workspace 相對路徑
 * @returns 落在 workspace 內的絕對路徑;越界或解析失敗時為 `null`
 *
 * @remarks
 * 這是第二層防護。`shared/schema.ts` 的 `isWorkspaceRelativePath()` 已經在載入
 * 時擋掉帶 `..` 與絕對路徑的導讀,但那一層只看得到字串本身——workspace 內的
 * symlink 指向外部時,字串完全合法,解析後才會越界。所以圍堵必須在真正拿到
 * 絕對路徑之後再做一次。
 *
 * 比對加上 `sep` 是必要的:`/repo-secrets` 以 `/repo` 開頭,但它不在 `/repo`
 * 裡面,少了分隔符就會誤放行這種同前綴的相鄰目錄。
 */
export function resolveInWorkspace(workspaceRoot: string, file: string): string | null {
  const root = resolve(workspaceRoot);
  const absPath = resolve(root, file);
  if (absPath !== root && !absPath.startsWith(root + sep)) return null;
  return absPath;
}

/**
 * 把絕對路徑換成 workspace 相對路徑,給讀者或 agent 看的顯示用途。能算出相對
 * 路徑就用相對路徑,否則(不在 workspace 內、或沒有已開啟的 workspace)退回
 * 絕對路徑——讀不到相對路徑的呼叫端通常仍有檔案系統存取,絕對路徑一樣找得到
 * (原本是 `askAgentPrompt.ts` 的私有函式 `toPromptPath`,ask-agent capability
 * 「導讀檔位於專案之外」;`add-mcp-bridge` 的 `codewalk_current_step`/
 * `codewalk_list_walks` 也要用同一套換算,搬來這裡共用)。
 *
 * @remarks
 * 一律正規化為正斜線:`path.relative()` 在 Windows 上回傳反斜線,而導讀檔內的
 * `file` 欄位本來就是正斜線,混用會讓輸出看起來像兩個不同的專案。
 */
export function toWorkspaceRelativePath(workspaceRoot: string | undefined, absolutePath: string): string {
  if (!workspaceRoot) return absolutePath;
  const rel = relative(workspaceRoot, absolutePath);
  if (rel.startsWith('..')) return absolutePath;
  return rel.split(sep).join('/');
}
