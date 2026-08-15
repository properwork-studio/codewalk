import * as vscode from 'vscode';
import { getLocale, t } from '../shared/i18n';
import {
  parseWebviewToHostMessage,
  type AnchorReport,
  type AskAgentDestination,
  type AskAgentOutcome,
  type HostToWebviewMessage,
} from '../shared/protocol';
import { scoreQuiz, type CodewalkFile } from '../shared/schema';
import { buildAnchorReport, effectiveLineRange, emptyAnchorReport, jumpModeFor } from './anchorCheck';
import { buildAskAgentPrompt } from './askAgentPrompt';
import { AttemptStore } from './attemptStore';
import { jumpToStep } from './fileJump';
import { ProgressStore } from './progressStore';
import { getWorkspaceHead, isRefDrifted } from './refDrift';
import { readSnippetPreviews } from './snippetPreview';
import { currentThemeKind, resolveEditorTheme } from './themeSource';
import { listWalkFiles, loadCodewalkFile } from './walkLoader';
import { buildWalkRestoredMessage } from './webviewReadyPlan';

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/**
 * 側邊面板的 view provider——host 端的中樞:建立 webview、處理來自 webview 的
 * 訊息、操作編輯器,並持有目前導讀的狀態。
 *
 * 狀態的權威在這裡,不在 webview:目前讀到第幾步、錨驗證結果、snippet 內容都由
 * host 算好送出。webview 只回報讀者的意圖(見 `shared/protocol.ts`)。
 *
 * @remarks
 * 幾乎所有方法都需要真實的 vscode API,無法在 Vitest 環境測試。可獨立驗證的邏輯
 * 已刻意抽到 `anchorCheck.ts`、`webviewReadyPlan.ts`、`walkLoader.ts` 等模組,
 * 本類別只保留串接的部分。
 */
export class WalkPlayerViewProvider implements vscode.WebviewViewProvider {
  /** 必須與 package.json 的 `contributes.views` 條目 id 一致。 */
  public static readonly viewId = 'codewalk.playerView';

