const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function calendarDayDiff(at: number, now: number): number {
  const a = new Date(at);
  const n = new Date(now);
  const atMidnight = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const nowMidnight = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  return Math.round((nowMidnight - atMidnight) / DAY);
}

export function formatAbsoluteDate(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatAbsoluteDateTime(at: number): string {
  const d = new Date(at);
  return `${formatAbsoluteDate(at)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 分鐘/小時級距以經過毫秒數判斷,天級距以日曆日相差判斷——兩套判準的交界在
 * 未滿 24 小時處,毫秒判準優先(見 design.md 決策 7):「昨天 23:50 做的,
 * 現在早上 8 點」只經過 9 小時,顯示「9 小時前」而不是「昨天」。
 */
export function formatRelativeTime(at: number, now: number): string {
  const elapsed = now - at;
  if (elapsed < MINUTE) return '剛剛';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} 分鐘前`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} 小時前`;

  const dayDiff = calendarDayDiff(at, now);
  if (dayDiff <= 1) return '昨天';
  if (dayDiff <= 30) return `${dayDiff} 天前`;
  return formatAbsoluteDate(at);
}
