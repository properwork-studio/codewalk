import * as vscode from 'vscode';
import { parseWebviewToHostMessage, type HostToWebviewMessage } from '../shared/protocol';
import type { CodewalkFile } from '../shared/schema';
import { jumpToStep } from './fileJump';
import { getWorkspaceHead, isRefDrifted } from './refDrift';
import { readSnippetPreviews } from './snippetPreview';
import { listWalkFiles, loadCodewalkFile } from './walkLoader';

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

// 對應 esbuild.js 的 NAMED_HLJS_THEMES + 'auto'——那邊決定實際套用哪個 highlight.js
// 官方主題檔案,這裡只需要知道合法的設定值有哪些。
const SNIPPET_THEMES = [
  'auto',
  'github-dark',
  'github-light',
  'monokai',
  'atom-one-dark',
  'night-owl',
  'dracula',
  'material-palenight',
  'rose-pine-moon',
  'tokyo-night-dark',
] as const;

// 需與 package.json 的 codewalk.snippetTheme.default 保持一致。
const DEFAULT_SNIPPET_THEME: (typeof SNIPPET_THEMES)[number] = 'material-palenight';

/**
 * enum 只在 Settings UI 裡擋得住手誤選項,使用者手改 settings.json 仍可能塞入
 * 任意字串——這裡白名單一次,同時避免該字串被直接接到 HTML 屬性裡造成注入。
 * 白名單外的值(包含使用者手改設定塞入的非法字串)一律退回預設 theme。
 */
function resolveSnippetTheme(): (typeof SNIPPET_THEMES)[number] {
  const raw = vscode.workspace.getConfiguration('codewalk').get<string>('snippetTheme');
  return (SNIPPET_THEMES as readonly string[]).includes(raw ?? '')
    ? (raw as (typeof SNIPPET_THEMES)[number])
    : DEFAULT_SNIPPET_THEME;
}

export class WalkPlayerViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'codewalk.playerView';

  private view: vscode.WebviewView | undefined;
  private currentWalk: CodewalkFile | undefined;
  private stepIndex = 0;
  private refDrifted = false;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist')],
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((raw: unknown) => this.handleMessage(raw));
    // 設定變更後重繪整個 webview 是最簡單、風險最低的作法:snippet 主題只在
    // 面板內部樣式生效,不影響其他狀態的正確性,換來的代價(重繪會回到導讀
    // 列表畫面)在「使用者剛改完設定」這個情境下可以接受。
    const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('codewalk.snippetTheme') && this.view) {
        this.view.webview.html = this.getHtml(this.view.webview);
      }
    });
    webviewView.onDidDispose(() => configListener.dispose());
  }

  public async handleNextStep(): Promise<void> {
    await this.moveStep(1);
  }

  public async handlePrevStep(): Promise<void> {
    await this.moveStep(-1);
  }

  private async handleMessage(raw: unknown): Promise<void> {
    const msg = parseWebviewToHostMessage(raw);
    if (!msg) return;

    switch (msg.type) {
      case 'webviewReady':
        await this.sendFileList();
        break;
      case 'selectWalkFile':
        await this.loadWalk(msg.path);
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
        break;
      case 'openReference':
        await vscode.env.openExternal(vscode.Uri.parse(msg.url));
        break;
      case 'jumpToSnippet':
        await this.handleJumpToSnippet(msg.stepIndex, msg.itemIndex);
        break;
    }
  }

  private async handleJumpToSnippet(stepIndex: number, itemIndex: number): Promise<void> {
    const root = getWorkspaceRoot();
    const step = this.currentWalk?.steps[stepIndex];
    const item = step?.items?.[itemIndex];
    if (!root || !item || item.kind !== 'snippet') return;
    const result = await jumpToStep(root, item);
    if (!result.ok) {
      this.post({ type: 'stepJumpError', message: result.message });
    }
  }

  private async sendFileList(): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) {
      this.post({ type: 'loadError', message: '未開啟任何 workspace' });
      return;
    }
    const files = await listWalkFiles(root);
    this.post({ type: 'walkFileList', files });
  }

  private async loadWalk(path: string): Promise<void> {
    const result = await loadCodewalkFile(path);
    if (!result.valid) {
      this.post({ type: 'loadError', message: result.errors.join('; ') });
      return;
    }

    this.currentWalk = result.value;
    this.stepIndex = 0;
    this.refDrifted = false;

    const root = getWorkspaceRoot();
    if (root) {
      const head = await getWorkspaceHead(root);
      this.refDrifted = head !== null && isRefDrifted(head, result.value.ref);
    }

    this.post({
      type: 'walkLoaded',
      walk: this.currentWalk,
      stepIndex: this.stepIndex,
      refDrifted: this.refDrifted,
      snippetPreviews: await this.readCurrentSnippetPreviews(),
    });
    await this.jumpToCurrentStep();
  }

  private async moveStep(delta: number): Promise<void> {
    if (!this.currentWalk) return;
    await this.setStep(this.stepIndex + delta);
  }

  private async setStep(index: number): Promise<void> {
    if (!this.currentWalk) return;
    const maxIndex = this.currentWalk.steps.length - 1;
    this.stepIndex = Math.min(Math.max(index, 0), maxIndex);
    this.post({
      type: 'stepChanged',
      stepIndex: this.stepIndex,
      snippetPreviews: await this.readCurrentSnippetPreviews(),
    });
    await this.jumpToCurrentStep();
  }

  private async readCurrentSnippetPreviews() {
    const root = getWorkspaceRoot();
    const items = this.currentWalk?.steps[this.stepIndex]?.items;
    if (!root || !items) return [];
    return readSnippetPreviews(root, items);
  }

  private async jumpToCurrentStep(): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root || !this.currentWalk) return;
    const result = await jumpToStep(root, this.currentWalk.steps[this.stepIndex]);
    if (!result.ok) {
      this.post({ type: 'stepJumpError', message: result.message });
    }
  }

  private post(message: HostToWebviewMessage): void {
    void this.view?.webview.postMessage(message);
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.css'));
    const codiconUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'codicon.css'));
    const hljsThemesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'hljs-themes.css'),
    );
    const nonce = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
  <!-- codicon.css 要先載入:它對 .codicon 的 font-size 用 font 這個 shorthand 屬性設定,
       跟 theme.css 裡對應覆寫的 selector specificity 打平時,cascade 順序在後的會贏,
       所以 theme.css 必須排在 codicon.css 之後,尺寸覆寫才會生效。 -->
  <link href="${codiconUri}" rel="stylesheet" />
  <link href="${styleUri}" rel="stylesheet" />
  <!-- hljs-themes.css 用 @scope 包裝、specificity 遠高於前兩者,載入順序其實不影響
       結果,排最後只是沿用「一般 → 具體」的慣例。 -->
  <link href="${hljsThemesUri}" rel="stylesheet" />
</head>
<body>
  <div id="app" tabindex="0" data-codewalk-theme="${resolveSnippetTheme()}"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
