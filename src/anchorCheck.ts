import { existsSync, readFileSync } from 'node:fs';
import type { AnchorItemStatus, AnchorReport, AnchorStatus, AnchorStepReport } from '../shared/protocol';
import { effectiveLineRange } from '../shared/protocol';
import type { CodewalkFile, CodewalkItem } from '../shared/schema';
import { resolveInWorkspace } from './workspacePath';

export { effectiveLineRange };

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

/**
 * 找出 anchor 在整份檔案內「行邊界對齊」的出現位置——起訖都落在換行字元或
 * 檔案頭尾,避免把恰好橫跨兩行邊界的子字串誤判成匹配(見 design.md 決策 2)。
 * 回傳的是字元位移(相對於 whole),供後續換算成行號。
 */
function findLineAlignedOffsets(whole: string, anchor: string): number[] {
  const offsets: number[] = [];
  let fromIndex = 0;
  for (;;) {
    const idx = whole.indexOf(anchor, fromIndex);
    if (idx === -1) break;
    const startsAtBoundary = idx === 0 || whole[idx - 1] === '\n';
    const endIdx = idx + anchor.length;
    const endsAtBoundary = endIdx === whole.length || whole[endIdx] === '\n';
    if (startsAtBoundary && endsAtBoundary) offsets.push(idx);
    fromIndex = idx + 1;
  }
  return offsets;
}

function lineNumberAtOffset(whole: string, offset: number): number {
  return whole.slice(0, offset).split('\n').length;
}

/**
 * 判定某個行段相對於它的 anchor 是否仍然準確,依序檢查:未錨定 → 檔案不存在 →
 * 內容相符 → 內容整段位移 → 失準。
 *
 * @param fileLines - 現行檔案的逐行內容;`null` 代表檔案已不存在
 * @param anchor - 產出當下的程式碼原文;`undefined` 或全空白視為未提供錨點
 * @returns `shifted` 只在整份檔案中找到「恰好一處」逐字相同的內容時成立;
 * 找不到或找到多處都算失準,因為無法確定該跟去哪裡
 *
 * @remarks
 * 純函式,不碰檔案系統(讀檔在 {@link buildAnchorReport})。比對前只正規化換行,
 * 刻意不 trim——縮排或尾隨空白的差異代表真實的程式碼改動(design.md 決策 2)。
 */
export function checkAnchorAgainstLines(
  fileLines: string[] | null,
  startLine: number,
  endLine: number,
  anchor: string | undefined,
): AnchorStatus {
  if (anchor === undefined || anchor.trim().length === 0) {
    return { kind: 'unanchored' };
  }
  if (fileLines === null) {
    return { kind: 'stale', reason: 'fileMissing' };
  }

  const normalizedAnchor = normalizeNewlines(anchor);
  const currentSlice = fileLines.slice(startLine - 1, endLine).join('\n');
  if (currentSlice === normalizedAnchor) {
    return { kind: 'matched' };
  }

  const whole = fileLines.join('\n');
  const offsets = findLineAlignedOffsets(whole, normalizedAnchor);
  if (offsets.length === 0) {
    return { kind: 'stale', reason: 'notFound' };
  }
  if (offsets.length > 1) {
    return { kind: 'stale', reason: 'ambiguous' };
  }

  const newStartLine = lineNumberAtOffset(whole, offsets[0]);
  const anchorLineCount = normalizedAnchor.split('\n').length;
  return {
    kind: 'shifted',
    startLine: newStartLine,
    endLine: newStartLine + anchorLineCount - 1,
  };
}

function readLinesOrNull(workspaceRoot: string, file: string): string[] | null {
  const absPath = resolveInWorkspace(workspaceRoot, file);
  if (absPath === null || !existsSync(absPath)) return null;
  return readFileSync(absPath, 'utf8').split('\n');
}

/**
 * 對整份導讀的所有 step 與 snippet 執行錨驗證,每個檔案只讀一次(見 design.md
 * Context 的效能實測:21 步/40 個錨/23 個相異檔案,最壞情況 0.70 ms)。
 */
export function buildAnchorReport(workspaceRoot: string, walk: CodewalkFile): AnchorReport {
  const lineCache = new Map<string, string[] | null>();
  function linesFor(file: string): string[] | null {
    if (!lineCache.has(file)) {
      lineCache.set(file, readLinesOrNull(workspaceRoot, file));
    }
    return lineCache.get(file) ?? null;
  }

  let anyAnchored = false;
  let staleCount = 0;

  function track(status: AnchorStatus): AnchorStatus {
    if (status.kind !== 'unanchored') anyAnchored = true;
    if (status.kind === 'stale') staleCount++;
    return status;
  }

  const steps: AnchorStepReport[] = walk.steps.map((step) => {
    const stepStatus = track(
      checkAnchorAgainstLines(linesFor(step.file), step.startLine, step.endLine, step.anchor),
    );

    const items: AnchorItemStatus[] = (step.items ?? []).flatMap((item, itemIndex) => {
      if (item.kind !== 'snippet') return [];
      const snippet = item as Extract<CodewalkItem, { kind: 'snippet' }>;
      const status = track(
        checkAnchorAgainstLines(linesFor(snippet.file), snippet.startLine, snippet.endLine, snippet.anchor),
      );
      return [{ itemIndex, status }];
    });

    return { step: stepStatus, items };
  });

  return { anyAnchored, anyStale: staleCount > 0, staleCount, steps };
}

/** 失準時只開檔、不選取任何行——不假裝知道游標該落在哪(design.md 決策 6)。 */
export function jumpModeFor(status: AnchorStatus): 'select' | 'openOnly' {
  return status.kind === 'stale' ? 'openOnly' : 'select';
}

/** 沒有 workspace root 時(理論上不會發生於一般流程)退回全部未錨定,行為與無錨導讀一致。 */
export function emptyAnchorReport(walk: CodewalkFile): AnchorReport {
  return {
    anyAnchored: false,
    anyStale: false,
    staleCount: 0,
    steps: walk.steps.map(() => ({ step: { kind: 'unanchored' }, items: [] })),
  };
}
