import { exec as execCb } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { getWorkspaceHead, isRefDrifted } from './refDrift';

const exec = promisify(execCb);
const dirsToClean: string[] = [];

afterEach(async () => {
  await Promise.all(dirsToClean.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

async function makeGitRepo(): Promise<{ dir: string; headSha: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'codewalk-refdrift-'));
  dirsToClean.push(dir);
  await exec('git init -q', { cwd: dir });
  await exec('git config user.email test@example.com', { cwd: dir });
  await exec('git config user.name Test', { cwd: dir });
  await writeFile(join(dir, 'file.txt'), 'hello');
  await exec('git add file.txt', { cwd: dir });
  await exec('git commit -q -m init', { cwd: dir });
  const { stdout } = await exec('git rev-parse HEAD', { cwd: dir });
  return { dir, headSha: stdout.trim() };
}

describe('isRefDrifted', () => {
  it('returns false when HEAD matches the pinned ref', () => {
    expect(isRefDrifted('abc123', 'abc123')).toBe(false);
  });

  it('returns true when HEAD differs from the pinned ref', () => {
    expect(isRefDrifted('abc123', 'def456')).toBe(true);
  });

  it('ignores surrounding whitespace when comparing', () => {
    expect(isRefDrifted('abc123\n', ' abc123 ')).toBe(false);
  });
});

describe('getWorkspaceHead', () => {
  it('returns the current HEAD sha for a git workspace', async () => {
    const { dir, headSha } = await makeGitRepo();
    const result = await getWorkspaceHead(dir);
    expect(result).toBe(headSha);
  });

  it('returns null when the workspace is not a git repository', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'codewalk-nogit-'));
    dirsToClean.push(dir);
    const result = await getWorkspaceHead(dir);
    expect(result).toBeNull();
  });
});
