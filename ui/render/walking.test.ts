// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../shared/i18n';
import type { AnchorReport } from '../../shared/protocol';
import type { CodewalkFile } from '../../shared/schema';
import { createWalkingState } from '../state';
import { renderWalking, type WalkingHandlers } from './walking';

function walkWith(): CodewalkFile {
  return {
    title: '範例導讀',
    ref: 'a1b2c3d4',
    steps: [
      {
        title: '第一步',
        file: 'src/example.ts',
        startLine: 1,
        endLine: 3,
        narration: '說明文字',
      },
    ],
    quiz: [{ question: 'q', options: ['a', 'b'], correctIndex: 0 }],
  };
}

function emptyReport(): AnchorReport {
  return {
    anyAnchored: false,
    anyStale: false,
    staleCount: 0,
    steps: [{ step: { kind: 'unanchored' }, items: [] }],
  };
}

const noopHandlers: WalkingHandlers = {
  onNext: () => {},
  onPrev: () => {},
  onToggleTerm: () => {},
  onEnterQuiz: () => {},
  onOpenReference: () => {},
  onJumpToSnippet: () => {},
  onBackToList: () => {},
  onOpenStaleFile: () => {},
  onCopyRegenerateHint: () => {},
  onRevealCurrentStep: () => {},
  onAskAgent: () => {},
};

describe('renderWalking — ask-agent 入口', () => {
  it('常駐入口一律渲染,不受框選狀態影響(renderWalking 本身不知道有沒有框選)', () => {
    setLocale('zh-tw');
    const state = createWalkingState(walkWith(), false, emptyReport());
    const container = renderWalking(state, noopHandlers);
    expect(container.querySelector('.codewalk-ask-agent-chat')).not.toBeNull();
    expect(container.querySelector('.codewalk-ask-agent-copy')).not.toBeNull();
  });

  it('點「送進 Chat」呼叫 onAskAgent("chat")', () => {
    setLocale('zh-tw');
    const onAskAgent = vi.fn();
    const state = createWalkingState(walkWith(), false, emptyReport());
    const container = renderWalking(state, { ...noopHandlers, onAskAgent });
    container.querySelector<HTMLButtonElement>('.codewalk-ask-agent-chat')?.click();
    expect(onAskAgent).toHaveBeenCalledWith('chat');
  });

  it('點「複製提問」呼叫 onAskAgent("clipboard")', () => {
    setLocale('zh-tw');
    const onAskAgent = vi.fn();
    const state = createWalkingState(walkWith(), false, emptyReport());
    const container = renderWalking(state, { ...noopHandlers, onAskAgent });
    container.querySelector<HTMLButtonElement>('.codewalk-ask-agent-copy')?.click();
    expect(onAskAgent).toHaveBeenCalledWith('clipboard');
  });

  it('feedback 為 "copied" 時,複製按鈕文字暫時變成「已複製」', () => {
    setLocale('zh-tw');
    const state = createWalkingState(walkWith(), false, emptyReport());
    const container = renderWalking(state, noopHandlers, null, true, [], 'copied');
    expect(container.querySelector('.codewalk-ask-agent-copy')?.textContent).toContain('已複製');
  });

  it('沒有 feedback 時,複製按鈕維持原本文字', () => {
    setLocale('zh-tw');
    const state = createWalkingState(walkWith(), false, emptyReport());
    const container = renderWalking(state, noopHandlers);
    expect(container.querySelector('.codewalk-ask-agent-copy')?.textContent).toContain('複製提問');
  });

  it('feedback 為 "chatUnavailable" 時顯示告知,不是靜默失敗', () => {
    setLocale('zh-tw');
    const state = createWalkingState(walkWith(), false, emptyReport());
    const container = renderWalking(state, noopHandlers, null, true, [], 'chatUnavailable');
    expect(container.textContent).toContain('沒有可用的 Chat');
  });

  it('feedback 為 "failed" 時顯示錯誤提示', () => {
    setLocale('zh-tw');
    const state = createWalkingState(walkWith(), false, emptyReport());
    const container = renderWalking(state, noopHandlers, null, true, [], 'failed');
    expect(container.textContent).toContain('複製失敗');
  });

  it('feedback 為 null 時不顯示任何 ask-agent 警示', () => {
    setLocale('zh-tw');
    const state = createWalkingState(walkWith(), false, emptyReport());
    const container = renderWalking(state, noopHandlers);
    expect(container.textContent).not.toContain('複製失敗');
    expect(container.textContent).not.toContain('沒有可用的 Chat');
  });
});
