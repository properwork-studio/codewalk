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
 * 讀者作答紀錄的持久化——存在 workspaceState,單一 key 底下以導讀相對路徑
 * 為索引,每份導讀只留最後一次(見 design.md 決策 1、2、3)。
 *
 * workspaceRoot 由呼叫端每次傳入(而非存在建構子),沿用本檔案其餘 host
 * 程式碼的既有慣例——workspace root 一律用時查詢,不快取。
 */
export class AttemptStore {
  constructor(private readonly memento: AttemptMemento) {}

  private toRelativePath(workspaceRoot: string, absolutePath: string): string {
    return relative(workspaceRoot, absolutePath);
  }

  private readAll(): AttemptMap {
    return this.memento.get(STORAGE_KEY, {});
  }

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

  /** ref 不符(導讀已重新產生)時視同沒有紀錄。 */
  get(workspaceRoot: string, absolutePath: string, ref: string): AttemptSummary | undefined {
    const record = this.readAll()[this.toRelativePath(workspaceRoot, absolutePath)];
    if (!record || record.ref !== ref) {
      return undefined;
    }
    return { at: record.at, score: record.score, total: record.total, passed: record.passed };
  }

  async clear(workspaceRoot: string, absolutePath: string): Promise<void> {
    const all = this.readAll();
    delete all[this.toRelativePath(workspaceRoot, absolutePath)];
    await this.memento.update(STORAGE_KEY, all);
  }
}
