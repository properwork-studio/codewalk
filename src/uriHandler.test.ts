import { describe, expect, it, vi } from 'vitest';
import { createUriHandler, parseOpenUri } from './uriHandler';

describe('parseOpenUri', () => {
  it('解析不含 step 的 URI', () => {
    expect(parseOpenUri({ path: '/open', query: 'walk=.codewalk/tour.codewalk.json' })).toEqual({
      walk: '.codewalk/tour.codewalk.json',
    });
  });

  it('解析帶 step 的 URI(0-based)', () => {
    expect(parseOpenUri({ path: '/open', query: 'walk=.codewalk/tour.codewalk.json&step=6' })).toEqual({
      walk: '.codewalk/tour.codewalk.json',
      stepIndex: 6,
    });
  });

  it('step=0 視為有效索引,不是「未提供」', () => {
    expect(parseOpenUri({ path: '/open', query: 'walk=tour.codewalk.json&step=0' })).toEqual({
      walk: 'tour.codewalk.json',
      stepIndex: 0,
    });
  });

  it('path 不是 /open 時回傳 null', () => {
    expect(parseOpenUri({ path: '/other', query: 'walk=tour.codewalk.json' })).toBeNull();
  });

  it('缺少 walk 參數時回傳 null', () => {
    expect(parseOpenUri({ path: '/open', query: 'step=1' })).toBeNull();
  });

  it('step 不是合法非負整數時,忽略 step、仍視為有效的開啟請求', () => {
    expect(parseOpenUri({ path: '/open', query: 'walk=tour.codewalk.json&step=abc' })).toEqual({
      walk: 'tour.codewalk.json',
    });
    expect(parseOpenUri({ path: '/open', query: 'walk=tour.codewalk.json&step=-1' })).toEqual({
      walk: 'tour.codewalk.json',
    });
  });
});

describe('createUriHandler', () => {
  it('解析成功時呼叫 provider.openWalkFromUri', () => {
    const openWalkFromUri = vi.fn();
    const handler = createUriHandler({ openWalkFromUri } as unknown as Parameters<
      typeof createUriHandler
    >[0]);

    handler.handleUri({ path: '/open', query: 'walk=tour.codewalk.json&step=2' });

    expect(openWalkFromUri).toHaveBeenCalledWith('tour.codewalk.json', 2);
  });

  it('解析失敗時不呼叫 provider.openWalkFromUri', () => {
    const openWalkFromUri = vi.fn();
    const handler = createUriHandler({ openWalkFromUri } as unknown as Parameters<
      typeof createUriHandler
    >[0]);

    handler.handleUri({ path: '/other', query: '' });

    expect(openWalkFromUri).not.toHaveBeenCalled();
  });
});
