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
 * 讀者閱讀進度的持久化——存在 workspaceState,單一 key 底下以導讀相對路徑
 * 為索引,每份導讀只留最後所在的步驟(design.md 決策 2、3)。與 AttemptStore
 * 同構但各自獨立留存,兩者生命週期不同(進度會在走完 quiz 時被清除)。
 */
export class ProgressStore {
  constructor(private readonly memento: AttemptMemento) {}

  private toRelativePath(workspaceRoot: string, absolutePath: string): string {
    return relative(workspaceRoot, absolutePath);
  }

  private readAll(): ProgressMap {
    return this.memento.get(STORAGE_KEY, {});
  }

  async record(workspaceRoot: string, absolutePath: string, ref: string, stepIndex: number): Promise<void> {
    const all = this.readAll();
    all[this.toRelativePath(workspaceRoot, absolutePath)] = { ref, stepIndex };
    await this.memento.update(STORAGE_KEY, all);
  }

  /** ref 不符(導讀已重新產生)時視同沒有進度。 */
  get(workspaceRoot: string, absolutePath: string, ref: string): WalkProgressSummary | undefined {
    const record = this.readAll()[this.toRelativePath(workspaceRoot, absolutePath)];
    if (!record || record.ref !== ref) {
      return undefined;
    }
    return { stepIndex: record.stepIndex };
  }

  async clear(workspaceRoot: string, absolutePath: string): Promise<void> {
    const all = this.readAll();
    delete all[this.toRelativePath(workspaceRoot, absolutePath)];
    await this.memento.update(STORAGE_KEY, all);
  }
}
