import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { validateCodewalk, type ValidationResult } from '../shared/schema';
import type { AttemptSummary, WalkFileSummary } from '../shared/protocol';

export function filterCodewalkFileNames(fileNames: string[]): string[] {
  return fileNames.filter((name) => name.endsWith('.codewalk.json')).sort();
}

export async function findCodewalkFiles(workspaceRoot: string): Promise<string[]> {
  const codewalkDir = join(workspaceRoot, '.codewalk');
  let entries: string[];
  try {
    entries = await readdir(codewalkDir);
  } catch {
    return [];
  }
  return filterCodewalkFileNames(entries).map((name) => join(codewalkDir, name));
}

export async function loadCodewalkFile(filePath: string): Promise<ValidationResult> {
  const content = await readFile(filePath, 'utf-8');
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch (err) {
    return { valid: false, errors: [`JSON 解析失敗:${(err as Error).message}`] };
  }
  return validateCodewalk(data);
}

export async function listWalkFiles(
  workspaceRoot: string,
  getAttempt?: (filePath: string, ref: string) => AttemptSummary | undefined,
): Promise<WalkFileSummary[]> {
  const filePaths = await findCodewalkFiles(workspaceRoot);
  // 並行讀取:Promise.all 保證回傳順序等同 filePaths,與檔案讀完的先後無關
  return Promise.all(
    filePaths.map(async (filePath) => {
      const result = await loadCodewalkFile(filePath);
      const summary: WalkFileSummary = {
        path: filePath,
        title: result.valid ? result.value.title : basename(filePath),
      };
      if (result.valid && getAttempt) {
        const lastAttempt = getAttempt(filePath, result.value.ref);
        if (lastAttempt) {
          summary.lastAttempt = lastAttempt;
        }
      }
      return summary;
    }),
  );
}
