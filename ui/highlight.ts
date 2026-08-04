import { createHighlighterCore, type HighlighterCore, type ThemeRegistrationAny } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import bash from '@shikijs/langs/bash';
import c from '@shikijs/langs/c';
import cpp from '@shikijs/langs/cpp';
import csharp from '@shikijs/langs/csharp';
import css from '@shikijs/langs/css';
import dart from '@shikijs/langs/dart';
import go from '@shikijs/langs/go';
import groovy from '@shikijs/langs/groovy';
import html from '@shikijs/langs/html';
import java from '@shikijs/langs/java';
import javascript from '@shikijs/langs/javascript';
import json from '@shikijs/langs/json';
import kotlin from '@shikijs/langs/kotlin';
import markdown from '@shikijs/langs/markdown';
import php from '@shikijs/langs/php';
import python from '@shikijs/langs/python';
import ruby from '@shikijs/langs/ruby';
import rust from '@shikijs/langs/rust';
import scala from '@shikijs/langs/scala';
import sql from '@shikijs/langs/sql';
import swift from '@shikijs/langs/swift';
import typescript from '@shikijs/langs/typescript';
import yaml from '@shikijs/langs/yaml';
import darkPlus from '@shikijs/themes/dark-plus';
import lightPlus from '@shikijs/themes/light-plus';
import type { ResolvedEditorTheme } from '../shared/protocol';

// JS 引擎(非 oniguruma WASM)不支援部分 oniguruma 特有 regex 語法,選用前已對
// 這 23 種 grammar 逐一比對兩引擎的 token 輸出(見 openspec/changes/
// switch-to-shiki-highlighter/design.md 決策 1 與 scripts/compare-shiki-engines.mjs),
// 差異為 0——新增語言時應重跑該腳本再決定引擎是否仍夠用。
const LANGS = [
  bash,
  c,
  cpp,
  csharp,
  css,
  dart,
  go,
  groovy,
  html,
  java,
  javascript,
  json,
  kotlin,
  markdown,
  php,
  python,
  ruby,
  rust,
  scala,
  sql,
  swift,
  typescript,
  yaml,
];

const DARK_FALLBACK_THEME = 'dark-plus';
const LIGHT_FALLBACK_THEME = 'light-plus';

let highlighter: HighlighterCore | null = null;
let activeThemeName: string = DARK_FALLBACK_THEME;

const ready: Promise<void> = createHighlighterCore({
  langs: LANGS,
  themes: [darkPlus, lightPlus],
  engine: createJavaScriptRegexEngine(),
}).then((instance) => {
  highlighter = instance;
});

export function isHighlightReady(): boolean {
  return highlighter !== null;
}

/** 高亮就緒(引擎載入完成)後呼叫 callback 一次;若已就緒則立即呼叫。 */
export function onHighlightReady(callback: () => void): void {
  void ready.then(callback);
}

function themeToShikiRegistration(theme: ResolvedEditorTheme): ThemeRegistrationAny {
  return { name: theme.name, type: theme.kind, tokenColors: theme.tokenColors };
}

/**
 * 套用讀者當前的編輯器主題;host 解析失敗時傳入 null,改依編輯器明暗
 * (kind)選用 Shiki 內建的 dark-plus/light-plus——見 design.md 決策 3 的降級鏈。
 * 每次呼叫的 theme.name 皆不同(host 端遞增產生),因為 Shiki 的 loadTheme()
 * 對同名主題重載是無操作(no-op,已實測),要讓「切換主題後重繪」生效,
 * 只能用新名稱註冊,不能覆蓋舊名稱。
 */
export async function applyEditorTheme(
  theme: ResolvedEditorTheme | null,
  kind: 'light' | 'dark',
): Promise<void> {
  await ready;
  if (!highlighter) return;
  if (theme) {
    await highlighter.loadTheme(themeToShikiRegistration(theme));
    activeThemeName = theme.name;
  } else {
    activeThemeName = kind === 'light' ? LIGHT_FALLBACK_THEME : DARK_FALLBACK_THEME;
  }
}

/**
 * 高亮引擎就緒後,某語言是否有註冊 grammar。供測試把 `shared/language.ts` 的
 * 副檔名對應表與這裡的語言註冊清單綁在一起——漏一邊,snippet 會安靜地退回
 * 純文字而不報錯。
 */
export function isLanguageSupported(language: string): boolean {
  return highlighter !== null && highlighter.getLoadedLanguages().includes(language);
}

export interface HighlightToken {
  content: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
}

// fontStyle 是 vscode-textmate 慣例的位元遮罩,Shiki 的 ThemedToken.fontStyle 直接沿用:
// 1 = italic、2 = bold、4 = underline。CodeWalk 目前只呈現斜體與粗體。
const FONT_STYLE_ITALIC = 1;
const FONT_STYLE_BOLD = 2;

function toHighlightToken(token: { content: string; color?: string; fontStyle?: number }): HighlightToken {
  const fontStyle = token.fontStyle ?? 0;
  return {
    content: token.content,
    color: token.color,
    italic: (fontStyle & FONT_STYLE_ITALIC) !== 0,
    bold: (fontStyle & FONT_STYLE_BOLD) !== 0,
  };
}

/**
 * 未支援語言、或高亮引擎尚未就緒時,回傳一整行純文字 token(不上色)——
 * 猜錯顏色比不上色更容易誤導讀者,見 syntax-highlighting spec 的語言判定 requirement。
 */
function plainTextLines(content: string): HighlightToken[][] {
  return content.split('\n').map((line) => [{ content: line }]);
}

export function highlightSnippetLines(content: string, language: string): HighlightToken[][] {
  if (!highlighter || !isLanguageSupported(language)) {
    return plainTextLines(content);
  }
  const { tokens } = highlighter.codeToTokens(content, { lang: language, theme: activeThemeName });
  return tokens.map((line) => line.map(toHighlightToken));
}
