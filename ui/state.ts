import type { WalkFileSummary } from '../shared/protocol';
import { scoreQuiz, type CodewalkFile } from '../shared/schema';

export interface FileListState {
  screen: 'fileList';
  files: WalkFileSummary[];
  /** 目前展開中的「更多動作」選單所屬導讀路徑;同一時間至多一份(design.md 決策 6)。 */
  openMenuPath: string | null;
  /** 選單內清除項目是否處於「確定清除?」二次確認態;只在對應選單展開時有意義。 */
  pendingClearPath: string | null;
}

export function createFileListState(files: WalkFileSummary[]): FileListState {
  return { screen: 'fileList', files, openMenuPath: null, pendingClearPath: null };
}

export function closeAttemptMenu(state: FileListState): FileListState {
  return { ...state, openMenuPath: null, pendingClearPath: null };
}

/** 開啟另一份導讀的選單會自動收合前一個,天然滿足「同時最多一個」。 */
export function toggleAttemptMenu(state: FileListState, path: string): FileListState {
  if (state.openMenuPath === path) {
    return closeAttemptMenu(state);
  }
  return { ...state, openMenuPath: path, pendingClearPath: null };
}

export function setPendingClear(state: FileListState, path: string): FileListState {
  return { ...state, pendingClearPath: path };
}

export interface WalkingState {
  screen: 'walking';
  walk: CodewalkFile;
  stepIndex: number;
  refDrifted: boolean;
  expandedTerms: Set<string>;
}

export interface QuizState {
  screen: 'quiz';
  walk: CodewalkFile;
  refDrifted: boolean;
  answers: (number | null)[];
}

export interface QuizResult {
  screen: 'quizResult';
  walk: CodewalkFile;
  refDrifted: boolean;
  answers: (number | null)[];
  score: number;
  passed: boolean;
}

export function createWalkingState(walk: CodewalkFile, refDrifted: boolean): WalkingState {
  return { screen: 'walking', walk, stepIndex: 0, refDrifted, expandedTerms: new Set() };
}

export function isAtLastStep(state: WalkingState): boolean {
  return state.stepIndex === state.walk.steps.length - 1;
}

export function nextStep(state: WalkingState): WalkingState {
  const maxIndex = state.walk.steps.length - 1;
  return { ...state, stepIndex: Math.min(state.stepIndex + 1, maxIndex) };
}

export function prevStep(state: WalkingState): WalkingState {
  return { ...state, stepIndex: Math.max(state.stepIndex - 1, 0) };
}

export function toggleTerm(state: WalkingState, term: string): WalkingState {
  const expandedTerms = new Set(state.expandedTerms);
  if (expandedTerms.has(term)) {
    expandedTerms.delete(term);
  } else {
    expandedTerms.add(term);
  }
  return { ...state, expandedTerms };
}

export function enterQuiz(state: WalkingState): QuizState {
  return {
    screen: 'quiz',
    walk: state.walk,
    refDrifted: state.refDrifted,
    answers: state.walk.quiz.map(() => null),
  };
}

export function cancelQuiz(state: QuizState): WalkingState {
  const walking = createWalkingState(state.walk, state.refDrifted);
  return { ...walking, stepIndex: state.walk.steps.length - 1 };
}

export function selectQuizAnswer(state: QuizState, questionIndex: number, optionIndex: number): QuizState {
  const answers = [...state.answers];
  answers[questionIndex] = optionIndex;
  return { ...state, answers };
}

export function restartWalk(state: QuizResult): WalkingState {
  return createWalkingState(state.walk, state.refDrifted);
}

export function retryQuiz(state: QuizResult): QuizState {
  return enterQuiz(createWalkingState(state.walk, state.refDrifted));
}

export function submitQuiz(state: QuizState): QuizResult {
  const { score, passed } = scoreQuiz(
    state.walk,
    state.answers.map((a) => a ?? -1),
  );
  return {
    screen: 'quizResult',
    walk: state.walk,
    refDrifted: state.refDrifted,
    answers: state.answers,
    score,
    passed,
  };
}
