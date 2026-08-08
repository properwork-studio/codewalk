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
 * 解析讀者當前的 VS Code 主題,轉成可送往 webview 的 {@link ResolvedEditorTheme},
 * 讓面板裡的程式碼上色跟編輯器一致。
 *
 * @returns 任一環節失敗(讀不到設定、找不到主題定義、讀檔或 JSON 解析失敗、
 * include 過深、沒有可用的 tokenColors)一律回傳 null。這不是錯誤路徑——面板照常
 * 運作,只是配色退回 Shiki 內建的 dark-plus/light-plus(design.md 決策 3)
 *
 * @remarks
 * 回傳的 `name` 每次呼叫都不同(遞增計數器)。Shiki 的 `loadTheme()` 對同名主題
 * 重載是無操作(已實測),沿用同名會讓「切換主題後重繪」整個失效。
 *
 * 純解析邏輯拆在 `themeParsing.ts` 獨立測試;這裡只負責串接 vscode API,依專案
 * 慣例不寫單元測試,改走 Extension Development Host 的手動驗證。
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
