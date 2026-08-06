import { describe, expect, it } from 'vitest';
import type { AnchorReport } from '../shared/protocol';
import type { CodewalkFile } from '../shared/schema';
import {
  applyPersistedUiState,
  cancelQuiz,
  closeAttemptMenu,
  createFileListState,
  createWalkingState,
  enterQuiz,
  isAtLastStep,
  nextStep,
  prevStep,
  restartWalk,
  retryQuiz,
  selectQuizAnswer,
  setPendingClear,
  submitQuiz,
  toggleAttemptMenu,
  toggleTerm,
  type PersistedUiState,
} from './state';

function sampleWalk(): CodewalkFile {
  return {
    title: '範例導讀',
    ref: 'a1b2c3d4',
    steps: [
      {
        title: '步驟一',
        file: 'a.ts',
        startLine: 1,
        endLine: 1,
        narration: '...',
        terms: [{ term: 'foo', explanation: 'bar' }],
      },
      { title: '步驟二', file: 'b.ts', startLine: 2, endLine: 2, narration: '...' },
      { title: '步驟三', file: 'c.ts', startLine: 3, endLine: 3, narration: '...' },
    ],
    quiz: Array.from({ length: 5 }, (_, i) => ({
      question: `題目 ${i + 1}`,
      options: ['對', '錯'],
      correctIndex: 0,
    })),
  };
}

const NO_ANCHORS: AnchorReport = {
  anyAnchored: false,
  anyStale: false,
  staleCount: 0,
  steps: [
    { step: { kind: 'unanchored' }, items: [] },
    { step: { kind: 'unanchored' }, items: [] },
    { step: { kind: 'unanchored' }, items: [] },
  ],
};

describe('step navigation', () => {
  it('advances to the next step', () => {
    const state = createWalkingState(sampleWalk(), false, NO_ANCHORS);
    const next = nextStep(state);
    expect(next.stepIndex).toBe(1);
  });

  it('goes back to the previous step', () => {
    const state = { ...createWalkingState(sampleWalk(), false, NO_ANCHORS), stepIndex: 1 };
    const prev = prevStep(state);
    expect(prev.stepIndex).toBe(0);
  });

  it('stays on the last step when advancing past the end', () => {
    const walk = sampleWalk();
    const state = { ...createWalkingState(walk, false, NO_ANCHORS), stepIndex: walk.steps.length - 1 };
    const next = nextStep(state);
    expect(next.stepIndex).toBe(walk.steps.length - 1);
    expect(isAtLastStep(next)).toBe(true);
  });

  it('stays on the first step when going back past the start', () => {
    const state = createWalkingState(sampleWalk(), false, NO_ANCHORS);
    const prev = prevStep(state);
    expect(prev.stepIndex).toBe(0);
  });
});

describe('toggleTerm', () => {
  it('expands a collapsed term', () => {
    const state = createWalkingState(sampleWalk(), false, NO_ANCHORS);
    const expanded = toggleTerm(state, 'foo');
    expect(expanded.expandedTerms.has('foo')).toBe(true);
  });

  it('collapses an expanded term', () => {
    const state = toggleTerm(createWalkingState(sampleWalk(), false, NO_ANCHORS), 'foo');
    const collapsed = toggleTerm(state, 'foo');
    expect(collapsed.expandedTerms.has('foo')).toBe(false);
  });
});

describe('quiz flow', () => {
  it('starts with no answers selected', () => {
    const quizState = enterQuiz(createWalkingState(sampleWalk(), false, NO_ANCHORS));
    expect(quizState.answers).toEqual([null, null, null, null, null]);
  });

  it('records a selected answer for a question', () => {
    const quizState = selectQuizAnswer(enterQuiz(createWalkingState(sampleWalk(), false, NO_ANCHORS)), 0, 1);
    expect(quizState.answers[0]).toBe(1);
  });

  it('passes when at least 3 of 5 answers are correct', () => {
    const quizState = enterQuiz(createWalkingState(sampleWalk(), false, NO_ANCHORS));
    quizState.answers = [0, 0, 0, 1, 1];
    const result = submitQuiz(quizState);
    expect(result.score).toBe(3);
    expect(result.passed).toBe(true);
  });

  it('fails when fewer than 3 of 5 answers are correct', () => {
    const quizState = enterQuiz(createWalkingState(sampleWalk(), false, NO_ANCHORS));
    quizState.answers = [0, 0, 1, 1, 1];
    const result = submitQuiz(quizState);
    expect(result.score).toBe(2);
    expect(result.passed).toBe(false);
  });

  it('treats an unanswered question as incorrect', () => {
    const quizState = enterQuiz(createWalkingState(sampleWalk(), false, NO_ANCHORS));
    quizState.answers = [0, 0, 0, null, null];
    const result = submitQuiz(quizState);
    expect(result.score).toBe(3);
    expect(result.passed).toBe(true);
  });
});

describe('cancelQuiz', () => {
  it('goes back to the walking screen at the last step, without submitting', () => {
    const walk = sampleWalk();
    const walking = { ...createWalkingState(walk, false, NO_ANCHORS), stepIndex: walk.steps.length - 1 };
    const quizState = selectQuizAnswer(enterQuiz(walking), 0, 1);

    const cancelled = cancelQuiz(quizState);
    expect(cancelled.screen).toBe('walking');
    expect(cancelled.stepIndex).toBe(walk.steps.length - 1);
  });
});