  private view: vscode.WebviewView | undefined;
  private currentWalk: CodewalkFile | undefined;
  private currentWalkPath: string | undefined;
  /**
   * Chat 面板在這個 VS Code session 裡是否已經被開啟過。第一次冷啟動時,
   * `workbench.action.chat.open` 的 Promise 常常在 Chat 自己的 webview 真正
   * 掛載完成前就 resolve,導致 `query` 被吃掉(讀者要點兩次才生效)——見
   * `handleAskAgent()` 的補送邏輯。
   */
  private chatWarmedUp = false;
  private stepIndex = 0;
  private refDrifted = false;
  private anchorReport: AnchorReport | undefined;
  private readonly attemptStore: AttemptStore;
  private readonly progressStore: ProgressStore;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.attemptStore = new AttemptStore(context.workspaceState);
    this.progressStore = new ProgressStore(context.workspaceState);
  }

  /**
   * VS Code 首次要顯示面板時呼叫,建立 webview 內容並掛上訊息與主題監聽。
   * 面板被拖到別的容器或因資源壓力回收後重建時會再次呼叫。
   */
  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist')],
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((raw: unknown) => this.handleMessage(raw));
    // 主題切換時只送一則 themeChanged 訊息、由 webview 自行重繪目前 step,
    // 不重建整個 webview.html——避免像舊版 snippetTheme 設定那樣把讀者彈回
    // 導讀列表畫面(design.md 決策 3、tasks.md 3.1)。
    const themeListener = vscode.window.onDidChangeActiveColorTheme(() => this.sendTheme());
    webviewView.onDidDispose(() => themeListener.dispose());
  }

  /** `codewalk.nextStep` 指令的處理常式(面板未取得焦點時仍可用的快捷鍵路徑)。 */
  public async handleNextStep(): Promise<void> {
    await this.moveStep(1);
  }

  /** `codewalk.prevStep` 指令的處理常式。 */
  public async handlePrevStep(): Promise<void> {
    await this.moveStep(-1);
  }

  /** `codewalk.revealCurrentStep` 指令的處理常式:把編輯器帶回目前步驟的位置。 */
  public async handleRevealCurrentStep(): Promise<void> {
    await this.jumpToCurrentStep();
  }

  private async handleMessage(raw: unknown): Promise<void> {
    const msg = parseWebviewToHostMessage(raw);
    if (!msg) return;

    switch (msg.type) {
      case 'webviewReady':
        await this.sendTheme();
        await this.sendFileList();
        await this.sendRestoreIfActive();
        break;
      case 'selectWalkFile':
        await this.loadWalk(msg.path);
        break;
      case 'resumeWalk':
        await this.loadWalk(msg.path, { resume: true });
        break;
      case 'revealCurrentStep':
        await this.jumpToCurrentStep();
        break;
      case 'nextStep':
        await this.moveStep(1);
        break;
      case 'prevStep':
        await this.moveStep(-1);
        break;
      case 'jumpToStep':
        await this.setStep(msg.stepIndex);
        break;
      case 'quizSubmitted':
        await this.handleQuizSubmitted(msg.answers);
        break;
      case 'openReference':
        await vscode.env.openExternal(vscode.Uri.parse(msg.url));
        break;
      case 'jumpToSnippet':
        await this.handleJumpToSnippet(msg.stepIndex, msg.itemIndex);
        break;
      case 'clearAttempt':
        await this.handleClearAttempt(msg.path);
        break;
      case 'copyRegenerateHint':
        await this.handleCopyRegenerateHint();
        break;
      case 'askAgent':
        await this.handleAskAgent(msg.destination, msg.selection);
        break;
      case 'backToList':
        this.clearActiveWalk();
        await this.sendFileList();
        break;
    }
  }

  /**
   * 返回列表時清掉 currentWalk 等 in-memory 狀態,讓下一次 webviewReady
   * 判斷「該不該回灌」時視同尚未選擇導讀(design.md 決策 1)。
   */
  private clearActiveWalk(): void {
    this.currentWalk = undefined;
    this.currentWalkPath = undefined;
    this.anchorReport = undefined;
    this.refDrifted = false;
    this.stepIndex = 0;
  }

  private async handleCopyRegenerateHint(): Promise<void> {
    const hint = this.currentWalk?.regenerateHint;
    if (!hint) return;
    await vscode.env.clipboard.writeText(hint);
  }

  /**
   * 把目前步驟(可選地帶框選文字)交給 AI 助手。`chat` 失敗時退回剪貼簿並回報
   * `chatUnavailable`——webview 不能樂觀顯示「已送出」,那是靜默且誤導的失敗
   * (design.md 決策 5、6,ask-agent capability「Chat 不可用時退回剪貼簿並明確
   * 告知」)。
   */
  private async handleAskAgent(destination: AskAgentDestination, selection?: string): Promise<void> {
    if (!this.currentWalk || !this.currentWalkPath) return;
    const status = this.anchorReport?.steps[this.stepIndex]?.step ?? { kind: 'unanchored' as const };
    const prompt = buildAskAgentPrompt({
      walk: this.currentWalk,
      walkPath: this.currentWalkPath,
      workspaceRoot: getWorkspaceRoot(),
      stepIndex: this.stepIndex,
      stepStatus: status,
      selection,
    });

    if (destination === 'clipboard') {
      await this.writeAskAgentClipboard(prompt, 'clipboard');
      return;
    }

    try {
      // isPartialQuery: true——只填入不代讀者送出。Cursor 本來就不自動送
      // (即使支援此命令的版本也只填入),設 true 讓兩個編輯器行為一致
      // (design.md 決策 4)。不預先用 getCommands() 偵測命令是否存在:
      // 那只答得出「存不存在」,答不出「執行失敗」,try/catch 兩者都涵蓋
      // (design.md 決策 5)。
      await vscode.commands.executeCommand('workbench.action.chat.open', {
        query: prompt,
        isPartialQuery: true,
      });
      if (!this.chatWarmedUp) {
        this.chatWarmedUp = true;
        // 冷啟動時 Chat 自己的 webview 常常還沒掛載完成,query 就被吃掉了
        // (讀者要點兩次才生效,見手動驗證的實測結果)。只在這個 session 的
        // 第一次補送一次;之後面板已經「熱」了,不再需要這個延遲。冷啟動
        // 當下面板連可互動的輸入框都還沒掛出來,不會有「補送蓋掉讀者已輸入
        // 內容」的風險。
        await new Promise((resolve) => setTimeout(resolve, 400));
        await vscode.commands.executeCommand('workbench.action.chat.open', {
          query: prompt,
          isPartialQuery: true,
        });
      }
      this.post({ type: 'askAgentResult', outcome: 'chat' });
    } catch {
      await this.writeAskAgentClipboard(prompt, 'chatUnavailable');
    }
  }

  private async writeAskAgentClipboard(
    prompt: string,
    outcome: Extract<AskAgentOutcome, 'clipboard' | 'chatUnavailable'>,
  ): Promise<void> {
    try {
      await vscode.env.clipboard.writeText(prompt);
      this.post({ type: 'askAgentResult', outcome });
    } catch {
      this.post({ type: 'askAgentResult', outcome: 'failed' });
    }
  }

  private async handleQuizSubmitted(answers: number[]): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root || !this.currentWalk || !this.currentWalkPath) return;
    const score = scoreQuiz(this.currentWalk, answers);
    try {
      await this.attemptStore.record(root, this.currentWalkPath, this.currentWalk.ref, Date.now(), score);
    } catch {
      // 作答紀錄是輔助功能,留存失敗不打斷讀者已完成的作答流程(design.md 決策 8)
    }
    try {
      await this.progressStore.clear(root, this.currentWalkPath);
    } catch {
      // 清除進度失敗不影響作答紀錄的留存,也不打斷讀者流程(design.md 決策 7)
    }
  }

  private async handleClearAttempt(path: string): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) return;
    await this.attemptStore.clear(root, path);
    await this.sendFileList();
  }

  private async handleJumpToSnippet(stepIndex: number, itemIndex: number): Promise<void> {
    const root = getWorkspaceRoot();
    const step = this.currentWalk?.steps[stepIndex];
    const item = step?.items?.[itemIndex];
    if (!root || !item || (item.kind !== 'snippet' && item.kind !== 'diff')) return;
    const status = this.anchorReport?.steps[stepIndex]?.items.find((s) => s.itemIndex === itemIndex)
      ?.status ?? {
      kind: 'unanchored' as const,
    };
    const target = effectiveLineRange(item, status);
    const result = await jumpToStep(root, { ...item, ...target }, jumpModeFor(status));
    if (!result.ok) {
      this.post({ type: 'stepJumpError', message: result.message });
    }
  }

  private async sendTheme(): Promise<void> {
    const theme = await resolveEditorTheme();
    this.post({ type: 'themeChanged', theme, kind: currentThemeKind() });
  }

  private async sendFileList(): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) {
      this.post({ type: 'loadError', message: t('host.noWorkspace') });
      return;
    }
    const files = await listWalkFiles(
      root,
      (filePath, ref) => this.attemptStore.get(root, filePath, ref),
      (filePath, ref) => this.progressStore.get(root, filePath, ref),
    );
    this.post({ type: 'walkFileList', files });
  }

  /**
   * host 仍持有目前導讀時,webview 真的被重建(而非常態的面板隱藏/顯示)
   * 就靠這則訊息回灌——不呼叫 jumpToCurrentStep(),恢復動作不動編輯器
   * (reading-progress capability「恢復閱讀位置不改動編輯器」)。
   */
  private async sendRestoreIfActive(): Promise<void> {
    if (!this.currentWalk || !this.anchorReport) return;
    const message = buildWalkRestoredMessage(
      {
        walk: this.currentWalk,
        stepIndex: this.stepIndex,
        refDrifted: this.refDrifted,
        anchorReport: this.anchorReport,
      },
      await this.readCurrentSnippetPreviews(),
    );
    if (message) {
      this.post(message);
    }
  }

  /**
   * `resume: true` 時起始步驟取自留存進度(接續上次)、且不 reveal 編輯器;
   * 一般選擇導讀(resume 省略)一律從第一步開始並照常跳轉(design.md 決策
   * 5、6,walk-player capability「Quiz 作答紀錄的留存」MODIFIED requirement)。
   */
  private async loadWalk(path: string, options: { resume?: boolean } = {}): Promise<void> {
    const result = await loadCodewalkFile(path);
    if (!result.valid) {
      this.post({ type: 'loadError', message: result.errors.join('; ') });
      return;
    }

    this.currentWalk = result.value;
    this.currentWalkPath = path;
    this.refDrifted = false;

    const root = getWorkspaceRoot();
    if (root) {
      const head = await getWorkspaceHead(root);
      this.refDrifted = head !== null && isRefDrifted(head, result.value.ref);
      this.anchorReport = buildAnchorReport(root, result.value);
    } else {
      this.anchorReport = emptyAnchorReport(result.value);
    }

    const maxIndex = this.currentWalk.steps.length - 1;
    const progress =
      options.resume && root ? this.progressStore.get(root, path, result.value.ref) : undefined;
    this.stepIndex = Math.min(Math.max(progress?.stepIndex ?? 0, 0), maxIndex);

    this.post({
      type: 'walkLoaded',
      walk: this.currentWalk,
      stepIndex: this.stepIndex,
      refDrifted: this.refDrifted,
      anchorReport: this.anchorReport,
      snippetPreviews: await this.readCurrentSnippetPreviews(),
    });
    if (!options.resume) {
      await this.jumpToCurrentStep();
    }
  }

  private async moveStep(delta: number): Promise<void> {
    if (!this.currentWalk) return;
    await this.setStep(this.stepIndex + delta);
  }

  private async setStep(index: number): Promise<void> {
    if (!this.currentWalk) return;
    const maxIndex = this.currentWalk.steps.length - 1;
    this.stepIndex = Math.min(Math.max(index, 0), maxIndex);
    await this.saveProgress();
    this.post({
      type: 'stepChanged',
      stepIndex: this.stepIndex,
      snippetPreviews: await this.readCurrentSnippetPreviews(),
    });
    await this.jumpToCurrentStep();
  }

  private async saveProgress(): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root || !this.currentWalk || !this.currentWalkPath) return;
    try {
      await this.progressStore.record(root, this.currentWalkPath, this.currentWalk.ref, this.stepIndex);
    } catch {
      // 進度是輔助功能,留存失敗不打斷讀者當下的閱讀流程(reading-progress
      // capability「閱讀進度跨工作階段留存」)
    }
  }

  private async readCurrentSnippetPreviews() {
    const root = getWorkspaceRoot();
    const items = this.currentWalk?.steps[this.stepIndex]?.items;
    if (!root || !items) return [];
    const itemStatuses = this.anchorReport?.steps[this.stepIndex]?.items ?? [];
    return readSnippetPreviews(root, items, itemStatuses);
  }

  private async jumpToCurrentStep(): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root || !this.currentWalk) return;
    const step = this.currentWalk.steps[this.stepIndex];
    const status = this.anchorReport?.steps[this.stepIndex]?.step ?? {
      kind: 'unanchored' as const,
    };
    const target = effectiveLineRange(step, status);
    const result = await jumpToStep(root, { ...step, ...target }, jumpModeFor(status));
    if (!result.ok) {
      this.post({ type: 'stepJumpError', message: result.message });
    }
  }

  private post(message: HostToWebviewMessage): void {
    void this.view?.webview.postMessage(message);
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.css'),
    );
    const codiconUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'codicon.css'),
    );
    const nonce = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    // getLocale() 讀的是 activate() 首行已設定好的 host locale——webview 開機時
    // 從這個標籤讀回判定結果,兩邊共用同一個 resolveLocale()(design.md 決策 4、5)。
    const htmlLang = getLocale() === 'zh-tw' ? 'zh-Hant' : 'en';

    return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
  <!-- codicon.css 要先載入:它對 .codicon 的 font-size 用 font 這個 shorthand 屬性設定,
       跟 theme.css 裡對應覆寫的 selector specificity 打平時,cascade 順序在後的會贏,
       所以 theme.css 必須排在 codicon.css 之後,尺寸覆寫才會生效。 -->
  <link href="${codiconUri}" rel="stylesheet" />
  <link href="${styleUri}" rel="stylesheet" />
</head>
<body>
  <div id="app" tabindex="0"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
