import type { AnchorReport, WalkFileSummary } from '../shared/protocol';
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
  anchorReport: AnchorReport;
  expandedTerms: Set<string>;
}

export interface QuizState {
  screen: 'quiz';
  walk: CodewalkFile;
  refDrifted: boolean;
  anchorReport: AnchorReport;
  answers: (number | null)[];
}

export interface QuizResult {
  screen: 'quizResult';
  walk: CodewalkFile;
  refDrifted: boolean;
  anchorReport: AnchorReport;
  answers: (number | null)[];
  score: number;
  passed: boolean;
}

export function createWalkingState(
  walk: CodewalkFile,
  refDrifted: boolean,
  anchorReport: AnchorReport,
): WalkingState {
  return { screen: 'walking', walk, stepIndex: 0, refDrifted, anchorReport, expandedTerms: new Set() };
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
    anchorReport: state.anchorReport,
    answers: state.walk.quiz.map(() => null),
  };
}

export function cancelQuiz(state: QuizState): WalkingState {
  const walking = createWalkingState(state.walk, state.refDrifted, state.anchorReport);
  return { ...walking, stepIndex: state.walk.steps.length - 1 };
}

export function selectQuizAnswer(state: QuizState, questionIndex: number, optionIndex: number): QuizState {
  const answers = [...state.answers];
  answers[questionIndex] = optionIndex;
  return { ...state, answers };
}

export function restartWalk(state: QuizResult): WalkingState {
  return createWalkingState(state.walk, state.refDrifted, state.anchorReport);
}

export function retryQuiz(state: QuizResult): QuizState {
  return enterQuiz(createWalkingState(state.walk, state.refDrifted, state.anchorReport));
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
    anchorReport: state.anchorReport,
    answers: state.answers,
    score,
    passed,
  };
}

/**
 * webview 自行保留的細節狀態(捲動位置以外的畫面內容)——quiz 答案、展開中的
 * 術語、當時所在畫面。用 `ref` 而非導讀路徑判斷是否屬於同一份導讀,因為
 * `walkRestored` 訊息只帶 CodewalkFile 本身(design.md 決策 4)。
 */
export interface PersistedUiState {
  ref: string;
  screen: 'walking' | 'quiz' | 'quizResult';
  stepIndex: number;
  expandedTerms: string[];
  answers: (number | null)[];
  scrollTop: number;
}

/**
 * 面板重建回灌(`walkRestored`)時,把 webview 自行保留的細節狀態套用到
 * host 送來的內容上——只在同一份導讀(`ref` 相符)時採用,否則捨棄改用
 * 預設狀態(reading-progress capability「閱讀位置的細節狀態保留」)。
 */
export function applyPersistedUiState(
  walk: CodewalkFile,
  hostStepIndex: number,
  refDrifted: boolean,
  anchorReport: AnchorReport,
  persisted: PersistedUiState | null,
): WalkingState | QuizState | QuizResult {
  const base = createWalkingState(walk, refDrifted, anchorReport);
  if (!persisted || persisted.ref !== walk.ref) {
    return { ...base, stepIndex: hostStepIndex };
  }

  const maxIndex = walk.steps.length - 1;
  const walking: WalkingState = {
    ...base,
    stepIndex: Math.min(Math.max(persisted.stepIndex, 0), maxIndex),
    expandedTerms: new Set(persisted.expandedTerms),
  };
  if (persisted.screen === 'walking') {
    return walking;
  }

  const quiz = enterQuiz(walking);
  const restoredQuiz: QuizState = {
    ...quiz,
    answers: walk.quiz.map((_, i) => persisted.answers[i] ?? null),
  };
  return persisted.screen === 'quiz' ? restoredQuiz : submitQuiz(restoredQuiz);
}
