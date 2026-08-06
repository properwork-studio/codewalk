import { describe, expect, it } from 'vitest';
import type { AnchorReport } from '../shared/protocol';
import type { CodewalkFile } from '../shared/schema';
import { buildWalkRestoredMessage } from './webviewReadyPlan';

function sampleWalk(): CodewalkFile {
  return {
    title: '範例導讀',
    ref: 'a1b2c3d4',
    steps: [{ title: '步驟一', file: 'a.ts', startLine: 1, endLine: 1, narration: '...' }],
    quiz: [{ question: '題目', options: ['對', '錯'], correctIndex: 0 }],
  };
}

const NO_ANCHORS: AnchorReport = { anyAnchored: false, anyStale: false, staleCount: 0, steps: [] };

describe('buildWalkRestoredMessage', () => {
  it('returns null when the host has no active walk (尚未選擇導讀時不受影響)', () => {
    expect(buildWalkRestoredMessage(undefined, [])).toBeNull();
  });

  it('builds a walkRestored message from the active walk when the host still holds one', () => {
    const walk = sampleWalk();
    const message = buildWalkRestoredMessage(
      { walk, stepIndex: 2, refDrifted: true, anchorReport: NO_ANCHORS },
      [],
    );

    expect(message).toEqual({
      type: 'walkRestored',
      walk,
      stepIndex: 2,
      refDrifted: true,
      anchorReport: NO_ANCHORS,
      snippetPreviews: [],
    });
  });
});
