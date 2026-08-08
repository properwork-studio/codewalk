/*
 * 把導讀檔裡的相對路徑解析成絕對路徑,並確保結果沒有離開 workspace。
 */

import { resolve, sep } from 'node:path';

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
