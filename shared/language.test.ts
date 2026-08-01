import { describe, expect, it } from 'vitest';
import { detectLanguage } from './language';

describe('detectLanguage', () => {
  it('maps common extensions to their highlight.js language name', () => {
    expect(detectLanguage('src/caller.ts')).toBe('typescript');
    expect(detectLanguage('src/component.tsx')).toBe('typescript');
    expect(detectLanguage('src/index.js')).toBe('javascript');
    expect(detectLanguage('data.json')).toBe('json');
    expect(detectLanguage('script.py')).toBe('python');
    expect(detectLanguage('main.go')).toBe('go');
    expect(detectLanguage('lib.rs')).toBe('rust');
    expect(detectLanguage('style.css')).toBe('css');
    expect(detectLanguage('page.html')).toBe('html');
    expect(detectLanguage('README.md')).toBe('markdown');
    expect(detectLanguage('run.sh')).toBe('bash');
    expect(detectLanguage('config.yaml')).toBe('yaml');
    expect(detectLanguage('config.yml')).toBe('yaml');
  });

  it('is case-insensitive on the extension', () => {
    expect(detectLanguage('src/Caller.TS')).toBe('typescript');
  });

  it('falls back to plaintext for unknown extensions', () => {
    expect(detectLanguage('archive.rb')).toBe('plaintext');
    expect(detectLanguage('no-extension')).toBe('plaintext');
  });
});
