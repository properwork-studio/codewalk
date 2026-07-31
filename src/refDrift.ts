import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execCb);

export function isRefDrifted(headSha: string, ref: string): boolean {
  return headSha.trim() !== ref.trim();
}

export async function getWorkspaceHead(workspaceRoot: string): Promise<string | null> {
  try {
    const { stdout } = await exec('git rev-parse HEAD', { cwd: workspaceRoot });
    return stdout.trim();
  } catch {
    return null;
  }
}
