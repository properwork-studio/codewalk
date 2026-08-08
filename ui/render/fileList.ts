import { t } from '../../shared/i18n';
import type { AttemptSummary, WalkFileSummary } from '../../shared/protocol';
import { renderMarkdownInline } from '../markdown';
import { formatAbsoluteDateTime, formatRelativeTime } from '../relativeTime';
import { el, icon } from './dom';

/** 進入導讀之前的兩個畫面:可選的導讀列表,以及載入失敗時的錯誤訊息。 */

export interface FileListHandlers {
  onSelect: (path: string) => void;
  onToggleMenu: (path: string) => void;
  onTriggerClear: (path: string) => void;
  onResume: (path: string) => void;
}

/**
 * 跨重啟的接續入口——併入既有的作答紀錄版位,沒有進度時不顯示、不保留
 * 空白版位(reading-progress capability「導讀列表顯示接續入口」,design.md
 * 決策 10)。只顯示圖示+步數(不帶「接續上次」文字),避免跟標題按鈕搶
 * 寬度、把中文標題擠成逐字換行;完整說明改放 title/aria-label。
 */
function renderContinueButton(
  path: string,
  stepIndex: number,
  onResume: (path: string) => void,
): HTMLElement {
  const label = t('fileList.continueLabel', { step: stepIndex + 1 });
  const button = el('button', 'codewalk-continue-button');
  button.appendChild(icon('debug-continue'));
  button.appendChild(el('span', undefined, String(stepIndex + 1)));
  button.title = label;
  button.setAttribute('aria-label', label);
  button.addEventListener('click', () => onResume(path));
  return button;
}

/**
 * 只留一顆通過/未通過的小圖示,分數與時間收進 hover/focus 才顯示的自製
 * tooltip——原本常駐顯示的「3/5 5小時前」文字讓整列右側視覺過重,列表
 * 項目一多就很擁擠(人工回饋)。原生 title 屬性在 webview 裡實測不會顯示,
 * 所以沿用既有的純 CSS tooltip 機制,只是把「一直看得到」改成「需要才看」。
 */
function renderAttemptSummary(attempt: AttemptSummary): HTMLElement {
  const row = el('div', `codewalk-attempt-summary ${attempt.passed ? 'is-passed' : 'is-failed'}`);
  row.tabIndex = 0;
  // 原生 title:webview 內不會顯示(已知限制),留給其他環境(如瀏覽器獨立
  // 開啟)與輔助工具用,不是本體。
  row.title = formatAbsoluteDateTime(attempt.at);
  row.appendChild(icon(attempt.passed ? 'pass' : 'error'));
  const tooltip = el(
    'span',
    'codewalk-attempt-tooltip',
    `${attempt.score}/${attempt.total} · ${formatRelativeTime(attempt.at, Date.now())}`,
  );
  tooltip.setAttribute('role', 'tooltip');
  row.appendChild(tooltip);
  return row;
}

/**
 * 常駐 trash 圖示容易被誤讀成「刪除這份導讀檔案」——改成揭露式選單,展開後
 * 才看到文字明確的「清除 Quiz 紀錄」。選單永遠只有這一個動作,不做成完整
 * ARIA menu widget(方向鍵環狀導覽等),用一般 <button> 天然滿足 Tab 順序
 * 即可(design.md 決策 6)。
 */
function renderAttemptMenu(
  path: string,
  isOpen: boolean,
  isPending: boolean,
  handlers: Pick<FileListHandlers, 'onToggleMenu' | 'onTriggerClear'>,
): HTMLElement {
  const wrapper = el('div', 'codewalk-attempt-menu');

  const trigger = el('button', 'codewalk-attempt-menu-trigger');
  trigger.appendChild(icon('kebab-vertical'));
  trigger.title = t('fileList.moreActions');
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', String(isOpen));
  trigger.addEventListener('click', () => handlers.onToggleMenu(path));
  wrapper.appendChild(trigger);

  if (isOpen) {
    const popover = el('div', 'codewalk-attempt-menu-popover');
    const clearItem = el(
      'button',
      `codewalk-attempt-menu-item${isPending ? ' is-pending' : ''}`,
      isPending ? t('fileList.clearAttemptConfirm') : t('fileList.clearAttempt'),
    );
    clearItem.addEventListener('click', () => handlers.onTriggerClear(path));
    popover.appendChild(clearItem);
    wrapper.appendChild(popover);
  }

  return wrapper;
}

export function renderFileList(
  files: WalkFileSummary[],
  state: { openMenuPath: string | null; pendingClearPath: string | null },
  handlers: FileListHandlers,
): HTMLElement {
  const container = el('div', 'codewalk-file-list');
  container.appendChild(el('h2', undefined, t('fileList.title')));
  if (files.length === 0) {
    container.appendChild(el('p', 'codewalk-empty', t('fileList.empty')));
    return container;
  }
  const list = el('ul');
  for (const file of files) {
    // 展開中的選單用 position:absolute 溢出到下一列的視覺範圍——row 本身若
    // 沒有明確的 z-index,DOM 順序在後的下一列會蓋過它(row 沒有自己的堆疊
    // 層級,絕對定位子元素只能在 row 內部比較 z-index,贏不了「後面的整列」)。
    // 這顆 class 讓目前開著選單的那一列明確拿到較高的堆疊層級。
    const isMenuOpen = state.openMenuPath === file.path;
    const item = el('li', `codewalk-file-item-row${isMenuOpen ? ' has-open-menu' : ''}`);
    item.dataset.walkPath = file.path;

    const button = el('button', 'codewalk-file-item');
    button.appendChild(icon('book'));
    const titleSpan = el('span', 'codewalk-file-item-title');
    // 顯示在 <button> 內部,onOpenLink 傳 null 避免巢狀 <button>(見 renderReference 的說明)。
    titleSpan.appendChild(renderMarkdownInline(file.title, null));
    button.appendChild(titleSpan);
    button.addEventListener('click', () => handlers.onSelect(file.path));
    item.appendChild(button);

    // 順序:通過/未通過狀態 → 接續(可直接點擊觸發,常用動作不藏進選單)
    // → 更多動作選單(分數細節、清除紀錄收在裡面,次要/破壞性操作才需要
    // 多一步)。三者都是無底色純圖示,人工回饋:原本的色塊徽章太搶標題版面。
    if (file.lastAttempt) {
      item.appendChild(renderAttemptSummary(file.lastAttempt));
    }

    if (file.progress) {
      item.appendChild(renderContinueButton(file.path, file.progress.stepIndex, handlers.onResume));
    }

    if (file.lastAttempt) {
      item.appendChild(
        renderAttemptMenu(file.path, state.openMenuPath === file.path, state.pendingClearPath === file.path, {
          onToggleMenu: handlers.onToggleMenu,
          onTriggerClear: handlers.onTriggerClear,
        }),
      );
    }

    list.appendChild(item);
  }
  container.appendChild(list);
  return container;
}

export function renderError(message: string, onBackToList: () => void): HTMLElement {
  const container = el('div', 'codewalk-error');
  const backButton = el('button', 'codewalk-back-to-list');
  backButton.appendChild(icon('list-unordered'));
  backButton.appendChild(el('span', undefined, t('walking.backToList')));
  backButton.addEventListener('click', onBackToList);
  container.appendChild(backButton);
  const errorContainer = el('div', 'codewalk-error-container');
  errorContainer.appendChild(icon('error'));
  errorContainer.appendChild(el('p', undefined, message));
  container.appendChild(errorContainer);
  return container;
}
