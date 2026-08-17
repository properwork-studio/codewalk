import { describe, expect, it } from 'vitest';
import type { CodewalkFile, CodewalkStep } from '../shared/schema';
import { buildCurrentStepSnapshot } from './currentStepSnapshot';

function stepWith(overrides: Partial<CodewalkStep>): CodewalkStep {
  return {
    title: '為什麼驗證放在這裡',
    file: 'src/viewProvider.ts',
    startLine: 45,
    endLine: 52,
    narration: '驗證放在這裡而不是 middleware。',
    ...overrides,
  };
}

function walkWith(steps: CodewalkStep[]): CodewalkFile {
  return {
    title: '範例導讀',
    ref: 'a1b2c3d4',
    steps,
    quiz: [{ question: 'q', options: ['a', 'b'], correctIndex: 0 }],
  };
}

describe('buildCurrentStepSnapshot', () => {
  it('沒有作用中導讀時回傳 active: false', () => {
    expect(
      buildCurrentStepSnapshot({
        walk: undefined,
        walkPath: undefined,
        workspaceRoot: '/repo',
        stepIndex: 0,
        stepStatus: { kind: 'unanchored' },
      }),
    ).toEqual({ active: false });
  });

  it('有作用中導讀時回傳完整欄位', () => {
    const walk = walkWith([stepWith({})]);
    const snapshot = buildCurrentStepSnapshot({
      walk,
      walkPath: '/repo/.codewalk/tour.codewalk.json',
      workspaceRoot: '/repo',
      stepIndex: 0,
      stepStatus: { kind: 'matched' },
    });

    expect(snapshot).toEqual({
      active: true,
      walkPath: '.codewalk/tour.codewalk.json',
      walkTitle: '範例導讀',
      stepIndex: 0,
      stepTitle: '為什麼驗證放在這裡',
      file: 'src/viewProvider.ts',
      startLine: 45,
      endLine: 52,
      anchorStatus: 'matched',
    });
  });

  it('位移的步驟採用驗證後的新行號', () => {
    const walk = walkWith([stepWith({ startLine: 45, endLine: 52 })]);
    const snapshot = buildCurrentStepSnapshot({
      walk,
      walkPath: '/repo/.codewalk/tour.codewalk.json',
      workspaceRoot: '/repo',
      stepIndex: 0,
      stepStatus: { kind: 'shifted', startLine: 60, endLine: 67 },
    });

    expect(snapshot).toMatchObject({ startLine: 60, endLine: 67, anchorStatus: 'shifted' });
  });

  it('失準的步驟如實回報 anchorStatus,不隱藏', () => {
    const walk = walkWith([stepWith({})]);
    const snapshot = buildCurrentStepSnapshot({
      walk,
      walkPath: '/repo/.codewalk/tour.codewalk.json',
      workspaceRoot: '/repo',
      stepIndex: 0,
      stepStatus: { kind: 'stale', reason: 'notFound' },
    });

    expect(snapshot).toMatchObject({ anchorStatus: 'stale' });
  });

  it('沒有 workspaceRoot 時 walkPath 退回絕對路徑', () => {
    const walk = walkWith([stepWith({})]);
    const snapshot = buildCurrentStepSnapshot({
      walk,
      walkPath: '/repo/.codewalk/tour.codewalk.json',
      workspaceRoot: undefined,
      stepIndex: 0,
      stepStatus: { kind: 'matched' },
    });

    expect(snapshot).toMatchObject({ walkPath: '/repo/.codewalk/tour.codewalk.json' });
  });
});
