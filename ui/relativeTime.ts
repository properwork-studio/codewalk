import { t } from '../shared/i18n';

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

/**
 * 格式化為 `YYYY-MM-DD`。
 *
 * @remarks
 * 絕對日期刻意不隨介面語言變動——ISO 8601 是格式而非語言,且沒有 MM/DD 與 DD/MM
 * 的歧義風險(design.md 決策 9,walk-player capability「作答時間的相對顯示」
 * MODIFIED requirement)。
 */
export function formatAbsoluteDate(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 格式化為 `YYYY-MM-DD HH:mm`,用於 hover 才顯示的完整時間。同樣不隨語言變動。 */
export function formatAbsoluteDateTime(at: number): string {
  const d = new Date(at);
  return `${formatAbsoluteDate(at)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 分鐘/小時級距以經過毫秒數判斷,天級距以日曆日相差判斷——兩套判準的交界在
 * 未滿 24 小時處,毫秒判準優先(見 design.md 決策 7):「昨天 23:50 做的,
 * 現在早上 8 點」只經過 9 小時,顯示「9 小時前」而不是「昨天」。
 *
 * 英文的分鐘/小時級距需要正確單複數(design.md 決策 8)——繁體中文的
 * `*Ago`/`*sAgo` 兩個 key 內容刻意相同,因為兩份翻譯表的 key 集合必須一致。
 */
export function formatRelativeTime(at: number, now: number): string {
  const elapsed = now - at;
  if (elapsed < MINUTE) return t('time.justNow');
  if (elapsed < HOUR) {
    const n = Math.floor(elapsed / MINUTE);
    return t(n === 1 ? 'time.minuteAgo' : 'time.minutesAgo', { n });
  }
  if (elapsed < DAY) {
    const n = Math.floor(elapsed / HOUR);
    return t(n === 1 ? 'time.hourAgo' : 'time.hoursAgo', { n });
  }

  const dayDiff = calendarDayDiff(at, now);
  if (dayDiff <= 1) return t('time.yesterday');
  if (dayDiff <= 30) return t('time.daysAgo', { n: dayDiff });
  return formatAbsoluteDate(at);
}
