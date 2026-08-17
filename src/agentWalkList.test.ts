import { describe, expect, it } from 'vitest';
import type { WalkFileSummary } from '../shared/protocol';
import { buildAgentWalkList } from './agentWalkList';

describe('buildAgentWalkList', () => {
  it('挑出 path 與 title,路徑換算成 workspace 相對路徑', () => {
    const files: WalkFileSummary[] = [
      { path: '/repo/.codewalk/a.codewalk.json', title: '導讀 A' },
      {
        path: '/repo/.codewalk/b.codewalk.json',
        title: '導讀 B',
        lastAttempt: { at: 1, score: 1, total: 1, passed: true },
        progress: { stepIndex: 2 },
      },
    ];

    expect(buildAgentWalkList(files, '/repo')).toEqual({
      walks: [
        { path: '.codewalk/a.codewalk.json', title: '導讀 A' },
        { path: '.codewalk/b.codewalk.json', title: '導讀 B' },
      ],
    });
  });

  it('沒有任何導讀時回傳空清單,不是報錯', () => {
    expect(buildAgentWalkList([], '/repo')).toEqual({ walks: [] });
  });
});
