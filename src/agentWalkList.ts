/*
 * 把 `listWalkFiles()` 的回傳形狀轉成 MCP 工具 `codewalk_list_walks` 的回傳
 * 形狀——只取 agent 用得到的欄位,路徑換算成 workspace 相對路徑。純函式。
 */

import type { WalkFileSummary } from '../shared/protocol';
import { toWorkspaceRelativePath } from './workspacePath';

/** `codewalk_list_walks` 的回傳形狀。 */
export interface AgentWalkListResult {
  walks: Array<{ path: string; title: string }>;
}

/**
 * @param files - `listWalkFiles()` 的回傳,已含作答/進度摘要等 webview 列表畫面
 * 才需要的欄位——這裡只挑 agent 需要的兩個
 */
export function buildAgentWalkList(
  files: WalkFileSummary[],
  workspaceRoot: string | undefined,
): AgentWalkListResult {
  return {
    walks: files.map((file) => ({
      path: toWorkspaceRelativePath(workspaceRoot, file.path),
      title: file.title,
    })),
  };
}
