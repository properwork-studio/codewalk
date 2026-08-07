import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateCodewalk } from '../shared/schema';
import { buildAnchorReport } from '../src/anchorCheck';

/**
 * 本 repo 自己的 `.codewalk/` 導讀是對外的門面(讀者裝完 extension 第一個看到的
 * 東西),但它是程式碼的衍生快照,會隨 src/ui/shared 的改動悄悄過期。這支測試
 * 讓過期變成紅燈:錨點一旦對不上現行程式碼就失敗,提醒該重新產生導讀。
 *
 * 注意錨點的判定粒度——單純的行號位移會被判為 shifted 而非 stale,所以純粹在
 * 檔案上方增刪幾行(例如替 package.json 補上架欄位)不會讓這支測試變紅。
 */
const ROOT = join(__dirname, '..');
const WALK_DIR = join(ROOT, '.codewalk');

const walkFiles = readdirSync(WALK_DIR)
  .filter((name) => name.endsWith('.codewalk.json'))
  .sort();

describe('repo 自帶的導讀', () => {
  it('至少有一份導讀', () => {
    expect(walkFiles.length).toBeGreaterThan(0);
  });

  describe.each(walkFiles)('%s', (fileName) => {
    const result = validateCodewalk(JSON.parse(readFileSync(join(WALK_DIR, fileName), 'utf8')));

    it('通過 schema 驗證', () => {
      expect(result.valid ? [] : result.errors).toEqual([]);
    });

    it('每個 step 與 snippet 的錨點都對得上現行程式碼', () => {
      if (!result.valid) throw new Error('schema 未通過,略過錨點檢查');
      const report = buildAnchorReport(ROOT, result.value);
      const stale: string[] = [];
      report.steps.forEach((stepReport, i) => {
        const step = result.value.steps[i];
        if (stepReport.step.kind === 'stale') {
          stale.push(`第 ${i + 1} 步(${step.file}):${stepReport.step.reason}`);
        }
        stepReport.items.forEach(({ itemIndex, status }) => {
          if (status.kind === 'stale') {
            stale.push(`第 ${i + 1} 步的 items[${itemIndex}]:${status.reason}`);
          }
        });
      });
      expect(stale).toEqual([]);
    });

    it('每個 step 都有 anchor——沒有錨點就無從偵測過期', () => {
      if (!result.valid) throw new Error('schema 未通過,略過錨點檢查');
      const unanchored = result.value.steps
        .map((step, i) => (step.anchor?.trim() ? null : `第 ${i + 1} 步(${step.file})`))
        .filter((x): x is string => x !== null);
      expect(unanchored).toEqual([]);
    });
  });
});
