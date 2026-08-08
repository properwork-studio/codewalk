import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { t } from '../shared/i18n';
import { detectLanguage } from '../shared/language';
import type { AnchorItemStatus, SnippetPreviewResult } from '../shared/protocol';
import type { CodewalkItem } from '../shared/schema';
import { effectiveLineRange } from './anchorCheck';

type SnippetItem = Extract<CodewalkItem, { kind: 'snippet' }>;

/**
 * 只讀取「目前 step」的 snippet 內容,隨 walkLoaded/stepChanged 一起送到 webview——
 * 不預讀整份 walk,避免不必要的磁碟 I/O(見 design.md 決策 3)。
 *
 * `itemStatuses` 是該 step 的 items 對應的錨驗證結果(由 anchorCheck.buildAnchorReport
 * 產生);省略時等同全部視為未錨定,行為與加入本功能前完全一致。位移時改讀新行號範圍;
 * 失準時改回傳 anchor 內容(檔案仍存在時 source 標為 'anchor',檔案不存在時連同
 * 「找不到檔案」訊息一併回傳,見 stale-step-detection capability)。
 */
export async function readSnippetPreviews(
  workspaceRoot: string,
  items: CodewalkItem[],
  itemStatuses: AnchorItemStatus[] = [],
): Promise<SnippetPreviewResult[]> {
  const results: SnippetPreviewResult[] = [];
  items.forEach((item, itemIndex) => {
    if (item.kind !== 'snippet') return;
    const snippet = item as SnippetItem;
    const status = itemStatuses.find((s) => s.itemIndex === itemIndex)?.status ?? {
      kind: 'unanchored' as const,
    };
    const language = detectLanguage(snippet.file);

    if (status.kind === 'stale') {
      if (status.reason === 'fileMissing') {
        results.push({
          itemIndex,
          ok: false,
          message: t('host.fileNotFound', { file: snippet.file }),
          anchorContent: snippet.anchor,
          language,
        });
      } else {
        results.push({ itemIndex, ok: true, content: snippet.anchor ?? '', language, source: 'anchor' });
      }
      return;
    }

    const absPath = join(workspaceRoot, snippet.file);
    if (!existsSync(absPath)) {
      results.push({ itemIndex, ok: false, message: t('host.fileNotFound', { file: snippet.file }) });
      return;
    }
    const lines = readFileSync(absPath, 'utf8').split('\n');
    const { startLine, endLine } = effectiveLineRange(snippet, status);
    const content = lines.slice(startLine - 1, endLine).join('\n');
    results.push({ itemIndex, ok: true, content, language, source: 'current' });
  });
  return results;
}
