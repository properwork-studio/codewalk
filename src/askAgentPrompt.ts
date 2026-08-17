/*
 * 把「讀者交出這一步」組成一段提問文字。純函式,是這個功能唯一值得單元測試的
 * 邏輯——輸入 walk、stepIndex、選取文字、錨定狀態,輸出字串;viewProvider 碰
 * vscode API 不好測(design.md 決策 3)。
 */

import { t } from '../shared/i18n';
import { effectiveLineRange, type AnchorStatus } from '../shared/protocol';
import type { CodewalkFile } from '../shared/schema';
import { toWorkspaceRelativePath } from './workspacePath';

/**
 * 組出交給 AI 助手的提問內容。
 *
 * @param walkPath - 導讀檔的絕對路徑
 * @param workspaceRoot - workspace 根目錄;沒有已開啟的 workspace 時為 `undefined`
 * @param stepStatus - 目前步驟的錨驗證結果,決定行號換算與是否附加失準警示
 * @param selection - 讀者框選的文字;未框選時省略,提問以整步為對象
 *
 * @remarks
 * 刻意不含 `narration` 全文——實測本 repo 兩份導讀 narration 中位數落在
 * 545~1305 字元,全帶會讓 chat 輸入框需要捲動才看得完(design.md 決策 1)。
 * 提問改帶指標(導讀檔路徑 + 步驟索引),讓 agent 自己讀進去,拿到的比塞給它
 * 的更多。
 */
export function buildAskAgentPrompt(input: {
  walk: CodewalkFile;
  walkPath: string;
  workspaceRoot: string | undefined;
  stepIndex: number;
  stepStatus: AnchorStatus;
  selection?: string;
}): string {
  const step = input.walk.steps[input.stepIndex];
  const location = toWorkspaceRelativePath(input.workspaceRoot, input.walkPath);
  const { startLine, endLine } = effectiveLineRange(step, input.stepStatus);

  const lines = [
    t('askAgent.promptIntro', { step: input.stepIndex + 1, title: step.title }),
    t('askAgent.promptLocation', { path: location, index: input.stepIndex }),
    t('askAgent.promptFileRef', { file: step.file, startLine, endLine }),
  ];

  if (input.stepStatus.kind === 'stale') {
    lines.push(t('askAgent.promptStale'));
  }

  if (input.selection !== undefined) {
    lines.push('', t('askAgent.promptSelectionLabel'), input.selection);
  }

  lines.push('', t('askAgent.promptInstruction', { index: input.stepIndex }));

  return lines.join('\n');
}
