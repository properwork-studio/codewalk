import * as vscode from 'vscode';
import { WalkPlayerViewProvider } from './viewProvider';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new WalkPlayerViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(WalkPlayerViewProvider.viewId, provider),
    vscode.commands.registerCommand('codewalk.openWalk', () => {
      void vscode.commands.executeCommand(`${WalkPlayerViewProvider.viewId}.focus`);
    }),
    vscode.commands.registerCommand('codewalk.nextStep', () => provider.handleNextStep()),
    vscode.commands.registerCommand('codewalk.prevStep', () => provider.handlePrevStep()),
  );
}

export function deactivate(): void {}
