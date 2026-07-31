import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { jumpToStep } from './fileJump';

const dirsToClean: string[] = [];

afterEach(async () => {
  await Promise.all(dirsToClean.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('jumpToStep', () => {
  it('reports fileNotFound without touching vscode when the target file is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'codewalk-jump-'));
    dirsToClean.push(dir);

    const result = await jumpToStep(dir, { file: 'does/not/exist.ts', startLine: 1, endLine: 1 });

    expect(result).toEqual({
      ok: false,
      reason: 'fileNotFound',
      message: '找不到檔案:does/not/exist.ts',
    });
  });
});
