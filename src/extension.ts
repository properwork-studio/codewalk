import * as vscode from 'vscode';
import { resolveLocale, setLocale } from '../shared/i18n';
import { WalkPlayerViewProvider } from './viewProvider';

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
  );
}

export function deactivate(): void {}