describe('leaving the quiz result screen', () => {
  it('restartWalk goes back to step 1 of the same walk', () => {
    const quizState = enterQuiz(createWalkingState(sampleWalk(), false, NO_ANCHORS));
    quizState.answers = [0, 0, 0, 1, 1];
    const result = submitQuiz(quizState);

    const restarted = restartWalk(result);
    expect(restarted.screen).toBe('walking');
    expect(restarted.stepIndex).toBe(0);
    expect(restarted.walk).toBe(result.walk);
  });

  it('retryQuiz starts a fresh quiz with no answers selected', () => {
    const quizState = enterQuiz(createWalkingState(sampleWalk(), false, NO_ANCHORS));
    quizState.answers = [0, 0, 0, 1, 1];
    const result = submitQuiz(quizState);

    const retried = retryQuiz(result);
    expect(retried.screen).toBe('quiz');
    expect(retried.answers).toEqual([null, null, null, null, null]);
  });
});

describe('applyPersistedUiState', () => {
  function persisted(overrides: Partial<PersistedUiState> = {}): PersistedUiState {
    return {
      ref: 'a1b2c3d4',
      screen: 'walking',
      stepIndex: 0,
      expandedTerms: [],
      answers: [],
      scrollTop: 0,
      ...overrides,
    };
  }

  it('falls back to the host step index when nothing is persisted', () => {
    const result = applyPersistedUiState(sampleWalk(), 2, false, NO_ANCHORS, null);
    if (result.screen !== 'walking') throw new Error('expected walking');
    expect(result.stepIndex).toBe(2);
  });

  it('discards persisted state for a different walk (ref mismatch)', () => {
    const result = applyPersistedUiState(
      sampleWalk(),
      2,
      false,
      NO_ANCHORS,
      persisted({ ref: 'different-ref', stepIndex: 1, screen: 'quiz' }),
    );
    if (result.screen !== 'walking') throw new Error('expected walking');
    expect(result.stepIndex).toBe(2);
  });

  it('restores the walking screen at the persisted step with expanded terms', () => {
    const result = applyPersistedUiState(
      sampleWalk(),
      0,
      false,
      NO_ANCHORS,
      persisted({ stepIndex: 1, expandedTerms: ['foo'] }),
    );
    if (result.screen !== 'walking') throw new Error('expected walking');
    expect(result.stepIndex).toBe(1);
    expect(result.expandedTerms.has('foo')).toBe(true);
  });

  it('clamps a persisted step index that is out of range', () => {
    const result = applyPersistedUiState(sampleWalk(), 0, false, NO_ANCHORS, persisted({ stepIndex: 99 }));
    if (result.screen !== 'walking') throw new Error('expected walking');
    expect(result.stepIndex).toBe(sampleWalk().steps.length - 1);
  });

  it('restores the quiz screen with previously selected answers', () => {
    const result = applyPersistedUiState(
      sampleWalk(),
      2,
      false,
      NO_ANCHORS,
      persisted({ screen: 'quiz', answers: [0, null, 1] }),
    );
    expect(result.screen).toBe('quiz');
    expect(result.screen === 'quiz' && result.answers).toEqual([0, null, 1, null, null]);
  });

  it('restores the quizResult screen, recomputing the score from persisted answers', () => {
    const result = applyPersistedUiState(
      sampleWalk(),
      2,
      false,
      NO_ANCHORS,
      persisted({ screen: 'quizResult', answers: [0, 0, 0, 1, 1] }),
    );
    expect(result.screen).toBe('quizResult');
    expect(result.screen === 'quizResult' && result.score).toBe(3);
    expect(result.screen === 'quizResult' && result.passed).toBe(true);
  });
});

describe('file list attempt menu state', () => {
  it('starts with no menu open and no pending clear', () => {
    const state = createFileListState([]);
    expect(state.openMenuPath).toBeNull();
    expect(state.pendingClearPath).toBeNull();
  });

  it('opens the menu for a row on first toggle', () => {
    const state = toggleAttemptMenu(createFileListState([]), 'a.codewalk.json');
    expect(state.openMenuPath).toBe('a.codewalk.json');
  });

  it('toggling the same row again closes the menu and drops any pending clear', () => {
    const opened = toggleAttemptMenu(createFileListState([]), 'a.codewalk.json');
    const withPending = setPendingClear(opened, 'a.codewalk.json');
    const closed = toggleAttemptMenu(withPending, 'a.codewalk.json');
    expect(closed.openMenuPath).toBeNull();
    expect(closed.pendingClearPath).toBeNull();
  });

  it('opening a different row automatically closes the previous one (only one at a time)', () => {
    const first = toggleAttemptMenu(createFileListState([]), 'a.codewalk.json');
    const firstPending = setPendingClear(first, 'a.codewalk.json');
    const second = toggleAttemptMenu(firstPending, 'b.codewalk.json');
    expect(second.openMenuPath).toBe('b.codewalk.json');
    expect(second.pendingClearPath).toBeNull();
  });

  it('setPendingClear marks the clear item as confirming', () => {
    const opened = toggleAttemptMenu(createFileListState([]), 'a.codewalk.json');
    const pending = setPendingClear(opened, 'a.codewalk.json');
    expect(pending.pendingClearPath).toBe('a.codewalk.json');
  });

  it('closeAttemptMenu resets both the open menu and pending clear', () => {
    const opened = toggleAttemptMenu(createFileListState([]), 'a.codewalk.json');
    const pending = setPendingClear(opened, 'a.codewalk.json');
    const closed = closeAttemptMenu(pending);
    expect(closed.openMenuPath).toBeNull();
    expect(closed.pendingClearPath).toBeNull();
  });
});
