import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readSnippetPreviews } from './snippetPreview';

const dirsToClean: string[] = [];

afterEach(async () => {
  await Promise.all(dirsToClean.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('readSnippetPreviews', () => {
  it('reports fileNotFound for a snippet item whose file does not exist', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'codewalk-snippet-'));
    dirsToClean.push(dir);

    const results = await readSnippetPreviews(dir, [
      { kind: 'snippet', label: '呼叫端', file: 'does/not/exist.ts', startLine: 1, endLine: 2 },
    ]);

    expect(results).toEqual([{ itemIndex: 0, ok: false, message: '找不到檔案:does/not/exist.ts' }]);
  });

  it('reads the given line range and detects the language from the file extension', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'codewalk-snippet-'));
    dirsToClean.push(dir);
    await writeFile(join(dir, 'caller.ts'), 'line1\nline2\nline3\nline4\n', 'utf8');

    const results = await readSnippetPreviews(dir, [
      { kind: 'snippet', label: '呼叫端', file: 'caller.ts', startLine: 2, endLine: 3 },
    ]);

    expect(results).toEqual([{ itemIndex: 0, ok: true, content: 'line2\nline3', language: 'typescript' }]);
  });

  it('ignores non-snippet items and keeps the original items index', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'codewalk-snippet-'));
    dirsToClean.push(dir);
    await writeFile(join(dir, 'a.py'), 'x = 1\n', 'utf8');

    const results = await readSnippetPreviews(dir, [
      { kind: 'tip', text: '提示' },
      { kind: 'snippet', label: 'x', file: 'a.py', startLine: 1, endLine: 1 },
    ]);

    expect(results).toEqual([{ itemIndex: 1, ok: true, content: 'x = 1', language: 'python' }]);
  });
});
