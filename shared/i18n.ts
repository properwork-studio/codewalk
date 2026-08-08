/**
 * 介面文案的雙語翻譯表與 t()。host(src/)與 webview(ui/)各自 bundle 一份
 * 模組實例,兩邊都必須各自呼叫 setLocale()——這不是缺陷而是兩份獨立 bundle
 * 的必然結果(design.md 決策 2、5)。
 *
 * 只收「播放器自身產生」的文案。`.codewalk.json` 的導讀內容(narration、
 * title、quiz 題目等)不經過這裡,見 interface-localization capability
 * 「介面文案與導讀內容的邊界」。
 *
 * `shared/schema.ts` 的格式驗證錯誤刻意不經過這裡,固定英文——見該檔案頭的說明。
 */

const zhTW = {
  'fileList.title': '選擇導讀',
  'fileList.empty': '找不到導讀檔案(workspace 內沒有 .codewalk/*.codewalk.json)',
  'fileList.continueLabel': '接續上次(第 {step} 步)',
  'fileList.moreActions': '更多動作',
  'fileList.clearAttemptConfirm': '確定清除?',
  'fileList.clearAttempt': '清除 Quiz 紀錄',

  'time.justNow': '剛剛',
  'time.minuteAgo': '{n} 分鐘前',
  'time.minutesAgo': '{n} 分鐘前',
  'time.hourAgo': '{n} 小時前',
  'time.hoursAgo': '{n} 小時前',
  'time.yesterday': '昨天',
  'time.daysAgo': '{n} 天前',

  'walking.regeneratePrompt': '這份導讀有步驟已與現行程式碼不符,建議重新產生',
  'walking.copyRegenerateHint': '複製重生指令',
  'walking.backToList': '返回列表',
  'walking.refDriftWarning': '目前 commit 與導讀釘住的版本不同,行號可能漂移',
  'walking.stepProgress': '第 {current} / {total} 步',
  'walking.stepDotTitle': '第 {n} 步',
  'walking.revealStep': '回到本步專案位置',
  'walking.revealStepTitle': '回到本步專案位置(Home)',
  'walking.prev': '上一步',
  'walking.next': '下一步',
  'walking.completeHint': '已到達最後一步,可以開始自測',
  'walking.startQuiz': '開始 Quiz 自測',

  'stale.openCurrentFile': '開啟現行檔案',
  'stale.fileNotFound': '找不到檔案',
  'stale.contentLabel': '以下為產出當時的內容,現行版本已不同',

  'items.pitfallHeader': '容易誤解的地方',
  'items.misconceptionLabel': '誤解:',
  'items.realityLabel': '其實:',

  'quiz.title': 'Quiz 自測',
  'quiz.answeredProgress': '已作答 {answered} / {total} 題',
  'quiz.questionDotTitle': '第 {n} 題',
  'quiz.questionDotTitleAnswered': '第 {n} 題(已作答)',
  'quiz.cancel': '取消,回到最後一步',
  'quiz.submit': '送出答案',
  'quiz.scoreLabel': '得分 {score} / {total} 題,{status}',
  'quiz.passed': '通過',
  'quiz.failed': '未通過',
  'quiz.resultTitle': 'Quiz 結果',
  'quiz.suggestion': '建議重走本導讀,或選擇更詳細版本的導讀再試一次',
  'quiz.yourAnswer': '你的答案:',
  'quiz.notAnswered': '(未作答)',
  'quiz.correctAnswer': '正確答案:',
  'quiz.retry': '重新挑戰 Quiz',
  'quiz.restartWalk': '重新走一次導讀',
  'quiz.backToList': '回到導讀列表',

  'host.noWorkspace': '未開啟任何 workspace',
  'host.fileNotFound': '找不到檔案:{file}',
} as const;

export type TranslationKey = keyof typeof zhTW;

