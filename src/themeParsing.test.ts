import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  findThemeDefinition,
  loadRawTheme,
  mergeIncludedTheme,
  normalizeTokenColors,
  themeKindFromUiTheme,
} from './themeParsing';

const dirsToClean: string[] = [];

afterEach(async () => {
  await Promise.all(dirsToClean.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

async function makeTmpDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'codewalk-theme-'));
  dirsToClean.push(dir);
  return dir;
}

describe('findThemeDefinition', () => {
  it('finds a theme by label and joins extensionPath with the theme path', () => {
    const result = findThemeDefinition('Eva Dark', [
      {
        extensionPath: '/ext/eva-theme',
        packageJSON: {
          contributes: {
            themes: [{ label: 'Eva Dark', path: './themes/eva-dark.json', uiTheme: 'vs-dark' }],
          },
        },
      },
    ]);
    expect(result).toEqual({ file: '/ext/eva-theme/themes/eva-dark.json', uiTheme: 'vs-dark' });
  });

  it('matches by id when label does not match', () => {
    const result = findThemeDefinition('Default Dark+', [
      {
        extensionPath: '/builtin/theme-defaults',
        packageJSON: {
          contributes: {
            themes: [
              { id: 'Default Dark+', label: '深色+(預設)', path: './dark_plus.json', uiTheme: 'vs-dark' },
            ],
          },
        },
      },
    ]);
    expect(result?.file).toBe('/builtin/theme-defaults/dark_plus.json');
  });

  it('falls back to vs-dark when uiTheme is missing', () => {
    const result = findThemeDefinition('X', [
      { extensionPath: '/ext', packageJSON: { contributes: { themes: [{ label: 'X', path: './x.json' }] } } },
    ]);
    expect(result?.uiTheme).toBe('vs-dark');
  });

  it('returns null when no extension defines a matching theme', () => {
    const result = findThemeDefinition('不存在的主題', [
      {
        extensionPath: '/ext',
        packageJSON: { contributes: { themes: [{ label: 'Other', path: './x.json' }] } },
      },
    ]);
    expect(result).toBeNull();
  });

  it('skips extensions without a contributes.themes array', () => {
    const result = findThemeDefinition('X', [{ extensionPath: '/ext', packageJSON: {} }]);
    expect(result).toBeNull();
  });

  it('ignores a theme entry whose path is not a string', () => {
    const result = findThemeDefinition('X', [
      { extensionPath: '/ext', packageJSON: { contributes: { themes: [{ label: 'X' }] } } },
    ]);
    expect(result).toBeNull();
  });
});

describe('normalizeTokenColors', () => {
  it('keeps rules that have a foreground or fontStyle', () => {
    const result = normalizeTokenColors([
      { scope: 'keyword', settings: { foreground: '#569CD6' } },
      { scope: ['comment', 'punctuation.comment'], settings: { fontStyle: 'italic' } },
    ]);
    expect(result).toEqual([
      { scope: 'keyword', settings: { foreground: '#569CD6', fontStyle: undefined } },
      { scope: ['comment', 'punctuation.comment'], settings: { foreground: undefined, fontStyle: 'italic' } },
    ]);
  });

  it('drops rules with neither foreground nor fontStyle', () => {
    expect(normalizeTokenColors([{ scope: 'keyword', settings: {} }])).toBeNull();
  });

  it('drops rules with a non-string/non-string-array scope', () => {
    expect(normalizeTokenColors([{ scope: 42, settings: { foreground: '#fff' } }])).toBeNull();
  });

  it('returns null for a non-array input', () => {
    expect(normalizeTokenColors('not an array')).toBeNull();
    expect(normalizeTokenColors(undefined)).toBeNull();
  });

  it('returns null when every entry is filtered out', () => {
    expect(normalizeTokenColors([{ scope: 'x' }, { notAScope: true }])).toBeNull();
  });
});

