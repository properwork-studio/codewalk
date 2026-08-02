import { describe, expect, it } from 'vitest';
import { formatAbsoluteDateTime, formatRelativeTime } from './relativeTime';

function localTime(y: number, m: number, d: number, h = 0, min = 0): number {
  return new Date(y, m - 1, d, h, min).getTime();
}

describe('formatRelativeTime', () => {
  it('shows 剛剛 within the first minute', () => {
    const now = localTime(2026, 8, 1, 12, 0);
    expect(formatRelativeTime(now - 30_000, now)).toBe('剛剛');
  });

  it('shows N 分鐘前 within the first hour', () => {
    const now = localTime(2026, 8, 1, 12, 0);
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5 分鐘前');
  });

  it('shows N 小時前 within the first day', () => {
    const now = localTime(2026, 8, 1, 12, 0);
    expect(formatRelativeTime(now - 3 * 60 * 60_000, now)).toBe('3 小時前');
  });

  it('prefers hour granularity over 昨天 when under 24 hours, even across a calendar day boundary', () => {
    const now = localTime(2026, 8, 1, 8, 0);
    const at = localTime(2026, 7, 31, 23, 0);
    expect(formatRelativeTime(at, now)).toBe('9 小時前');
  });

  it('shows 昨天 once elapsed passes 24 hours and calendar day diff is 1', () => {
    const now = localTime(2026, 8, 1, 12, 0);
    const at = localTime(2026, 7, 31, 10, 0);
    expect(formatRelativeTime(at, now)).toBe('昨天');
  });

  it('shows N 天前 for a 2-30 day calendar diff', () => {
    const now = localTime(2026, 8, 10, 12, 0);
    const at = localTime(2026, 8, 5, 12, 0);
    expect(formatRelativeTime(at, now)).toBe('5 天前');
  });

  it('still shows N 天前 at exactly 30 days', () => {
    const now = localTime(2026, 9, 1, 12, 0);
    const at = localTime(2026, 8, 2, 12, 0);
    expect(formatRelativeTime(at, now)).toBe('30 天前');
  });

  it('falls back to an absolute date beyond 30 days', () => {
    const now = localTime(2026, 9, 20, 12, 0);
    const at = localTime(2026, 8, 1, 9, 30);
    expect(formatRelativeTime(at, now)).toBe('2026-08-01');
  });
});

describe('formatAbsoluteDateTime', () => {
  it('formats a full timestamp for hover display', () => {
    expect(formatAbsoluteDateTime(localTime(2026, 8, 1, 9, 5))).toBe('2026-08-01 09:05');
  });
});
