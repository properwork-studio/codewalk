import { describe, expect, it } from 'vitest';
import { join, sep } from 'node:path';
import { resolveInWorkspace, toWorkspaceRelativePath } from './workspacePath';

const root = join(sep, 'home', 'reader', 'myrepo');

describe('resolveInWorkspace', () => {
  it('解析 workspace 內的相對路徑', () => {
    expect(resolveInWorkspace(root, 'src/index.ts')).toBe(join(root, 'src', 'index.ts'));
  });

  it('接受指向 workspace 根目錄本身', () => {
    expect(resolveInWorkspace(root, '.')).toBe(root);
  });

  it('擋下用 .. 逸出 workspace', () => {
    expect(resolveInWorkspace(root, '../../../.ssh/id_rsa')).toBeNull();
  });

  it('擋下路徑中段才逸出的情況', () => {
    expect(resolveInWorkspace(root, 'src/../../../etc/passwd')).toBeNull();
  });

  it('擋下絕對路徑', () => {
    expect(resolveInWorkspace(root, join(sep, 'etc', 'passwd'))).toBeNull();
  });

  // /home/reader/myrepo-secrets 以 /home/reader/myrepo 開頭,但它是相鄰目錄不是
  // 子目錄——少了分隔符的前綴比對會誤放行。
  it('擋下同前綴的相鄰目錄', () => {
    expect(resolveInWorkspace(root, '../myrepo-secrets/keys.txt')).toBeNull();
  });

  it('先繞出去再繞回來仍然放行(結果確實在 workspace 內)', () => {
    expect(resolveInWorkspace(root, '../myrepo/src/index.ts')).toBe(join(root, 'src', 'index.ts'));
  });
});

describe('toWorkspaceRelativePath', () => {
  it('換成 workspace 相對路徑', () => {
    const absPath = join(root, '.codewalk', 'tour.codewalk.json');
    expect(toWorkspaceRelativePath(root, absPath)).toBe('.codewalk/tour.codewalk.json');
  });

  it('路徑不在 workspace 內時退回絕對路徑', () => {
    const absPath = join(sep, 'elsewhere', 'tour.codewalk.json');
    expect(toWorkspaceRelativePath(root, absPath)).toBe(absPath);
  });

  it('沒有 workspaceRoot 時退回絕對路徑', () => {
    const absPath = join(root, '.codewalk', 'tour.codewalk.json');
    expect(toWorkspaceRelativePath(undefined, absPath)).toBe(absPath);
  });

  it('相對路徑不含反斜線(即使平台的 path.sep 是反斜線)', () => {
    const absPath = `${root}${sep}.codewalk${sep}tour.codewalk.json`;
    expect(toWorkspaceRelativePath(root, absPath)).not.toContain('\\');
  });
});
