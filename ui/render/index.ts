/*
 * `ui/render` 的對外介面。呼叫端(`ui/main.ts`)只認這裡,拆分細節不外洩——
 * 分界對應 `ui/state.ts` 的四個畫面狀態:fileList / walking / quiz / quizResult。
 */
export { renderError, renderFileList, type FileListHandlers } from './fileList';
export { renderWalking, type WalkingHandlers } from './walking';
export { renderQuiz, renderQuizResult, type QuizHandlers, type QuizResultHandlers } from './quiz';
