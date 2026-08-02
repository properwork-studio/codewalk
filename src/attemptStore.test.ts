import { describe, expect, it } from 'vitest';
import { AttemptStore, type AttemptMemento } from './attemptStore';

const ROOT = '/workspace';
const WALK_PATH = '/workspace/.codewalk/2026-08-01-demo.codewalk.json';

function fakeMemento(initial: Record<string, unknown> = {}): AttemptMemento {
  const store = new Map<string, unknown>(Object.entries(initial));
  return {
    get<T>(key: string, defaultValue: T): T {
      return (store.has(key) ? store.get(key) : defaultValue) as T;
    },
    async update(key: string, value: unknown): Promise<void> {
      store.set(key, value);
    },
  };
}

describe('AttemptStore', () => {
  it('returns undefined when no attempt has been recorded', () => {
    const store = new AttemptStore(fakeMemento());
    expect(store.get(ROOT, WALK_PATH, 'ref-1')).toBeUndefined();
  });

  it('records an attempt and reads it back with a matching ref', async () => {
    const store = new AttemptStore(fakeMemento());
    await store.record(ROOT, WALK_PATH, 'ref-1', 1_700_000_000_000, { score: 4, total: 5, passed: true });

    expect(store.get(ROOT, WALK_PATH, 'ref-1')).toEqual({
      at: 1_700_000_000_000,
      score: 4,
      total: 5,
      passed: true,
    });
  });

  it('treats a mismatched ref as no attempt', async () => {
    const store = new AttemptStore(fakeMemento());
    await store.record(ROOT, WALK_PATH, 'ref-1', 1_700_000_000_000, { score: 4, total: 5, passed: true });

    expect(store.get(ROOT, WALK_PATH, 'ref-2')).toBeUndefined();
  });

  it('overwrites the previous attempt for the same walk', async () => {
    const store = new AttemptStore(fakeMemento());
    await store.record(ROOT, WALK_PATH, 'ref-1', 1_000, { score: 2, total: 5, passed: false });
    await store.record(ROOT, WALK_PATH, 'ref-1', 2_000, { score: 4, total: 5, passed: true });

    expect(store.get(ROOT, WALK_PATH, 'ref-1')).toEqual({ at: 2_000, score: 4, total: 5, passed: true });
  });

  it('keeps records for different walks independent', async () => {
    const otherPath = '/workspace/.codewalk/other.codewalk.json';
    const store = new AttemptStore(fakeMemento());
    await store.record(ROOT, WALK_PATH, 'ref-1', 1_000, { score: 2, total: 5, passed: false });
    await store.record(ROOT, otherPath, 'ref-a', 2_000, { score: 5, total: 5, passed: true });

    expect(store.get(ROOT, WALK_PATH, 'ref-1')?.score).toBe(2);
    expect(store.get(ROOT, otherPath, 'ref-a')?.score).toBe(5);
  });

  it('clears a recorded attempt', async () => {
    const store = new AttemptStore(fakeMemento());
    await store.record(ROOT, WALK_PATH, 'ref-1', 1_000, { score: 4, total: 5, passed: true });
    await store.clear(ROOT, WALK_PATH);

    expect(store.get(ROOT, WALK_PATH, 'ref-1')).toBeUndefined();
  });

  it('clearing a walk with no attempt is a no-op', async () => {
    const store = new AttemptStore(fakeMemento());
    await expect(store.clear(ROOT, WALK_PATH)).resolves.toBeUndefined();
    expect(store.get(ROOT, WALK_PATH, 'ref-1')).toBeUndefined();
  });
});
