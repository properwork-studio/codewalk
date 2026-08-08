#!/usr/bin/env node
// 把 .codewalk/ 自帶導讀的 anchor 與行號重新對齊現行程式碼。
//
// 背景:anchor 存的是「產出當下的程式碼原文」,逐字比對。只要被導讀的檔案有
// 任何改動(連只改註解都算),對應的 step/snippet 就會失準——讀者會看到「這份
// 導讀有步驟已與現行程式碼不符」的重生提示,tests/repoWalks.test.ts 也會紅。
//
// 依 regenerateHint 整份重新產生導讀成本高得多,而且會連 narration 一起改寫。
// 多數情況下敘述仍然正確,需要的只是機械對齊——這支腳本就是做這件事。
//
// 用法:
//   pnpm relocate-anchors                     # 預覽:只報告不寫入(有待處理項目時 exit 1)
//   pnpm relocate-anchors --write             # 實際寫回 anchor 與行號
//   pnpm relocate-anchors --write --ref HEAD  # 同時把 ref 更新為目前 HEAD
//   pnpm relocate-anchors --write --ref <sha> # 更新為指定 commit
//
// 三種判定與處置(判定邏輯與 src/anchorCheck.ts 一致):
//   matched  內容與行號都對得上   → 不動
//   shifted  內容整段位移         → 只更新行號,anchor 內容不變
//   stale    找不到或找到多處     → 重新定位後改寫 anchor 與行號
//
// 重新定位只保證「新舊區段的兩端錨定在同一個宣告上」,不保證語意完全等價。
// --write 之後務必用 git diff 檢查,特別是原本就跨越多個宣告的長區段。

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WALK_DIR = join(REPO_ROOT, '.codewalk');

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const refIndex = args.indexOf('--ref');
const REF_ARG = refIndex >= 0 ? args[refIndex + 1] : null;

const normalize = (text) => text.replace(/\r\n/g, '\n');
const readLines = (file) => readFileSync(join(REPO_ROOT, file), 'utf8').split('\n');

/** 起訖都落在換行或檔案頭尾的出現位置,與 src/anchorCheck.ts 的 findLineAlignedOffsets 同義。 */
function lineAlignedOffsets(whole, anchor) {
  const offsets = [];
  let fromIndex = 0;
  for (;;) {
    const idx = whole.indexOf(anchor, fromIndex);
    if (idx === -1) break;
    const endIdx = idx + anchor.length;
    const startsAtBoundary = idx === 0 || whole[idx - 1] === '\n';
    const endsAtBoundary = endIdx === whole.length || whole[endIdx] === '\n';
    if (startsAtBoundary && endsAtBoundary) offsets.push(idx);
    fromIndex = idx + 1;
  }
  return offsets;
}

function checkStatus(target) {
  if (!existsSync(join(REPO_ROOT, target.file))) {
    return { kind: 'stale', reason: 'fileMissing' };
  }
  const lines = readLines(target.file);
  const anchor = normalize(target.anchor);
  if (lines.slice(target.startLine - 1, target.endLine).join('\n') === anchor) {
    return { kind: 'matched' };
  }
  const whole = lines.join('\n');
  const offsets = lineAlignedOffsets(whole, anchor);
  if (offsets.length === 1) {
    const startLine = whole.slice(0, offsets[0]).split('\n').length;
    return { kind: 'shifted', startLine, endLine: startLine + anchor.split('\n').length - 1 };
  }
  return { kind: 'stale', reason: offsets.length === 0 ? 'notFound' : 'ambiguous' };
}

const isCommentOrBlank = (line) => {
  const t = line.trim();
  return t === '' || t.startsWith('*') || t.startsWith('/*') || t.startsWith('//');
};

/** 該行在整份檔案中恰好出現一次時回傳其索引,否則 -1。 */
function uniqueLineIndex(lines, target) {
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === target) hits.push(i);
    if (hits.length > 1) return -1;
  }
  return hits.length === 1 ? hits[0] : -1;
}

/**
 * 兩端各自獨立定位:頭端取 anchor 開頭第一個「在新檔案唯一出現」的實質程式碼行,
 * 尾端取結尾往前第一個唯一行,再各自加回它到 anchor 邊界的偏移。
 *
 * 不能只靠尾端字面比對(例如找第一個 `}`),否則原本跨越多個宣告的區段會被攔腰截斷。
 */
