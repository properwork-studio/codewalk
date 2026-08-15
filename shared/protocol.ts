/*
 * host(`src/`)與 webview(`ui/`)之間的 postMessage 協定,訊息型別的單一定義處。
 * 兩側都 import 這份檔案,任一方新增或改動訊息時,另一方會在編譯期就被型別
 * 檢查逼著跟上——這是分層架構唯一的接縫,刻意讓它窄且顯眼。
 */

import type { CodewalkFile } from './schema';

/** 某份導讀最後一次的 Quiz 作答結果,隨 walkFileList 送到 webview 顯示在列表上。 */
export interface AttemptSummary {
  /** 作答完成時間(Unix 毫秒)。 */
  at: number;
  score: number;
  total: number;
  passed: boolean;
}

/** 留存的閱讀進度摘要,隨 walkFileList 送到 webview(reading-progress capability「導讀列表顯示接續入口」)。 */
export interface WalkProgressSummary {
  stepIndex: number;
}

/** 導讀列表中的單一項目。host 掃描 `.codewalk/` 後彙整,不含步驟內容——列表畫面用不到。 */
export interface WalkFileSummary {
  /** 導讀檔的絕對路徑;webview 原樣回傳給 host 當作選取識別,不自行解讀。 */
  path: string;
  /** 導讀標題;檔案解析失敗時退回檔名,讓壞掉的檔案仍看得見、點得到(才能看到錯誤訊息)。 */
  title: string;
  /** 沒有作答紀錄、或紀錄的 ref 與現行導讀不符時省略。 */
  lastAttempt?: AttemptSummary;
  /** 沒有留存進度、或進度的 ref 與現行導讀不符時省略。 */
  progress?: WalkProgressSummary;
}

/**
 * 單一 snippet 的預覽內容,由 host 讀檔後隨 walkLoaded/stepChanged 送出。
 * `itemIndex` 對應該 step 的 `items` 索引,webview 靠它把內容配回正確的元件。
 *
 * `source` 區分內容的來源:`'current'` 是現行檔案的實際內容,`'anchor'` 則是
 * 產出當時留下的原文——只在該 snippet 已失準(內容找不到或有歧義)時才會出現。
 */
export type SnippetPreviewResult =
  | { itemIndex: number; ok: true; content: string; language: string; source: 'current' | 'anchor' }
  | { itemIndex: number; ok: false; message: string; anchorContent?: string; language?: string };

/**
 * 單一 step 或 snippet 相對於其 `anchor` 的驗證結果。`shifted` 只在整份檔案內
 * 找到「恰好一處」逐字相同的內容時成立,`startLine`/`endLine` 為新位置——
 * 見 stale-step-detection capability「單純位移時跟隨新行號」。
 */
export type AnchorStatus =
  | { kind: 'unanchored' }
  | { kind: 'matched' }
  | { kind: 'shifted'; startLine: number; endLine: number }
  | { kind: 'stale'; reason: 'notFound' | 'ambiguous' | 'fileMissing' };

/** 單一 item 的錨驗證結果。只有 snippet 會被驗證,所以 `itemIndex` 在 items 陣列中是稀疏的。 */
export interface AnchorItemStatus {
  itemIndex: number;
  status: AnchorStatus;
}

/** 單一 step 的錨驗證結果:step 自身的行段狀態,加上其下每個 snippet 的狀態。 */
export interface AnchorStepReport {
  step: AnchorStatus;
  items: AnchorItemStatus[];
}

/**
 * 整份導讀的錨驗證結果,載入時一次計算、隨 walkLoaded 送出(design.md 決策 3)。
 * `anyAnchored` 只要有任一目標提供了非空白 anchor 就是 true——不論驗證結果是
 * matched/shifted/stale,用來決定是否改以逐步狀態取代整份 refDrifted 警告。
 */
export interface AnchorReport {
  anyAnchored: boolean;
  anyStale: boolean;
  staleCount: number;
  steps: AnchorStepReport[];
}

/**
 * 算出該用哪組行號:內容只是位移時採用偵測到的新行號,其餘情況(相符、未錨定、
 * 失準)一律沿用導讀原本記錄的行號。
 *
 * @param original - 導讀 JSON 裡記載的行段
 *
 * @remarks
 * 純函式,刻意放在 shared/ 讓 host(跳轉、讀預覽內容)與 webview(面板上顯示的
 * 行號文字)共用同一份邏輯——兩邊各自實作遲早會算出不同答案,讀者就會看到
 * 面板寫某行、跳過去卻是另一行(design.md 決策 3、5)。
 */
export function effectiveLineRange(
  original: { startLine: number; endLine: number },
  status: AnchorStatus,
): { startLine: number; endLine: number } {
  return status.kind === 'shifted' ? { startLine: status.startLine, endLine: status.endLine } : original;
}

