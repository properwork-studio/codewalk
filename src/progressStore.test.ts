import { describe, expect, it } from 'vitest';
import type { AttemptMemento } from './attemptStore';
import { ProgressStore } from './progressStore';

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

describe('ProgressStore', () => {
  it('returns undefined when no progress has been recorded', () => {
    const store = new ProgressStore(fakeMemento());
    expect(store.get(ROOT, WALK_PATH, 'ref-1')).toBeUndefined();
  });

  it('records progress and reads it back with a matching ref', async () => {
    const store = new ProgressStore(fakeMemento());
    await store.record(ROOT, WALK_PATH, 'ref-1', 11);

    expect(store.get(ROOT, WALK_PATH, 'ref-1')).toEqual({ stepIndex: 11 });
  });

  it('treats a mismatched ref as no progress', async () => {
    const store = new ProgressStore(fakeMemento());
    await store.record(ROOT, WALK_PATH, 'ref-1', 11);

    expect(store.get(ROOT, WALK_PATH, 'ref-2')).toBeUndefined();
  });

  it('overwrites the previous progress for the same walk', async () => {
    const store = new ProgressStore(fakeMemento());
    await store.record(ROOT, WALK_PATH, 'ref-1', 3);
    await store.record(ROOT, WALK_PATH, 'ref-1', 7);

    expect(store.get(ROOT, WALK_PATH, 'ref-1')).toEqual({ stepIndex: 7 });
  });

  it('keeps progress for different walks independent', async () => {
    const otherPath = '/workspace/.codewalk/other.codewalk.json';
    const store = new ProgressStore(fakeMemento());
    await store.record(ROOT, WALK_PATH, 'ref-1', 11);
    await store.record(ROOT, otherPath, 'ref-a', 3);

    expect(store.get(ROOT, WALK_PATH, 'ref-1')?.stepIndex).toBe(11);
    expect(store.get(ROOT, otherPath, 'ref-a')?.stepIndex).toBe(3);
  });

  it('clears recorded progress', async () => {
    const store = new ProgressStore(fakeMemento());
    await store.record(ROOT, WALK_PATH, 'ref-1', 11);
    await store.clear(ROOT, WALK_PATH);

    expect(store.get(ROOT, WALK_PATH, 'ref-1')).toBeUndefined();
  });

  it('clearing a walk with no progress is a no-op', async () => {
    const store = new ProgressStore(fakeMemento());
    await expect(store.clear(ROOT, WALK_PATH)).resolves.toBeUndefined();
    expect(store.get(ROOT, WALK_PATH, 'ref-1')).toBeUndefined();
  });
});