describe('themeKindFromUiTheme', () => {
  it('maps vs and hc-light to light', () => {
    expect(themeKindFromUiTheme('vs')).toBe('light');
    expect(themeKindFromUiTheme('hc-light')).toBe('light');
  });

  it('maps vs-dark and hc-black to dark', () => {
    expect(themeKindFromUiTheme('vs-dark')).toBe('dark');
    expect(themeKindFromUiTheme('hc-black')).toBe('dark');
  });
});

describe('mergeIncludedTheme', () => {
  it('concatenates tokenColors with base first, override (higher priority) last', () => {
    const base = { tokenColors: [{ scope: 'a' }] };
    const override = { tokenColors: [{ scope: 'b' }] };
    expect(mergeIncludedTheme(base, override).tokenColors).toEqual([{ scope: 'a' }, { scope: 'b' }]);
  });

  it('treats a missing tokenColors array as empty on either side', () => {
    expect(mergeIncludedTheme({}, { tokenColors: [{ scope: 'b' }] }).tokenColors).toEqual([{ scope: 'b' }]);
    expect(mergeIncludedTheme({ tokenColors: [{ scope: 'a' }] }, {}).tokenColors).toEqual([{ scope: 'a' }]);
  });
});

describe('loadRawTheme', () => {
  it('parses a JSONC theme file without include', async () => {
    const dir = await makeTmpDir();
    await writeFile(
      join(dir, 'a.json'),
      '{\n  // 註解\n  "tokenColors": [{ "scope": "x", "settings": {} }]\n}',
      'utf8',
    );
    const result = await loadRawTheme(join(dir, 'a.json'));
    expect(result.tokenColors).toEqual([{ scope: 'x', settings: {} }]);
  });

  it('resolves a single-level include relative to the including file', async () => {
    const dir = await makeTmpDir();
    await writeFile(join(dir, 'base.json'), '{ "tokenColors": [{ "scope": "base" }] }', 'utf8');
    await writeFile(
      join(dir, 'child.json'),
      '{ "include": "./base.json", "tokenColors": [{ "scope": "child" }] }',
      'utf8',
    );
    const result = await loadRawTheme(join(dir, 'child.json'));
    expect(result.tokenColors).toEqual([{ scope: 'base' }, { scope: 'child' }]);
  });

  it('resolves a chain of includes within the allowed depth', async () => {
    const dir = await makeTmpDir();
    await writeFile(join(dir, 'l0.json'), '{ "tokenColors": [{ "scope": "l0" }] }', 'utf8');
    await writeFile(
      join(dir, 'l1.json'),
      '{ "include": "./l0.json", "tokenColors": [{ "scope": "l1" }] }',
      'utf8',
    );
    await writeFile(
      join(dir, 'l2.json'),
      '{ "include": "./l1.json", "tokenColors": [{ "scope": "l2" }] }',
      'utf8',
    );
    const result = await loadRawTheme(join(dir, 'l2.json'));
    expect(result.tokenColors).toEqual([{ scope: 'l0' }, { scope: 'l1' }, { scope: 'l2' }]);
  });

  it('throws when the include chain exceeds the depth limit (circular or excessively deep)', async () => {
    const dir = await makeTmpDir();
    // a → b → a:循環 include,深度會無限增加直到超過上限而拋出。
    await writeFile(
      join(dir, 'a.json'),
      '{ "include": "./b.json", "tokenColors": [{ "scope": "a" }] }',
      'utf8',
    );
    await writeFile(
      join(dir, 'b.json'),
      '{ "include": "./a.json", "tokenColors": [{ "scope": "b" }] }',
      'utf8',
    );
    await expect(loadRawTheme(join(dir, 'a.json'))).rejects.toThrow();
  });

  it('rejects when the file does not exist', async () => {
    const dir = await makeTmpDir();
    await expect(loadRawTheme(join(dir, 'missing.json'))).rejects.toThrow();
  });

  it('rejects when the file content is not valid JSONC', async () => {
    const dir = await makeTmpDir();
    await writeFile(join(dir, 'broken.json'), '{ not valid', 'utf8');
    await expect(loadRawTheme(join(dir, 'broken.json'))).rejects.toThrow();
  });
});
