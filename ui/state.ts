/*
 * webview 的畫面狀態與狀態轉移。全部是不可變的純函式:輸入舊狀態、回傳新狀態,
 * 不碰 DOM 也不送訊息——所以能完整跑單元測試,這是 webview 這層唯一容易測的部分。
 *
 * 四種畫面(fileList / walking / quiz / quizResult)對應 `ui/render/` 的四組
 * 渲染函式。實際的畫面切換與訊息收發在 `ui/main.ts`。
 */

import type { AnchorReport, WalkFileSummary } from '../shared/protocol';
import { scoreQuiz, type CodewalkFile } from '../shared/schema';

/** 導讀列表畫面:選擇要走哪一份導讀。 */
export interface FileListState {
  screen: 'fileList';
  files: WalkFileSummary[];
  /** 目前展開中的「更多動作」選單所屬導讀路徑;同一時間至多一份(design.md 決策 6)。 */
  openMenuPath: string | null;
  /** 選單內清除項目是否處於「確定清除?」二次確認態;只在對應選單展開時有意義。 */
  pendingClearPath: string | null;
}

/** 建立列表畫面,選單一律從收合狀態開始。 */
export function createFileListState(files: WalkFileSummary[]): FileListState {
  return { screen: 'fileList', files, openMenuPath: null, pendingClearPath: null };
}

/** 收合選單並一併取消未完成的二次確認——重開選單時不該還停在「確定清除?」。 */
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

/** 把清除動作切到「確定清除?」二次確認態。再點一次才真的清除。 */
export function setPendingClear(state: FileListState, path: string): FileListState {
  return { ...state, pendingClearPath: path };
}

/** 走讀畫面:逐步讀導讀內容。 */
export interface WalkingState {
  screen: 'walking';
  walk: CodewalkFile;
  stepIndex: number;
  refDrifted: boolean;
  anchorReport: AnchorReport;
  /**
   * 目前展開中的術語,以 `term.term` 的文字為鍵。用文字而非索引,讓展開狀態在
   * 切換步驟後仍能對應到同名術語。
   */
  expandedTerms: Set<string>;
}

/** Quiz 作答畫面。保留 `refDrifted`/`anchorReport` 是為了取消作答時能還原走讀畫面。 */
export interface QuizState {
  screen: 'quiz';
  walk: CodewalkFile;
  refDrifted: boolean;
  anchorReport: AnchorReport;
  /** 每題選中的選項索引;`null` 代表未作答。長度恆等於 `walk.quiz`。 */
  answers: (number | null)[];
}

/** Quiz 結果畫面:分數、逐題檢討,以及重試/重走/回列表的出口。 */
export interface QuizResult {
  screen: 'quizResult';
  walk: CodewalkFile;
  refDrifted: boolean;
  anchorReport: AnchorReport;
  answers: (number | null)[];
  score: number;
  passed: boolean;
}

/**
 * 建立走讀畫面,一律從第一步開始。
 *
 * @remarks
 * 「接續上次」的載入路徑會在拿到這個結果後覆寫 `stepIndex`——本函式刻意不接受
 * 起始步驟參數,讓「從頭開始」維持是預設行為。
 */
export function createWalkingState(
  walk: CodewalkFile,
  refDrifted: boolean,
  anchorReport: AnchorReport,
): WalkingState {
  return { screen: 'walking', walk, stepIndex: 0, refDrifted, anchorReport, expandedTerms: new Set() };
}

/** 是否已在最後一步。決定「下一步」按鈕是否停用,以及是否顯示進入 quiz 的入口。 */
export function isAtLastStep(state: WalkingState): boolean {
  return state.stepIndex === state.walk.steps.length - 1;
}

/** 前進一步。已在最後一步時維持不動,不繞回第一步。 */
export function nextStep(state: WalkingState): WalkingState {
  const maxIndex = state.walk.steps.length - 1;
  return { ...state, stepIndex: Math.min(state.stepIndex + 1, maxIndex) };
}

/** 後退一步。已在第一步時維持不動,不繞回最後一步。 */
export function prevStep(state: WalkingState): WalkingState {
  return { ...state, stepIndex: Math.max(state.stepIndex - 1, 0) };
}

/** 展開或收合某個術語卡。多個術語可同時展開,彼此不互斥。 */
export function toggleTerm(state: WalkingState, term: string): WalkingState {
  const expandedTerms = new Set(state.expandedTerms);
  if (expandedTerms.has(term)) {
    expandedTerms.delete(term);
  } else {
    expandedTerms.add(term);
  }
  return { ...state, expandedTerms };
}

/** 從走讀進入 quiz,所有題目重置為未作答。 */
export function enterQuiz(state: WalkingState): QuizState {
  return {
    screen: 'quiz',
    walk: state.walk,
    refDrifted: state.refDrifted,
    anchorReport: state.anchorReport,
    answers: state.walk.quiz.map(() => null),
  };
}

/**
 * 取消作答,回到走讀畫面的**最後一步**——讀者是從那裡進來的,回到第一步等於
 * 把人丟回導讀開頭。已填的答案一併捨棄。
 */
export function cancelQuiz(state: QuizState): WalkingState {
  const walking = createWalkingState(state.walk, state.refDrifted, state.anchorReport);
  return { ...walking, stepIndex: state.walk.steps.length - 1 };
}

/** 選定某題的答案。可重複改答,送出前都不算定案。 */
export function selectQuizAnswer(state: QuizState, questionIndex: number, optionIndex: number): QuizState {
  const answers = [...state.answers];
  answers[questionIndex] = optionIndex;
  return { ...state, answers };
}

/** 從結果畫面重走整份導讀,回到第一步。 */
export function restartWalk(state: QuizResult): WalkingState {
  return createWalkingState(state.walk, state.refDrifted, state.anchorReport);
}

/** 從結果畫面重新作答,答案全部清空。 */
export function retryQuiz(state: QuizResult): QuizState {
  return enterQuiz(createWalkingState(state.walk, state.refDrifted, state.anchorReport));
}

/**
 * 送出作答並計分,切到結果畫面。
 *
 * @remarks
 * 未作答的題目以 `-1` 傳給 `scoreQuiz`(見 shared/schema.ts),必定計為答錯。
 */
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
