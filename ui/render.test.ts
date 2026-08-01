import { describe, expect, it } from 'vitest';
import { classifyDiffLines } from './render';

describe('classifyDiffLines', () => {
  it('classifies +/- prefixed lines as added/removed and strips the marker', () => {
    const result = classifyDiffLines('+const a = 1;\n-const a = 2;', 10, 20);
    expect(result).toEqual([
      { type: 'added', content: 'const a = 1;', oldLineNumber: null, newLineNumber: 20 },
      { type: 'removed', content: 'const a = 2;', oldLineNumber: 10, newLineNumber: null },
    ]);
  });

  it('treats lines without a +/- prefix as context, keeping content unchanged', () => {
    const result = classifyDiffLines(' const b = 1;\nconst c = 2;', 10, 20);
    expect(result).toEqual([
      { type: 'context', content: ' const b = 1;', oldLineNumber: 10, newLineNumber: 20 },
      { type: 'context', content: 'const c = 2;', oldLineNumber: 11, newLineNumber: 21 },
    ]);
  });

  it('drops the trailing empty line produced by a trailing newline', () => {
    const result = classifyDiffLines(' context line\n+added line\n', 10, 20);
    expect(result).toHaveLength(2);
  });

  it('handles a diffText with only removed lines (pure-deletion hunk)', () => {
    const result = classifyDiffLines('-const a = 1;\n-const b = 2;', 8, 8);
    expect(result.every((line) => line.type === 'removed')).toBe(true);
    expect(result.every((line) => line.newLineNumber === null)).toBe(true);
    expect(result.map((line) => line.oldLineNumber)).toEqual([8, 9]);
  });

  it('handles an empty context line without throwing', () => {
    const result = classifyDiffLines(' const a = 1;\n\n+const b = 2;', 10, 20);
    expect(result).toEqual([
      { type: 'context', content: ' const a = 1;', oldLineNumber: 10, newLineNumber: 20 },
      { type: 'context', content: '', oldLineNumber: 11, newLineNumber: 21 },
      { type: 'added', content: 'const b = 2;', oldLineNumber: null, newLineNumber: 22 },
    ]);
  });

  it('advances the old and new counters independently across mixed lines', () => {
    // context(old=1,new=1) → removed(old=2) → removed(old=3) → added(new=2) → context(old=4,new=3)
    const result = classifyDiffLines(
      ' unchanged\n-removed one\n-removed two\n+added one\n unchanged again',
      1,
      1,
    );
    expect(result.map((line) => [line.oldLineNumber, line.newLineNumber])).toEqual([
      [1, 1],
      [2, null],
      [3, null],
      [null, 2],
      [4, 3],
    ]);
  });
});
