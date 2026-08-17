import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeDiscoveryFilePath } from './mcpDiscovery';

const tmpDir = join(sep, 'tmp');

describe('computeDiscoveryFilePath', () => {
  it('同一個 workspaceRoot 穩定得到同一個路徑', () => {
    const a = computeDiscoveryFilePath(tmpDir, '/home/reader/myrepo');
    const b = computeDiscoveryFilePath(tmpDir, '/home/reader/myrepo');
    expect(a).toBe(b);
  });

  it('不同 workspaceRoot 得到不同路徑', () => {
    const a = computeDiscoveryFilePath(tmpDir, '/home/reader/repo-a');
    const b = computeDiscoveryFilePath(tmpDir, '/home/reader/repo-b');
    expect(a).not.toBe(b);
  });

  it('落在 tmpDir 底下的 codewalk-mcp 子目錄,副檔名是 .json', () => {
    const path = computeDiscoveryFilePath(tmpDir, '/home/reader/myrepo');
    expect(path.startsWith(join(tmpDir, 'codewalk-mcp') + sep)).toBe(true);
    expect(path.endsWith('.json')).toBe(true);
  });
});