/**
 * 讀者觸發「把這一步交給 AI」時選擇的出口。兩者產生完全相同的提問內容,
 * 差別只在送到哪(ask-agent capability「把當前步驟交給 AI 助手的入口」)。
 */
export type AskAgentDestination = 'chat' | 'clipboard';

/**
 * `askAgent` 訊息實際發生的結果,決定 webview 該顯示什麼回饋。`chatUnavailable`
 * 與 `failed` 是兩種不同的降級:前者已改寫剪貼簿成功,後者連剪貼簿都失敗
 * (design.md 決策 6)。
 */
export type AskAgentOutcome = 'chat' | 'clipboard' | 'chatUnavailable' | 'failed';

/** VS Code 主題 JSON 的 tokenColors 條目;scope 可以是單一字串或字串陣列。 */
export interface ThemeTokenColorRule {
  scope: string | string[];
  settings: { foreground?: string; fontStyle?: string };
}

/**
 * 由 host 解析讀者當前 VS Code 主題後送往 webview 的結果。name 由 host 每次
 * 解析時遞增產生,不重複使用——Shiki 的 loadTheme() 對同名主題重載是 no-op
 * (已實測),同名會讓「切換主題後重繪」失效,見 design.md 決策 3 的修訂。
 */
export interface ResolvedEditorTheme {
  name: string;
  kind: 'light' | 'dark';
  tokenColors: ThemeTokenColorRule[];
}

/**
 * host → webview。webview 端在 `ui/main.ts` 的 message 監聽器逐一處理,收到後
 * 更新畫面狀態並重繪。
 *
 * host 是狀態的權威:目前讀到第幾步、錨驗證結果、snippet 內容都由 host 算好送出,
 * webview 不自行讀檔或推算。
 */
export type HostToWebviewMessage =
  /** 可選的導讀清單。webview 收到即切到列表畫面(含首次開啟與返回列表)。 */
  | { type: 'walkFileList'; files: WalkFileSummary[] }
  /** 讀者選定的導讀已載入完成,webview 切到走讀畫面。 */
  | {
      type: 'walkLoaded';
      walk: CodewalkFile;
      /** 起始步驟——「接續上次」時為留存的進度,一般選取時為 0。 */
      stepIndex: number;
      refDrifted: boolean;
      anchorReport: AnchorReport;
      snippetPreviews: SnippetPreviewResult[];
    }
  /** 步驟已切換(可能來自面板按鈕、鍵盤,或 VS Code 指令),webview 據此更新畫面。 */
  | { type: 'stepChanged'; stepIndex: number; snippetPreviews: SnippetPreviewResult[] }
  /** 導讀載入或格式驗證失敗,webview 切到錯誤畫面。訊息內容固定英文(見 shared/schema.ts)。 */
  | { type: 'loadError'; message: string }
  /** 跳轉到目標檔案失敗(通常是檔案不存在)。屬於當前步驟的暫時性警告,不影響走讀狀態。 */
  | { type: 'stepJumpError'; message: string }
  | {
      type: 'themeChanged';
      /** host 無法解析讀者當前主題時為 null,webview 改依 kind 選用內建主題。 */
      theme: ResolvedEditorTheme | null;
      kind: 'light' | 'dark';
    }
  | {
      /**
       * webview 在同一個 session 內真的被重建(非常態的面板隱藏/顯示,例如
       * view 被拖到別的容器)時,host 依然持有的導讀內容回灌——webview 收到
       * 後只帶 walk 與 host 端的 stepIndex,細部畫面(walking/quiz/quizResult)
       * 由 webview 自己保留的 setState 決定(reading-progress capability
       * 「面板重建後還原閱讀位置」,design.md 決策 1、4)。
       */
      type: 'walkRestored';
      walk: CodewalkFile;
      stepIndex: number;
      refDrifted: boolean;
      anchorReport: AnchorReport;
      snippetPreviews: SnippetPreviewResult[];
    }
  /**
   * 對 `askAgent` 的結果回報。**送進 chat 失敗而退回剪貼簿時,webview 不能
   * 樂觀地顯示「已送出」**——那是靜默且誤導的失敗(design.md 決策 6),
   * 所以這則訊息一律等 host 端動作完成才送出,不是意圖的鏡射。
   */
  | { type: 'askAgentResult'; outcome: AskAgentOutcome };

/**
 * webview → host。一律經 {@link parseWebviewToHostMessage} 驗證後才處理。
 *
 * 都是「讀者做了什麼」的意圖,不是狀態更新——webview 不告訴 host 該進到第幾步,
 * 只說「按了下一步」,由 host 決定結果並送回 stepChanged。
 */
