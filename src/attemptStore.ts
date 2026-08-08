import { relative } from 'node:path';
import type { AttemptSummary } from '../shared/protocol';
import type { QuizScore } from '../shared/schema';

const STORAGE_KEY = 'codewalk.quizAttempts';

interface AttemptRecord {
  ref: string;
  at: number;
  score: number;
  total: number;
  passed: boolean;
}

type AttemptMap = Record<string, AttemptRecord>;

/**
 * VS Code 的 vscode.Memento 形狀子集——只取用得到的兩個方法,讓測試可以餵
 * 一個不依賴 vscode runtime 的假物件進來。
 */
export interface AttemptMemento {
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: unknown): Thenable<void> | Promise<void>;
}

/**
 * Quiz 作答紀錄的持久化。存在 workspaceState,單一 key 底下以導讀的相對路徑
 * 為索引,每份導讀只保留最後一次作答。
 *
 * @remarks
 * 用相對路徑當索引,讓同一個專案換機器或換目錄後紀錄仍對得上。`workspaceRoot`
 * 由呼叫端每次傳入而非存在建構子,沿用 host 端的既有慣例——workspace root 一律
 * 用時查詢、不快取(design.md 決策 1、2、3)。
 */
export class AttemptStore {
  constructor(private readonly memento: AttemptMemento) {}

  private toRelativePath(workspaceRoot: string, absolutePath: string): string {
    return relative(workspaceRoot, absolutePath);
  }

  private readAll(): AttemptMap {
    return this.memento.get(STORAGE_KEY, {});
  }

  /**
   * 記下一次作答結果,覆蓋該導讀先前的紀錄。
   *
   * @param ref - 作答當下導讀的 ref;之後 {@link get} 會用它判斷紀錄是否仍適用
   * @param at - 作答完成時間(Unix 毫秒),由呼叫端傳入以便測試固定時間
   */
  async record(
    workspaceRoot: string,
    absolutePath: string,
    ref: string,
    at: number,
    score: QuizScore,
  ): Promise<void> {
    const all = this.readAll();
    all[this.toRelativePath(workspaceRoot, absolutePath)] = {
      ref,
      at,
      score: score.score,
      total: score.total,
      passed: score.passed,
    };
    await this.memento.update(STORAGE_KEY, all);
  }

  /**
   * 取得該導讀的最後一次作答紀錄。
   *
   * @returns 沒有紀錄、或紀錄的 ref 與現行導讀不符(導讀已重新產生)時回傳
   * undefined——對著新內容顯示舊分數會誤導讀者
   */
  get(workspaceRoot: string, absolutePath: string, ref: string): AttemptSummary | undefined {
    const record = this.readAll()[this.toRelativePath(workspaceRoot, absolutePath)];
    if (!record || record.ref !== ref) {
      return undefined;
    }
    return { at: record.at, score: record.score, total: record.total, passed: record.passed };
  }

  /** 刪除該導讀的作答紀錄(讀者從列表選單手動清除)。沒有紀錄時是無操作。 */
  async clear(workspaceRoot: string, absolutePath: string): Promise<void> {
    const all = this.readAll();
    delete all[this.toRelativePath(workspaceRoot, absolutePath)];
    await this.memento.update(STORAGE_KEY, all);
  }
}
