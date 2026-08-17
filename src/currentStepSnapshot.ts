/*
 * 把讀者目前的閱讀狀態組成 MCP 工具 `codewalk_current_step` 的回傳形狀。純函式,
 * 跟 `askAgentPrompt.ts` 同一個抽法——viewProvider 碰 vscode API 不好測
 * (design.md 決策 5)。
 */

import { effectiveLineRange, type AnchorStatus } from '../shared/protocol';
import type { CodewalkFile } from '../shared/schema';
import { toWorkspaceRelativePath } from './workspacePath';

/** `codewalk_current_step` 的回傳形狀。沒有作用中導讀時是合法狀態,不是錯誤(design.md 決策 5)。 */
export type CurrentStepSnapshot =
  | { active: false }
  | {
      active: true;
      walkPath: string;
      walkTitle: string;
      stepIndex: number;
      stepTitle: string;
      file: string;
      startLine: number;
      endLine: number;
      anchorStatus: AnchorStatus['kind'];
    };

/**
 * 組出 `codewalk_current_step` 的回傳內容。
 *
 * @param walk - 目前作用中的導讀;沒有作用中導讀時為 `undefined`
 * @param walkPath - 導讀檔的絕對路徑;與 `walk` 同時存在或同時缺席
 * @param stepStatus - 目前步驟的錨驗證結果,決定行號換算與回報的狀態
 *
 * @remarks
 * 行號一律走既有 `effectiveLineRange()`,路徑一律走既有 `toWorkspaceRelativePath()`
 * ——與面板顯示、`askAgentPrompt.ts` 用同一套邏輯,不重算(design.md 決策 5)。
 * 失準的步驟如實回報 `anchorStatus: 'stale'`,不隱藏(ask-agent capability
 * 「失準的步驟必須在提問中標明」的同一個精神,套用到查詢介面)。
 */
export function buildCurrentStepSnapshot(input: {
  walk: CodewalkFile | undefined;
  walkPath: string | undefined;
  workspaceRoot: string | undefined;
  stepIndex: number;
  stepStatus: AnchorStatus;
}): CurrentStepSnapshot {
  if (!input.walk || !input.walkPath) return { active: false };
  const step = input.walk.steps[input.stepIndex];
  const { startLine, endLine } = effectiveLineRange(step, input.stepStatus);

  return {
    active: true,
    walkPath: toWorkspaceRelativePath(input.workspaceRoot, input.walkPath),
    walkTitle: input.walk.title,
    stepIndex: input.stepIndex,
    stepTitle: step.title,
    file: step.file,
    startLine,
    endLine,
    anchorStatus: input.stepStatus.kind,
  };
}