export type WebviewToHostMessage =
  /** webview 腳本啟動完成。host 回以主題、導讀列表,必要時回灌目前導讀。 */
  | { type: 'webviewReady' }
  /** 從列表選定一份導讀,從第一步開始。 */
  | { type: 'selectWalkFile'; path: string }
  | { type: 'nextStep' }
  | { type: 'prevStep' }
  /** 直接跳到指定步驟。也用於重播當前步驟的跳轉(取消 quiz、重走導讀、開啟失準檔案)。 */
  | { type: 'jumpToStep'; stepIndex: number }
  /** 送出 quiz 答案。未作答的題目以 -1 表示(見 shared/schema.ts 的 scoreQuiz)。 */
  | { type: 'quizSubmitted'; answers: number[] }
  /** 開啟外部連結。host 交給 VS Code 處理,webview 本身無法開啟瀏覽器。 */
  | { type: 'openReference'; url: string }
  /** 點擊 snippet 或 diff 的標題列,跳到它指向的位置。 */
  | { type: 'jumpToSnippet'; stepIndex: number; itemIndex: number }
  /** 清除某份導讀的 Quiz 作答紀錄。 */
  | { type: 'clearAttempt'; path: string }
  /** 把導讀的 regenerateHint 複製到剪貼簿。 */
  | { type: 'copyRegenerateHint' }
  /**
   * 把目前步驟(可選地帶框選文字)交給 AI 助手。`selection` 省略代表問整步,
   * 不另立布林欄位——意圖本來就是同一個,差別只在送到哪(design.md 決策 7)。
   */
  | { type: 'askAgent'; destination: AskAgentDestination; selection?: string }
  /** 從列表接續上次的閱讀進度;與 selectWalkFile 的差別是起始步驟與不跳轉編輯器。 */
  | { type: 'resumeWalk'; path: string }
  /** 把編輯器帶回目前步驟的位置(面板按鈕或 Home 鍵)。 */
  | { type: 'revealCurrentStep' }
  /**
   * 從走讀/quiz 結果畫面返回列表——與 webviewReady 分開,因為 host 用
   * currentWalk 是否存在判斷「該不該回灌 walkRestored」(design.md 決策 1);
   * 若沿用 webviewReady 讓 host 誤以為仍在同一份導讀,回列表會被立刻拉回去。
   */
  | { type: 'backToList' };

function isStringArrayLike(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'number');
}

/**
 * 驗證並窄化來自 webview 的訊息。host 收到的每一則都必須先過這裡。
 *
 * @param data - `onDidReceiveMessage` 的原始 payload,型別上是任意值
 * @returns 無法辨識或欄位型別不符時回傳 null,由呼叫端安靜忽略
 *
 * @remarks
 * webview 執行的是自家 bundle,理論上不會送出格式錯誤的訊息;這層驗證是為了讓
 * host 端的 switch 能拿到已窄化的型別,而不是把 `unknown` 一路 cast 下去。
 */
export function parseWebviewToHostMessage(data: unknown): WebviewToHostMessage | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const d = data as Record<string, unknown>;

  switch (d.type) {
    case 'webviewReady':
      return { type: 'webviewReady' };
    case 'selectWalkFile':
      return typeof d.path === 'string' ? { type: 'selectWalkFile', path: d.path } : null;
    case 'nextStep':
      return { type: 'nextStep' };
    case 'prevStep':
      return { type: 'prevStep' };
    case 'jumpToStep':
      return typeof d.stepIndex === 'number' ? { type: 'jumpToStep', stepIndex: d.stepIndex } : null;
    case 'quizSubmitted':
      return isStringArrayLike(d.answers) ? { type: 'quizSubmitted', answers: d.answers } : null;
    case 'openReference':
      return typeof d.url === 'string' ? { type: 'openReference', url: d.url } : null;
    case 'jumpToSnippet':
      return typeof d.stepIndex === 'number' && typeof d.itemIndex === 'number'
        ? { type: 'jumpToSnippet', stepIndex: d.stepIndex, itemIndex: d.itemIndex }
        : null;
    case 'clearAttempt':
      return typeof d.path === 'string' ? { type: 'clearAttempt', path: d.path } : null;
    case 'copyRegenerateHint':
      return { type: 'copyRegenerateHint' };
    case 'askAgent': {
      const destination = d.destination;
      if (destination !== 'chat' && destination !== 'clipboard') return null;
      const selection = d.selection;
      if (selection !== undefined && typeof selection !== 'string') return null;
      return { type: 'askAgent', destination, selection };
    }
    case 'resumeWalk':
      return typeof d.path === 'string' ? { type: 'resumeWalk', path: d.path } : null;
    case 'revealCurrentStep':
      return { type: 'revealCurrentStep' };
    case 'backToList':
      return { type: 'backToList' };
    default:
      return null;
  }
}
