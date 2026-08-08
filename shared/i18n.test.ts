import { beforeEach, describe, expect, it } from 'vitest';
import { resolveLocale, setLocale, t } from './i18n';

describe('t', () => {
  beforeEach(() => {
    setLocale('zh-tw');
  });

  it('returns the template unchanged when no params are given', () => {
    expect(t('quiz.title')).toBe('Quiz 自測');
  });

  it('interpolates a single named parameter', () => {
    expect(t('walking.stepDotTitle', { n: 3 })).toBe('第 3 步');
  });

  it('interpolates multiple named parameters', () => {
    expect(t('walking.stepProgress', { current: 2, total: 5 })).toBe('第 2 / 5 步');
  });

  it('leaves the placeholder as-is when a referenced param is missing', () => {
    expect(t('fileList.continueLabel', {})).toBe('接續上次(第 {step} 步)');
  });

  it('switches output when locale changes', () => {
    setLocale('en');
    expect(t('quiz.title')).toBe('Quiz');
  });
});

describe('t without an explicit setLocale call', () => {
  it('defaults to English', () => {
    // 刻意不呼叫 setLocale——模擬 host/webview 忘記初始化的情境
    // (design.md Risks:「setLocale() 沒被呼叫或呼叫太晚」)。這個測試
    // 依賴模組載入時的初始狀態,必須是本檔第一個執行的斷言。
    expect(t('quiz.title')).toBe('Quiz');
  });
});

describe('resolveLocale', () => {
  it('resolves plain zh to Traditional Chinese', () => {
    expect(resolveLocale('zh')).toBe('zh-tw');
  });

  it('resolves zh-tw to Traditional Chinese', () => {
    expect(resolveLocale('zh-tw')).toBe('zh-tw');
  });

  it('resolves the zh-Hant HTML lang tag to Traditional Chinese', () => {
    expect(resolveLocale('zh-Hant')).toBe('zh-tw');
  });

  it('resolves Simplified Chinese to Traditional Chinese', () => {
    expect(resolveLocale('zh-cn')).toBe('zh-tw');
  });

  it('resolves English to English', () => {
    expect(resolveLocale('en')).toBe('en');
  });

  it('falls back to English for an unsupported language', () => {
    expect(resolveLocale('ja')).toBe('en');
  });

  it('falls back to English when the language is undefined', () => {
    expect(resolveLocale(undefined)).toBe('en');
  });
});
