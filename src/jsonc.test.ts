import { describe, expect, it } from 'vitest';
import { parseJsonc } from './jsonc';

describe('parseJsonc', () => {
  it('parses plain JSON unchanged', () => {
    expect(parseJsonc('{"a": 1, "b": [1, 2, 3]}')).toEqual({ a: 1, b: [1, 2, 3] });
  });

  it('strips full-line comments', () => {
    const text = '{\n  // 這是註解\n  "a": 1\n}';
    expect(parseJsonc(text)).toEqual({ a: 1 });
  });

  it('strips trailing-line comments after a value', () => {
    const text = '{\n  "a": 1, // 說明\n  "b": 2\n}';
    expect(parseJsonc(text)).toEqual({ a: 1, b: 2 });
  });

  it('strips block comments', () => {
    const text = '{\n  /* 區塊註解\n     跨多行 */\n  "a": 1\n}';
    expect(parseJsonc(text)).toEqual({ a: 1 });
  });

  it('strips trailing commas before } and ]', () => {
    const text = '{\n  "a": 1,\n  "b": [1, 2,],\n}';
    expect(parseJsonc(text)).toEqual({ a: 1, b: [1, 2] });
  });

  it('does not treat // inside a string value as a comment', () => {
    const text = '{ "url": "https://example.com" }';
    expect(parseJsonc(text)).toEqual({ url: 'https://example.com' });
  });

  it('does not treat /* inside a string value as a comment', () => {
    const text = '{ "note": "a /* not a comment */ b" }';
    expect(parseJsonc(text)).toEqual({ note: 'a /* not a comment */ b' });
  });

  it('handles escaped quotes inside strings without ending the string early', () => {
    const text = String.raw`{ "a": "say \"hi\" // still string" }`;
    expect(parseJsonc(text)).toEqual({ a: 'say "hi" // still string' });
  });

  it('throws for genuinely malformed JSON', () => {
    expect(() => parseJsonc('{ not json')).toThrow();
  });
});