const en: Record<TranslationKey, string> = {
  'fileList.title': 'Choose a walk',
  'fileList.empty': 'No walks found (no .codewalk/*.codewalk.json in this workspace)',
  'fileList.continueLabel': 'Resume (step {step})',
  'fileList.moreActions': 'More actions',
  'fileList.clearAttemptConfirm': 'Clear it?',
  'fileList.clearAttempt': 'Clear quiz record',

  'time.justNow': 'just now',
  'time.minuteAgo': '{n} minute ago',
  'time.minutesAgo': '{n} minutes ago',
  'time.hourAgo': '{n} hour ago',
  'time.hoursAgo': '{n} hours ago',
  'time.yesterday': 'yesterday',
  'time.daysAgo': '{n} days ago',

  'walking.regeneratePrompt':
    'Some steps in this walk no longer match the current code — consider regenerating it.',
  'walking.copyRegenerateHint': 'Copy regenerate command',
  'walking.backToList': 'Back to list',
  'walking.refDriftWarning':
    'The current commit differs from the one this walk was pinned to — line numbers may have drifted.',
  'walking.stepProgress': 'Step {current} of {total}',
  'walking.stepDotTitle': 'Step {n}',
  'walking.revealStep': 'Reveal in workspace',
  'walking.revealStepTitle': 'Reveal in workspace (Home)',
  'walking.prev': 'Previous',
  'walking.next': 'Next',
  'walking.completeHint': "You've reached the last step — ready for the quiz?",
  'walking.startQuiz': 'Start quiz',

  'stale.openCurrentFile': 'Open current file',
  'stale.fileNotFound': 'File not found',
  'stale.contentLabel': 'This shows the content as generated — the current version differs.',

  'items.pitfallHeader': 'Common misconception',
  'items.misconceptionLabel': 'Misconception: ',
  'items.realityLabel': 'Reality: ',

  'quiz.title': 'Quiz',
  'quiz.answeredProgress': '{answered} of {total} answered',
  'quiz.questionDotTitle': 'Question {n}',
  'quiz.questionDotTitleAnswered': 'Question {n} (answered)',
  'quiz.cancel': 'Cancel, back to last step',
  'quiz.submit': 'Submit answers',
  'quiz.scoreLabel': 'Score {score} of {total}, {status}',
  'quiz.passed': 'passed',
  'quiz.failed': 'failed',
  'quiz.resultTitle': 'Quiz results',
  'quiz.suggestion': 'Consider retaking this walk, or trying a more detailed version.',
  'quiz.yourAnswer': 'Your answer: ',
  'quiz.notAnswered': '(not answered)',
  'quiz.correctAnswer': 'Correct answer: ',
  'quiz.retry': 'Retry quiz',
  'quiz.restartWalk': 'Restart walk',
  'quiz.backToList': 'Back to walk list',

  'host.noWorkspace': 'No workspace is open',
  'host.fileNotFound': 'File not found: {file}',
};

export type Locale = 'zh-tw' | 'en';

// 預設英文:與 package.nls.json 的預設一致,setLocale() 未被呼叫時不會意外
// 顯示錯誤的語言(design.md Risks——「setLocale() 沒被呼叫或呼叫太晚」)。
let locale: Locale = 'en';

export function setLocale(next: Locale): void {
  locale = next;
}

export function getLocale(): Locale {
  return locale;
}

/** `zh-*`(含 zh-Hant、zh-CN 等地區/文字系統變體)一律視為繁體中文,其餘
 * 一律英文——interface-localization capability「介面語言跟隨編輯器顯示語言」。
 * 前綴比對而非完整字串比對,讓 host 與 webview 能共用同一個函式:host 吃
 * vscode.env.language(如 'zh-tw'),webview 吃 <html lang> 的 HTML 語言標籤
 * (如 'zh-Hant'),兩者都以 'zh' 開頭(design.md 決策 4)。 */
export function resolveLocale(language: string | undefined): Locale {
  return language?.toLowerCase().startsWith('zh') ? 'zh-tw' : 'en';
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const template = (locale === 'zh-tw' ? zhTW : en)[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}
