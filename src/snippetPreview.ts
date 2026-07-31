import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SnippetPreviewResult } from '../shared/protocol';
import type { CodewalkItem } from '../shared/schema';

const EXTENSION_LANGUAGE: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  json: 'json',
  py: 'python',
  go: 'go',
  rs: 'rust',
  css: 'css',
  html: 'html',
  md: 'markdown',
  sh: 'bash',
  bash: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
};

function detectLanguage(file: string): string {
  const ext = file.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_LANGUAGE[ext] ?? 'plaintext';
}

type SnippetItem = Extract<CodewalkItem, { kind: 'snippet' }>;

/**
 * 只讀取「目前 step」的 snippet 內容,隨 walkLoaded/stepChanged 一起送到 webview——
 * 不預讀整份 walk,避免不必要的磁碟 I/O(見 design.md 決策 3)。
 */
export async function readSnippetPreviews(
  workspaceRoot: string,
  items: CodewalkItem[],
): Promise<SnippetPreviewResult[]> {
  const results: SnippetPreviewResult[] = [];
  items.forEach((item, itemIndex) => {
    if (item.kind !== 'snippet') return;
    const snippet = item as SnippetItem;
    const absPath = join(workspaceRoot, snippet.file);
    if (!existsSync(absPath)) {
      results.push({ itemIndex, ok: false, message: `找不到檔案:${snippet.file}` });
      return;
    }
    const lines = readFileSync(absPath, 'utf8').split('\n');
    const content = lines.slice(snippet.startLine - 1, snippet.endLine).join('\n');
    results.push({ itemIndex, ok: true, content, language: detectLanguage(snippet.file) });
  });
  return results;
}
