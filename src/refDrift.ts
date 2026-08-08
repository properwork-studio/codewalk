import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execCb);

/**
 * 導讀釘住的 commit 是否已與現行 HEAD 不同。
 *
 * @remarks
 * 整份導讀層級的粗略判斷:只要 commit 不同就成立,不論被導讀的檔案是否真的改過。
 * 步驟帶有 `anchor` 時,改用逐步的錨驗證(見 `anchorCheck.ts`)取代這個警告,
 * 因為它精確得多。
 */
export function isRefDrifted(headSha: string, ref: string): boolean {
  return headSha.trim() !== ref.trim();
}

/**
 * 取得 workspace 目前的 HEAD commit SHA。
 *
 * @returns 非 git 專案、git 不可用、或指令失敗時回傳 null——此時單純不做漂移
 * 偵測,不影響導讀播放
 */
export async function getWorkspaceHead(workspaceRoot: string): Promise<string | null> {
  try {
    const { stdout } = await exec('git rev-parse HEAD', { cwd: workspaceRoot });
    return stdout.trim();
  } catch {
    return null;
  }
}