function relocate(target) {
  if (!existsSync(join(REPO_ROOT, target.file))) return { failed: '檔案不存在' };
  const lines = readLines(target.file);
  const anchorLines = normalize(target.anchor).split('\n');

  let headIdx = -1;
  let headOffset = 0;
  for (let i = 0; i < anchorLines.length; i++) {
    if (isCommentOrBlank(anchorLines[i])) continue;
    const found = uniqueLineIndex(lines, anchorLines[i]);
    if (found >= 0) {
      headIdx = found;
      headOffset = i;
      break;
    }
  }
  let tailIdx = -1;
  let tailOffset = 0;
  for (let i = anchorLines.length - 1; i >= 0; i--) {
    if (isCommentOrBlank(anchorLines[i])) continue;
    const found = uniqueLineIndex(lines, anchorLines[i]);
    if (found >= 0) {
      tailIdx = found;
      tailOffset = anchorLines.length - 1 - i;
      break;
    }
  }
  if (headIdx < 0 || tailIdx < 0) return { failed: '找不到可唯一定位的程式碼行' };

  let start = headIdx - headOffset;
  // anchor 原本就含前置註解時,改為納入現行的註解區塊(長度可能已不同),但不吃進開頭空行
  if (headOffset > 0) {
    let p = headIdx - 1;
    while (p >= 0 && isCommentOrBlank(lines[p])) p--;
    start = p + 1;
    while (start < headIdx && lines[start].trim() === '') start++;
  }
  const end = tailIdx + tailOffset;
  if (start > end || end >= lines.length) return { failed: '推算出的行段範圍不合理' };

  return {
    startLine: start + 1,
    endLine: end + 1,
    content: lines.slice(start, end + 1).join('\n'),
  };
}

function resolveRef(value) {
  if (!value) return null;
  if (value.toUpperCase() !== 'HEAD') return value;
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

const walkFiles = existsSync(WALK_DIR)
  ? readdirSync(WALK_DIR)
      .filter((name) => name.endsWith('.codewalk.json'))
      .sort()
  : [];

if (walkFiles.length === 0) {
  console.log('.codewalk/ 內沒有導讀檔,無事可做。');
  process.exit(0);
}

const nextRef = resolveRef(REF_ARG);
let pending = 0;
let failures = 0;

for (const name of walkFiles) {
  const path = join(WALK_DIR, name);
  const walk = JSON.parse(readFileSync(path, 'utf8'));
  const stats = { matched: 0, shifted: 0, relocated: 0 };
  const notes = [];

  const handle = (label, target) => {
    if (!target.anchor) return;
    const status = checkStatus(target);
    if (status.kind === 'matched') {
      stats.matched++;
      return;
    }
    if (status.kind === 'shifted') {
      stats.shifted++;
      notes.push(
        `  位移 ${label} ${target.file}: ${target.startLine}-${target.endLine} → ${status.startLine}-${status.endLine}`,
      );
      if (WRITE) {
        target.startLine = status.startLine;
        target.endLine = status.endLine;
      }
      return;
    }
    const moved = relocate(target);
    if (moved.failed) {
      failures++;
      notes.push(`  ✗ 無法定位 ${label} ${target.file}:${target.startLine}-${target.endLine} — ${moved.failed}`);
      return;
    }
    stats.relocated++;
    notes.push(
      `  重錨 ${label} ${target.file}: ${target.startLine}-${target.endLine} → ${moved.startLine}-${moved.endLine}` +
        ` (${normalize(target.anchor).split('\n').length} → ${moved.content.split('\n').length} 行)`,
    );
    if (WRITE) {
      target.startLine = moved.startLine;
      target.endLine = moved.endLine;
      target.anchor = moved.content;
    }
  };

  walk.steps.forEach((step, si) => {
    handle(`第 ${si + 1} 步`, step);
    (step.items ?? []).forEach((item, ii) => {
      if (item.kind === 'snippet') handle(`第 ${si + 1} 步 items[${ii}]`, item);
    });
  });

  const changed = stats.shifted + stats.relocated;
  pending += changed;

  console.log(`\n${name}`);
  console.log(`  相符 ${stats.matched} / 位移 ${stats.shifted} / 重錨 ${stats.relocated}`);
  if (notes.length > 0) console.log(notes.join('\n'));

  if (WRITE) {
    if (nextRef && walk.ref !== nextRef) {
      console.log(`  ref: ${walk.ref.slice(0, 7)} → ${nextRef.slice(0, 7)}`);
      walk.ref = nextRef;
    }
    writeFileSync(path, `${JSON.stringify(walk, null, 2)}\n`);
  } else if (nextRef && walk.ref !== nextRef) {
    console.log(`  ref 將更新: ${walk.ref.slice(0, 7)} → ${nextRef.slice(0, 7)}`);
  }
}

if (failures > 0) {
  console.error(`\n有 ${failures} 處無法自動定位,需要人工處理(或依 regenerateHint 重新產生導讀)。`);
  process.exit(1);
}
if (!WRITE && pending > 0) {
  console.log(`\n共 ${pending} 處待更新。加上 --write 實際寫入,之後請 git diff 檢查改動範圍。`);
  process.exit(1);
}
if (WRITE) {
  console.log(`\n完成,已更新 ${pending} 處。請 git diff 檢查改動範圍後再 commit。`);
} else {
  console.log('\n全部 anchor 都與現行程式碼相符。');
}
