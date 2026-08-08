import { relative } from 'node:path';
import type { WalkProgressSummary } from '../shared/protocol';
import type { AttemptMemento } from './attemptStore';

const STORAGE_KEY = 'codewalk.readingProgress';

interface ProgressRecord {
  ref: string;
  stepIndex: number;
}

type ProgressMap = Record<string, ProgressRecord>;

/**
 * 閱讀進度的持久化,讓讀者關掉編輯器後仍能從上次的步驟接續。存在 workspaceState,
 * 單一 key 底下以導讀的相對路徑為索引。
 *
 * @remarks
 * 與 `AttemptStore`(attemptStore.ts)結構相同但刻意各自留存,因為兩者生命週期
 * 不同:進度會在讀者作答完 quiz 時清除,作答紀錄則留著(design.md 決策 2、3)。
 */
export class ProgressStore {
  constructor(private readonly memento: AttemptMemento) {}

  private toRelativePath(workspaceRoot: string, absolutePath: string): string {
    return relative(workspaceRoot, absolutePath);
  }

  private readAll(): ProgressMap {
    return this.memento.get(STORAGE_KEY, {});
  }

  /** 記下讀者目前所在的步驟,覆蓋該導讀先前的進度。每次切換步驟都會呼叫。 */
  async record(workspaceRoot: string, absolutePath: string, ref: string, stepIndex: number): Promise<void> {
    const all = this.readAll();
    all[this.toRelativePath(workspaceRoot, absolutePath)] = { ref, stepIndex };
    await this.memento.update(STORAGE_KEY, all);
  }

  /**
   * 取得該導讀留存的閱讀進度,用於列表上的「接續上次」入口。
   *
   * @returns 沒有進度、或進度的 ref 與現行導讀不符(導讀已重新產生)時回傳
   * undefined——舊的步驟編號對新內容可能指到完全不同的地方
   */
  get(workspaceRoot: string, absolutePath: string, ref: string): WalkProgressSummary | undefined {
    const record = this.readAll()[this.toRelativePath(workspaceRoot, absolutePath)];
    if (!record || record.ref !== ref) {
      return undefined;
    }
    return { stepIndex: record.stepIndex };
  }

  /** 刪除該導讀的進度。在讀者作答完 quiz(視同走完這一輪)時呼叫。 */
  async clear(workspaceRoot: string, absolutePath: string): Promise<void> {
    const all = this.readAll();
    delete all[this.toRelativePath(workspaceRoot, absolutePath)];
    await this.memento.update(STORAGE_KEY, all);
  }
}
