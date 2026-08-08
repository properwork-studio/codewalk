import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { ThemeTokenColorRule } from '../shared/protocol';
import { parseJsonc } from './jsonc';

const MAX_INCLUDE_DEPTH = 5;

export interface RawThemeFile {
  include?: string;
  tokenColors?: unknown;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function toTokenColorArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * 主題檔的 `include` 繼承合併:被繼承檔(base)的 tokenColors 排在前面,
 * 目前層(override)的排後面且優先權更高——與 VS Code 疊加 tokenColors
 * 規則的方式一致(後面的規則覆蓋前面同 scope 的設定)。
 */
export function mergeIncludedTheme(base: RawThemeFile, override: RawThemeFile): RawThemeFile {
  return {
    ...base,
    ...override,
    tokenColors: [...toTokenColorArray(base.tokenColors), ...toTokenColorArray(override.tokenColors)],
  };
}

/**
 * 讀取並解析單一主題檔,遞迴解析 `include` 繼承。深度超過上限視為循環或
 * 過深繼承鏈,直接拋出——呼叫端(resolveEditorTheme)會整體降級,不讓走讀中斷。
 */
export async function loadRawTheme(filePath: string, depth = 0): Promise<RawThemeFile> {
  if (depth > MAX_INCLUDE_DEPTH) {
    // 這個錯誤在 themeSource.ts 被 catch 後靜默降級,永遠不會顯示給讀者
    // (syntax-highlighting capability「主題定義檔無法解析」)——不是介面文案,
    // 固定英文純粹是內部診斷的一致性,不經 t()。
    throw new Error(`Theme include depth exceeded ${MAX_INCLUDE_DEPTH} levels (possible cycle): ${filePath}`);
  }
  const text = await readFile(filePath, 'utf8');
  const raw = parseJsonc(text) as RawThemeFile;
  if (!raw.include) return raw;
  const base = await loadRawTheme(resolve(dirname(filePath), raw.include), depth + 1);
  return mergeIncludedTheme(base, raw);
}

/**
 * 只保留有實際上色資訊(foreground 或 fontStyle 其一)且 scope 格式合法的規則;
 * 全部濾除後回傳 null,視同「這份主題無法用來上色」,由呼叫端降級。
 */
export function normalizeTokenColors(raw: unknown): ThemeTokenColorRule[] | null {
  if (!Array.isArray(raw)) return null;
  const rules: ThemeTokenColorRule[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const scope = e.scope;
    if (typeof scope !== 'string' && !isStringArray(scope)) continue;
    const settings = e.settings;
    if (typeof settings !== 'object' || settings === null) continue;
    const s = settings as Record<string, unknown>;
    const foreground = typeof s.foreground === 'string' ? s.foreground : undefined;
    const fontStyle = typeof s.fontStyle === 'string' ? s.fontStyle : undefined;
    if (foreground === undefined && fontStyle === undefined) continue;
    rules.push({ scope, settings: { foreground, fontStyle } });
  }
  return rules.length > 0 ? rules : null;
}

export function themeKindFromUiTheme(uiTheme: string): 'light' | 'dark' {
  return uiTheme === 'vs' || uiTheme === 'hc-light' ? 'light' : 'dark';
}

export interface ExtensionThemeContribution {
  label?: unknown;
  id?: unknown;
  path?: unknown;
  uiTheme?: unknown;
}

export interface ExtensionLike {
  extensionPath: string;
  packageJSON: { contributes?: { themes?: ExtensionThemeContribution[] } };
}

/**
 * 反查目前主題設定值(label 或 id)對應的主題定義檔路徑與 uiTheme。掃過所有
 * extension(含 VS Code 內建主題,它們同樣以 extension 形式註冊)的
 * `contributes.themes`——找不到就回傳 null,由呼叫端降級。
 */
export function findThemeDefinition(
  label: string,
  extensions: readonly ExtensionLike[],
): { file: string; uiTheme: string } | null {
  for (const ext of extensions) {
    const themes = ext.packageJSON?.contributes?.themes;
    if (!Array.isArray(themes)) continue;
    for (const t of themes) {
      if ((t.label === label || t.id === label) && typeof t.path === 'string') {
        return {
          file: join(ext.extensionPath, t.path),
          uiTheme: typeof t.uiTheme === 'string' ? t.uiTheme : 'vs-dark',
        };
      }
    }
  }
  return null;
}
