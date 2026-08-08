// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../shared/i18n';
import { renderError, renderFileList } from './fileList';

const noopHandlers = {
  onSelect: () => {},
  onToggleMenu: () => {},
  onTriggerClear: () => {},
  onResume: () => {},
};

describe('renderFileList locale', () => {
  it('renders in English when setLocale has not been called', () => {
    // 刻意不呼叫 setLocale——驗證 shared/i18n.ts 的預設值本身就是英文,
    // 不是漂亮的巧合(design.md Risks:「setLocale() 沒被呼叫或呼叫太晚」)。
    const container = renderFileList([], { openMenuPath: null, pendingClearPath: null }, noopHandlers);
    expect(container.textContent).toContain('No walks found');
  });

  it('renders in Traditional Chinese after setLocale("zh-tw")', () => {
    setLocale('zh-tw');
    const container = renderFileList([], { openMenuPath: null, pendingClearPath: null }, noopHandlers);
    expect(container.textContent).toContain('找不到導讀檔案');
  });

  it('renders in English after setLocale("en")', () => {
    setLocale('en');
    const container = renderFileList([], { openMenuPath: null, pendingClearPath: null }, noopHandlers);
    expect(container.textContent).toContain('No walks found');
  });
});

describe('renderError', () => {
  it('provides a way back to the list — a reader who hits a load error is not stuck on this screen', () => {
    setLocale('en');
    const onBackToList = vi.fn();
    const container = renderError('File not found', onBackToList);
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    button?.click();
    expect(onBackToList).toHaveBeenCalledOnce();
  });

  it('labels the back button per the current locale', () => {
    setLocale('zh-tw');
    const container = renderError('找不到檔案', () => {});
    expect(container.querySelector('button')?.textContent).toBe('返回列表');
  });
});
