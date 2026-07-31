import * as vscode from 'vscode';
import { parseWebviewToHostMessage, type HostToWebviewMessage } from '../shared/protocol';
import type { CodewalkFile } from '../shared/schema';
import { jumpToStep } from './fileJump';
import { getWorkspaceHead, isRefDrifted } from './refDrift';
import { listWalkFiles, loadCodewalkFile } from './walkLoader';

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
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
    this.post({ type: 'stepChanged', stepIndex: this.stepIndex });
    await this.jumpToCurrentStep();
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
</head>
<body>
  <div id="app" tabindex="0"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
