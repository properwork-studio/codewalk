import * as vscode from 'vscode';
import { resolveLocale, setLocale } from '../shared/i18n';
import { startMcpServer, stopMcpServer } from './mcpServer';
import { createUriHandler } from './uriHandler';
import { WalkPlayerViewProvider } from './viewProvider';

/**
 * Extension 進入點,由 VS Code 依 package.json 的 `activationEvents` 呼叫。
 * 註冊側邊面板的 view provider、四個指令與 URI handler,全部掛進
 * `context.subscriptions` 交給 VS Code 在停用時一併釋放。
 *
 * @remarks
 * `activationEvents` 是空陣列,VS Code 會從 `contributes`(views、commands)
 * 推論隱含的啟動事件——但 URI handler 是在這裡動態註冊的,`contributes` 沒有
 * 對應的宣告可以推論,所以 `package.json` 明確列了 `"onUri"`。少了它,extension
 * 這個 session 還沒被別的途徑(如手動開過面板)啟動過時,第一次觸發的
 * `vscode://` URI 會無處可去(design.md 決策 10,手動驗證發現)。
 */
export function activate(context: vscode.ExtensionContext): void {
  // 必須早於 WalkPlayerViewProvider 的建構——getHtml() 會用到判定結果
  // (design.md 決策 5)。
  setLocale(resolveLocale(vscode.env.language));
  const provider = new WalkPlayerViewProvider(context);

  context.subscriptions.push(
    // retainContextWhenHidden:面板隱藏(切到其他側邊面板)時不重建 webview,
    // 讀者切走再切回來能維持原本讀到哪、捲動位置與展開中的術語(reading-progress
    // capability「面板重建後還原閱讀位置」,design.md 決策 1 第 1 層)。
    vscode.window.registerWebviewViewProvider(WalkPlayerViewProvider.viewId, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand('codewalk.openWalk', () => {
      void vscode.commands.executeCommand(`${WalkPlayerViewProvider.viewId}.focus`);
    }),
    vscode.commands.registerCommand('codewalk.nextStep', () => provider.handleNextStep()),
    vscode.commands.registerCommand('codewalk.prevStep', () => provider.handlePrevStep()),
    vscode.commands.registerCommand('codewalk.revealCurrentStep', () => provider.handleRevealCurrentStep()),
    vscode.window.registerUriHandler(createUriHandler(provider)),
  );

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceRoot) {
    // fire-and-forget:MCP 是加分不是前提,啟動失敗不該擋住其他既有功能
    // (design.md 決策 1、9)。沒有 workspace 的視窗完全不啟動,見決策 1。
    void startMcpServer(provider, workspaceRoot).catch(() => {});
  }
}

/**
 * 停用時的清理鉤子。MCP server 的探索檔活在 `os.tmpdir()`,不是 VS Code 會
 * 自動回收的資源(`context.subscriptions` 只管得到 extension 自己註冊的
 * disposable),需要真正的清理邏輯(design.md 決策 9)。
 */
export function deactivate(): Promise<void> {
  return stopMcpServer();
}
