import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { CodewalkFile } from '../shared/schema';
import {
  buildAnchorReport,
  checkAnchorAgainstLines,
  effectiveLineRange,
  emptyAnchorReport,
  jumpModeFor,
} from './anchorCheck';

const dirsToClean: string[] = [];

afterEach(async () => {
  await Promise.all(dirsToClean.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

async function makeWorkspace(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'codewalk-anchor-'));
  dirsToClean.push(dir);
  await Promise.all(
    Object.entries(files).map(([name, content]) => writeFile(join(dir, name), content, 'utf8')),
  );
  return dir;
}

function walkWith(overrides: Partial<CodewalkFile>): CodewalkFile {
  return {
    title: '範例導讀',
    ref: 'a1b2c3d4',
    steps: [],
    quiz: [{ question: 'q', options: ['a', 'b'], correctIndex: 0 }],
    ...overrides,
  };
}

describe('checkAnchorAgainstLines', () => {
  it('returns unanchored when anchor is undefined', () => {
    const result = checkAnchorAgainstLines(['a', 'b', 'c'], 1, 2, undefined);
    expect(result).toEqual({ kind: 'unanchored' });
  });

  it('returns unanchored when anchor is whitespace-only', () => {
    const result = checkAnchorAgainstLines(['a', 'b', 'c'], 1, 2, '   \n  ');
    expect(result).toEqual({ kind: 'unanchored' });
  });

  it('returns stale/fileMissing when the file lines are null', () => {
    const result = checkAnchorAgainstLines(null, 1, 2, 'a\nb');
    expect(result).toEqual({ kind: 'stale', reason: 'fileMissing' });
  });

  it('returns matched when the current range equals the anchor exactly', () => {
    const lines = ['const x = 1;', 'const y = 2;', 'const z = 3;'];
    const result = checkAnchorAgainstLines(lines, 1, 2, 'const x = 1;\nconst y = 2;');
    expect(result).toEqual({ kind: 'matched' });
  });

  it('normalizes CRLF before comparing', () => {
    const lines = ['const x = 1;', 'const y = 2;'];
    const result = checkAnchorAgainstLines(lines, 1, 2, 'const x = 1;\r\nconst y = 2;');
    expect(result).toEqual({ kind: 'matched' });
  });

  it('does not trim indentation differences', () => {
    const lines = ['  const x = 1;'];
    const result = checkAnchorAgainstLines(lines, 1, 1, 'const x = 1;');
    expect(result).toEqual({ kind: 'stale', reason: 'notFound' });
  });

  it('returns shifted with the new line range when the anchor moved down', () => {
    const lines = ['// inserted line', 'const x = 1;', 'const y = 2;'];
    const result = checkAnchorAgainstLines(lines, 1, 2, 'const x = 1;\nconst y = 2;');
    expect(result).toEqual({ kind: 'shifted', startLine: 2, endLine: 3 });
  });

  it('returns shifted for a single-line anchor found elsewhere', () => {
    const lines = ['a', 'b', 'const x = 1;', 'd'];
    const result = checkAnchorAgainstLines(lines, 1, 1, 'const x = 1;');
    expect(result).toEqual({ kind: 'shifted', startLine: 3, endLine: 3 });
  });

  it('returns stale/notFound when the anchor cannot be found anywhere', () => {
    const lines = ['const x = 1;'];
    const result = checkAnchorAgainstLines(lines, 1, 1, 'const x = 999;');
    expect(result).toEqual({ kind: 'stale', reason: 'notFound' });
  });

  it('returns stale/ambiguous when the anchor appears more than once and the original position no longer matches', () => {
    const lines = ['const x = 1;', 'changed', 'const x = 1;'];
    const result = checkAnchorAgainstLines(lines, 2, 2, 'const x = 1;');
    expect(result).toEqual({ kind: 'stale', reason: 'ambiguous' });
  });

  it('does not treat a mid-line substring match as a hit (line-aligned matching only)', () => {
    // "b\nc" 是 "ab\ncd" 的子字串,但起訖都沒有落在行邊界上——不該被視為匹配
    const lines = ['ab', 'cd'];
    const result = checkAnchorAgainstLines(lines, 1, 1, 'b\nc');
    expect(result).toEqual({ kind: 'stale', reason: 'notFound' });
  });

  it('matches when the anchor is the entire last line with no trailing newline', () => {
    const lines = ['first', 'const x = 1;'];
    const result = checkAnchorAgainstLines(lines, 1, 1, 'const x = 1;');
    expect(result).toEqual({ kind: 'shifted', startLine: 2, endLine: 2 });
  });
});

describe('buildAnchorReport', () => {
  it('marks anyAnchored false and every target unanchored when no anchors are provided', async () => {
    const dir = await makeWorkspace({ 'a.ts': 'const a = 1;\n' });
    const walk = walkWith({
      steps: [{ title: 's1', file: 'a.ts', startLine: 1, endLine: 1, narration: '...' }],
    });
    const report = buildAnchorReport(dir, walk);
    expect(report).toEqual({
      anyAnchored: false,
      anyStale: false,
      staleCount: 0,
      steps: [{ step: { kind: 'unanchored' }, items: [] }],
    });
  });

  it('reads each referenced file only once across steps and items', async () => {
    const dir = await makeWorkspace({ 'a.ts': 'const a = 1;\nconst b = 2;\n' });
    const walk = walkWith({
      steps: [
        {
          title: 's1',
          file: 'a.ts',
          startLine: 1,
          endLine: 1,
          narration: '...',
          anchor: 'const a = 1;',
          items: [
            { kind: 'snippet', label: 'x', file: 'a.ts', startLine: 2, endLine: 2, anchor: 'const b = 2;' },
          ],
        },
      ],
    });
    const report = buildAnchorReport(dir, walk);
    expect(report.anyAnchored).toBe(true);
    expect(report.anyStale).toBe(false);
    expect(report.steps[0].step).toEqual({ kind: 'matched' });
    expect(report.steps[0].items).toEqual([{ itemIndex: 0, status: { kind: 'matched' } }]);
  });

  it('counts stale targets across steps and items in staleCount', async () => {
    const dir = await makeWorkspace({ 'a.ts': 'const a = 1;\n' });
    const walk = walkWith({
      steps: [
        {
          title: 's1',
          file: 'a.ts',
          startLine: 1,
          endLine: 1,
          narration: '...',
          anchor: 'this code is gone',
          items: [
            { kind: 'snippet', label: 'x', file: 'missing.ts', startLine: 1, endLine: 1, anchor: 'anything' },
          ],
        },
      ],
    });
    const report = buildAnchorReport(dir, walk);
    expect(report.anyStale).toBe(true);
    expect(report.staleCount).toBe(2);
    expect(report.steps[0].step).toEqual({ kind: 'stale', reason: 'notFound' });
    expect(report.steps[0].items).toEqual([
      { itemIndex: 0, status: { kind: 'stale', reason: 'fileMissing' } },
    ]);
  });

  it('ignores non-snippet items entirely', async () => {
    const dir = await makeWorkspace({ 'a.ts': 'const a = 1;\n' });
    const walk = walkWith({
      steps: [
        {
          title: 's1',
          file: 'a.ts',
          startLine: 1,
          endLine: 1,
          narration: '...',
          items: [{ kind: 'tip', text: '提示' }],
        },
      ],
    });
    const report = buildAnchorReport(dir, walk);
    expect(report.steps[0].items).toEqual([]);
  });
});

describe('effectiveLineRange', () => {
  it('returns the shifted range when status is shifted', () => {
    const result = effectiveLineRange(
      { startLine: 1, endLine: 2 },
      { kind: 'shifted', startLine: 10, endLine: 11 },
    );
    expect(result).toEqual({ startLine: 10, endLine: 11 });
  });

  it('returns the original range for matched', () => {
    const result = effectiveLineRange({ startLine: 1, endLine: 2 }, { kind: 'matched' });
    expect(result).toEqual({ startLine: 1, endLine: 2 });
  });

  it('returns the original range for unanchored', () => {
    const result = effectiveLineRange({ startLine: 1, endLine: 2 }, { kind: 'unanchored' });
    expect(result).toEqual({ startLine: 1, endLine: 2 });
  });

  it('returns the original range for stale (caller decides how to render staleness)', () => {
    const result = effectiveLineRange({ startLine: 1, endLine: 2 }, { kind: 'stale', reason: 'notFound' });
    expect(result).toEqual({ startLine: 1, endLine: 2 });
  });
});

describe('jumpModeFor', () => {
  it('returns openOnly for stale', () => {
    expect(jumpModeFor({ kind: 'stale', reason: 'notFound' })).toBe('openOnly');
  });

  it('returns select for matched, shifted, and unanchored', () => {
    expect(jumpModeFor({ kind: 'matched' })).toBe('select');
    expect(jumpModeFor({ kind: 'shifted', startLine: 1, endLine: 2 })).toBe('select');
    expect(jumpModeFor({ kind: 'unanchored' })).toBe('select');
  });
});

describe('emptyAnchorReport', () => {
  it('marks every step as unanchored without touching the filesystem', () => {
    const walk = walkWith({
      steps: [
        { title: 's1', file: 'a.ts', startLine: 1, endLine: 1, narration: '...' },
        { title: 's2', file: 'b.ts', startLine: 1, endLine: 1, narration: '...' },
      ],
    });
    const report = emptyAnchorReport(walk);
    expect(report).toEqual({
      anyAnchored: false,
      anyStale: false,
      staleCount: 0,
      steps: [
        { step: { kind: 'unanchored' }, items: [] },
        { step: { kind: 'unanchored' }, items: [] },
      ],
    });
  });
});
