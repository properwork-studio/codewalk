import { resolvePassThreshold, type CodewalkFile } from '../shared/schema';

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
  const score = state.walk.quiz.reduce((count, question, i) => {
    return count + (state.answers[i] === question.correctIndex ? 1 : 0);
  }, 0);
  return {
    screen: 'quizResult',
    walk: state.walk,
    refDrifted: state.refDrifted,
    answers: state.answers,
    score,
    passed: score >= resolvePassThreshold(state.walk),
  };
}
