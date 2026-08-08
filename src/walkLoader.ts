/*
 * 導讀檔的探索、讀取與驗證。extension 只從 workspace 根目錄的 `.codewalk/`
 * 讀檔,不遞迴搜尋整個 workspace。
 */

import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { validateCodewalk, type ValidationResult } from '../shared/schema';
import type { AttemptSummary, WalkFileSummary, WalkProgressSummary } from '../shared/protocol';

/**
 * 從檔名清單篩出導讀檔並依檔名排序。
 *
 * @remarks
 * 與檔案系統分離的純函式,讓副檔名規則與排序行為可以獨立測試。排序讓列表順序
 * 穩定,不隨 readdir 的回傳順序(依作業系統與檔案系統而異)浮動。
 */
export function filterCodewalkFileNames(fileNames: string[]): string[] {
  return fileNames.filter((name) => name.endsWith('.codewalk.json')).sort();
}

/**
 * 列出 workspace 中所有導讀檔的絕對路徑。
 *
 * @returns `.codewalk/` 不存在或無法讀取時回傳空陣列——沒有導讀不是錯誤,
 * 面板顯示空列表即可
 */
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

/**
 * 讀取並驗證單一導讀檔。
 *
 * @returns JSON 解析失敗與 schema 驗證失敗都回傳 `{ valid: false }`,錯誤訊息
 * 格式一致,呼叫端不需要分辨是哪一種
 * @throws 檔案不存在或無法讀取時,由 `readFile` 直接拋出
 */
export async function loadCodewalkFile(filePath: string): Promise<ValidationResult> {
  const content = await readFile(filePath, 'utf-8');
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch (err) {
    // .codewalk.json 的解析錯誤與 shared/schema.ts 的驗證錯誤同屬格式合約的
    // 診斷輸出,一併固定英文、不經 t()(interface-localization capability
    // 「格式驗證錯誤固定英文」)。
    return { valid: false, errors: [`Failed to parse JSON: ${(err as Error).message}`] };
  }
  return validateCodewalk(data);
}

/**
 * 組出導讀列表畫面所需的完整資料:掃描、讀檔、驗證,並併入作答紀錄與閱讀進度。
 *
 * @param getAttempt - 查詢該導讀的最後作答紀錄;省略則列表不顯示作答狀態
 * @param getProgress - 查詢該導讀的閱讀進度;省略則列表不顯示接續入口
 *
 * @remarks
 * 兩個查詢以回呼傳入而非直接相依 store,是為了讓本模組不必碰 vscode 的
 * workspaceState,維持可獨立測試。驗證失敗的檔案仍會列出(標題退回檔名),
 * 讓讀者點得進去看到錯誤訊息,而不是安靜消失。
 */
export async function listWalkFiles(
  workspaceRoot: string,
  getAttempt?: (filePath: string, ref: string) => AttemptSummary | undefined,
  getProgress?: (filePath: string, ref: string) => WalkProgressSummary | undefined,
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
      if (result.valid && getProgress) {
        const progress = getProgress(filePath, result.value.ref);
        if (progress) {
          summary.progress = progress;
        }
      }
      return summary;
    }),
  );
}
