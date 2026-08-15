import { sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { setLocale } from '../shared/i18n';
import type { CodewalkFile, CodewalkStep } from '../shared/schema';
import { buildAskAgentPrompt } from './askAgentPrompt';

setLocale('zh-tw');

function stepWith(overrides: Partial<CodewalkStep>): CodewalkStep {
  return {
    title: '為什麼驗證放在這裡',
    file: 'src/viewProvider.ts',
    startLine: 45,
    endLine: 52,
    narration: '驗證放在這裡而不是 middleware,因為 middleware 跑在 tenant 解析之前。'.repeat(10),
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

describe('buildAskAgentPrompt', () => {
  it('包含專案相對路徑、步驟索引、步驟標題、檔案與行號', () => {
    const walk = walkWith([stepWith({})]);
    const prompt = buildAskAgentPrompt({
      walk,
      walkPath: '/repo/.codewalk/2026-08-07-tour.codewalk.json',
      workspaceRoot: '/repo',
      stepIndex: 0,
      stepStatus: { kind: 'matched' },
    });

    expect(prompt).toContain('.codewalk/2026-08-07-tour.codewalk.json');
    expect(prompt).toContain('steps[0]');
    expect(prompt).toContain('為什麼驗證放在這裡');
    expect(prompt).toContain('src/viewProvider.ts:45-52');
  });

  it('不含 narration 全文', () => {
    const longNarration = '驗證放在這裡的理由很長。'.repeat(50);
    const walk = walkWith([stepWith({ narration: longNarration })]);
    const prompt = buildAskAgentPrompt({
      walk,
      walkPath: '/repo/.codewalk/tour.codewalk.json',
      workspaceRoot: '/repo',
      stepIndex: 0,
      stepStatus: { kind: 'matched' },
    });

    expect(prompt).not.toContain(longNarration);
  });

  it('導讀檔不在 workspace 內時退回絕對路徑', () => {
    const walk = walkWith([stepWith({})]);
    const prompt = buildAskAgentPrompt({
      walk,
      walkPath: '/elsewhere/tour.codewalk.json',
      workspaceRoot: '/repo',
      stepIndex: 0,
      stepStatus: { kind: 'matched' },
    });

    expect(prompt).toContain('/elsewhere/tour.codewalk.json');
  });

  it('沒有 workspaceRoot 時退回絕對路徑', () => {
    const walk = walkWith([stepWith({})]);
    const prompt = buildAskAgentPrompt({
      walk,
      walkPath: '/repo/.codewalk/tour.codewalk.json',
      workspaceRoot: undefined,
      stepIndex: 0,
      stepStatus: { kind: 'matched' },
    });

    expect(prompt).toContain('/repo/.codewalk/tour.codewalk.json');
  });

  it('位移的步驟交出新行號', () => {
    const walk = walkWith([stepWith({ startLine: 45, endLine: 52 })]);
    const prompt = buildAskAgentPrompt({
      walk,
      walkPath: '/repo/.codewalk/tour.codewalk.json',
      workspaceRoot: '/repo',
      stepIndex: 0,
      stepStatus: { kind: 'shifted', startLine: 60, endLine: 67 },
    });

    expect(prompt).toContain('src/viewProvider.ts:60-67');
    expect(prompt).not.toContain('45-52');
  });

  it('未位移的步驟沿用原行號', () => {
    const walk = walkWith([stepWith({ startLine: 45, endLine: 52 })]);
    const prompt = buildAskAgentPrompt({
      walk,
      walkPath: '/repo/.codewalk/tour.codewalk.json',
      workspaceRoot: '/repo',
      stepIndex: 0,
      stepStatus: { kind: 'matched' },
    });

    expect(prompt).toContain('src/viewProvider.ts:45-52');
  });

  it('失準步驟附上警示', () => {
    const walk = walkWith([stepWith({})]);
    const prompt = buildAskAgentPrompt({
      walk,
      walkPath: '/repo/.codewalk/tour.codewalk.json',
      workspaceRoot: '/repo',
      stepIndex: 0,
      stepStatus: { kind: 'stale', reason: 'notFound' },
    });

    expect(prompt).toContain('已被改動');
  });

  it('正常步驟不附加警示', () => {
    const walk = walkWith([stepWith({})]);
    const prompt = buildAskAgentPrompt({
      walk,
      walkPath: '/repo/.codewalk/tour.codewalk.json',
      workspaceRoot: '/repo',
      stepIndex: 0,
      stepStatus: { kind: 'matched' },
    });

    expect(prompt).not.toContain('已被改動');
  });

  it('框選文字併入提問並標示為不理解的部分', () => {
    const walk = walkWith([stepWith({})]);
    const prompt = buildAskAgentPrompt({
      walk,
      walkPath: '/repo/.codewalk/tour.codewalk.json',
      workspaceRoot: '/repo',
      stepIndex: 0,
      stepStatus: { kind: 'matched' },
      selection: 'tenant 解析',
    });

    expect(prompt).toContain('我不懂的是');
    expect(prompt).toContain('tenant 解析');
  });

  it('未框選時不含「我不懂的是」段落', () => {
    const walk = walkWith([stepWith({})]);
    const prompt = buildAskAgentPrompt({
      walk,
      walkPath: '/repo/.codewalk/tour.codewalk.json',
      workspaceRoot: '/repo',
      stepIndex: 0,
      stepStatus: { kind: 'matched' },
    });

    expect(prompt).not.toContain('我不懂的是');
  });

  it('英文介面下輸出英文骨架、保持步驟標題原文', () => {
    setLocale('en');
    try {
      const walk = walkWith([stepWith({ title: '中文標題' })]);
      const prompt = buildAskAgentPrompt({
        walk,
        walkPath: '/repo/.codewalk/tour.codewalk.json',
        workspaceRoot: '/repo',
        stepIndex: 0,
        stepStatus: { kind: 'matched' },
      });

      expect(prompt).toContain('reading step');
      expect(prompt).toContain('中文標題');
    } finally {
      setLocale('zh-tw');
    }
  });

  it('繁體中文介面下輸出繁中骨架、保持英文步驟標題原文', () => {
    setLocale('zh-tw');
    const walk = walkWith([stepWith({ title: 'Why validation lives here' })]);
    const prompt = buildAskAgentPrompt({
      walk,
      walkPath: '/repo/.codewalk/tour.codewalk.json',
      workspaceRoot: '/repo',
      stepIndex: 0,
      stepStatus: { kind: 'matched' },
    });

    expect(prompt).toContain('我正在讀這份');
    expect(prompt).toContain('Why validation lives here');
  });

  it('相對路徑不含反斜線(即使平台的 path.sep 是反斜線)', () => {
    const walk = walkWith([stepWith({})]);
    const prompt = buildAskAgentPrompt({
      walk,
      walkPath: `${sep}repo${sep}.codewalk${sep}tour.codewalk.json`,
      workspaceRoot: `${sep}repo`,
      stepIndex: 0,
      stepStatus: { kind: 'matched' },
    });

    expect(prompt).not.toContain('\\');
  });
});
