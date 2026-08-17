/*
 * MCP server 的探索檔路徑計算——每個 workspace 一份,依 workspace 路徑算 hash
 * 命名(design.md 決策 3)。純函式,實際的檔案讀寫與網路 health check 留給
 * `mcpServer.ts`。
 */

import { createHash } from 'node:crypto';
import { join } from 'node:path';

/** 探索檔記錄的內容。 */
export interface McpDiscoveryInfo {
  port: number;
  pid: number;
}

/**
 * 算出某個 workspace 對應的探索檔絕對路徑。同一個 `workspaceRoot` 一律得到
 * 同一個路徑,不同 workspace 天生不會撞到同一份檔案。
 *
 * @param tmpDir - `os.tmpdir()` 的回傳值,呼叫端傳入以便測試不依賴實際檔案系統
 */
export function computeDiscoveryFilePath(tmpDir: string, workspaceRoot: string): string {
  const hash = createHash('sha256').update(workspaceRoot).digest('hex').slice(0, 16);
  return join(tmpDir, 'codewalk-mcp', `${hash}.json`);
}
