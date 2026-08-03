import * as vscode from 'vscode';
import type { ResolvedEditorTheme } from '../shared/protocol';
import {
  findThemeDefinition,
  loadRawTheme,
  normalizeTokenColors,
  themeKindFromUiTheme,
  type ExtensionLike,
} from './themeParsing';

let themeNameCounter = 0;

/**
 * 解析讀者當前 VS Code 主題,轉成可送往 webview 的 ResolvedEditorTheme。
 * 任一環節失敗(讀不到設定、找不到主題定義、讀檔失敗、JSON 解析失敗、
 * include 過深、沒有可用的 tokenColors)一律回傳 null——面板照常運作,
 * 只是配色退回內建的 dark-plus/light-plus(見 design.md 決策 3)。
 *
 * name 每次呼叫都不同(遞增計數器):Shiki 的 loadTheme() 對同名主題重載
 * 是 no-op(已實測),同名會讓「切換主題後重繪」失效。
 *
 * 純解析邏輯(findThemeDefinition/loadRawTheme/normalizeTokenColors/
 * themeKindFromUiTheme)拆在 themeParsing.ts 獨立測試;這裡只負責串接 vscode API,
 * 不寫進單元測試(依專案慣例,見 tasks.md 2.6 的 Extension Development Host 驗證)。
 */
export async function resolveEditorTheme(): Promise<ResolvedEditorTheme | null> {
  try {
    const label = vscode.workspace.getConfiguration('workbench').get<string>('colorTheme');
    if (!label) return null;
    const extensions: ExtensionLike[] = vscode.extensions.all.map((ext) => ({
      extensionPath: ext.extensionPath,
      packageJSON: ext.packageJSON as ExtensionLike['packageJSON'],
    }));
    const found = findThemeDefinition(label, extensions);
    if (!found) return null;
    const raw = await loadRawTheme(found.file);
    const tokenColors = normalizeTokenColors(raw.tokenColors);
    if (!tokenColors) return null;
    return {
      name: `user-theme-${++themeNameCounter}`,
      kind: themeKindFromUiTheme(found.uiTheme),
      tokenColors,
    };
  } catch {
    return null;
  }
}

/** 降級路徑用:讀者編輯器目前是淺色還是深色,決定退回 dark-plus 還是 light-plus。 */
export function currentThemeKind(): 'light' | 'dark' {
  const kind = vscode.window.activeColorTheme.kind;
  return kind === vscode.ColorThemeKind.Light || kind === vscode.ColorThemeKind.HighContrastLight
    ? 'light'
    : 'dark';
}
