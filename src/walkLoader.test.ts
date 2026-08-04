import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { filterCodewalkFileNames, findCodewalkFiles, loadCodewalkFile, listWalkFiles } from './walkLoader';

const dirsToClean: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'codewalk-test-'));
  dirsToClean.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(dirsToClean.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

function validSampleJson(title = '範例導讀') {
  return JSON.stringify({
    title,
    ref: 'a1b2c3d4',
    steps: [{ title: '第一步', file: 'src/index.ts', startLine: 1, endLine: 1, narration: '入口' }],
    quiz: Array.from({ length: 5 }, (_, i) => ({
      question: `題目 ${i + 1}`,
      options: ['A', 'B'],
      correctIndex: 0,
    })),
  });
}

function bigSampleJson(title: string) {
  return JSON.stringify({
    title,
    ref: 'a1b2c3d4',
    steps: Array.from({ length: 400 }, (_, i) => ({
      title: `第 ${i + 1} 步`,
      file: 'src/index.ts',
      startLine: 1,
      endLine: 1,
      narration: 'x'.repeat(500),
    })),
    quiz: Array.from({ length: 5 }, (_, i) => ({
      question: `題目 ${i + 1}`,
      options: ['A', 'B'],
      correctIndex: 0,
    })),
  });
}

describe('filterCodewalkFileNames', () => {
  it('keeps only *.codewalk.json entries, sorted', () => {
    const result = filterCodewalkFileNames(['b.codewalk.json', 'notes.txt', 'a.codewalk.json', 'assets']);
    expect(result).toEqual(['a.codewalk.json', 'b.codewalk.json']);
  });
});

describe('findCodewalkFiles', () => {
  it('returns an empty list when .codewalk/ does not exist', async () => {
    const workspaceRoot = await makeWorkspace();
    const result = await findCodewalkFiles(workspaceRoot);
    expect(result).toEqual([]);
  });

  it('returns full paths of codewalk files inside .codewalk/', async () => {
    const workspaceRoot = await makeWorkspace();
    const codewalkDir = join(workspaceRoot, '.codewalk');
    await mkdir(codewalkDir);
    await writeFile(join(codewalkDir, '2026-07-31-demo.codewalk.json'), validSampleJson());
    await writeFile(join(codewalkDir, 'README.md'), '# not a walk');

    const result = await findCodewalkFiles(workspaceRoot);
    expect(result).toEqual([join(codewalkDir, '2026-07-31-demo.codewalk.json')]);
  });
});

describe('loadCodewalkFile', () => {
  it('loads and validates a well-formed file', async () => {
    const workspaceRoot = await makeWorkspace();
    const filePath = join(workspaceRoot, 'walk.codewalk.json');
    await writeFile(filePath, validSampleJson());

    const result = await loadCodewalkFile(filePath);
    expect(result.valid).toBe(true);
  });

  it('reports a parse error for invalid JSON', async () => {
    const workspaceRoot = await makeWorkspace();
    const filePath = join(workspaceRoot, 'broken.codewalk.json');
    await writeFile(filePath, '{ not valid json');

    const result = await loadCodewalkFile(filePath);
    expect(result.valid).toBe(false);
  });

  it('reports schema errors for JSON that does not match the schema', async () => {
    const workspaceRoot = await makeWorkspace();
    const filePath = join(workspaceRoot, 'incomplete.codewalk.json');
    await writeFile(filePath, JSON.stringify({ title: 'x' }));

    const result = await loadCodewalkFile(filePath);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});

describe('listWalkFiles', () => {
  it('falls back to the file name as title when a file fails validation', async () => {
    const workspaceRoot = await makeWorkspace();
    const codewalkDir = join(workspaceRoot, '.codewalk');
    await mkdir(codewalkDir);
    await writeFile(join(codewalkDir, 'good.codewalk.json'), validSampleJson('好的導讀'));
    await writeFile(join(codewalkDir, 'bad.codewalk.json'), '{ broken');

    const summaries = await listWalkFiles(workspaceRoot);
    expect(summaries).toEqual([
      { path: join(codewalkDir, 'bad.codewalk.json'), title: 'bad.codewalk.json' },
      { path: join(codewalkDir, 'good.codewalk.json'), title: '好的導讀' },
    ]);
  });

  it('keeps file-name order even when the first file takes longest to read', async () => {
    const workspaceRoot = await makeWorkspace();
    const codewalkDir = join(workspaceRoot, '.codewalk');
    await mkdir(codewalkDir);
    // a 明顯大於其餘檔案:若改用「讀完就 push」的並行寫法,a 多半會掉到最後
    await writeFile(join(codewalkDir, 'a.codewalk.json'), bigSampleJson('大導讀'));
    await writeFile(join(codewalkDir, 'b.codewalk.json'), validSampleJson('乙導讀'));
    await writeFile(join(codewalkDir, 'c.codewalk.json'), validSampleJson('丙導讀'));

    const summaries = await listWalkFiles(workspaceRoot);
    expect(summaries.map((s) => s.title)).toEqual(['大導讀', '乙導讀', '丙導讀']);
  });
});
