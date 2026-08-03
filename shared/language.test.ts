import { describe, expect, it } from 'vitest';
import { detectLanguage } from './language';

describe('detectLanguage', () => {
  it('maps common extensions to their Shiki language id', () => {
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

  it('maps JVM-family extensions, including Gradle build scripts', () => {
    expect(detectLanguage('src/main/java/App.java')).toBe('java');
    expect(detectLanguage('src/main/kotlin/App.kt')).toBe('kotlin');
    expect(detectLanguage('Spec.groovy')).toBe('groovy');
    expect(detectLanguage('build.gradle')).toBe('groovy');
    expect(detectLanguage('build.gradle.kts')).toBe('kotlin');
    expect(detectLanguage('Main.scala')).toBe('scala');
  });

  it('maps mobile and C-family extensions', () => {
    expect(detectLanguage('lib/main.dart')).toBe('dart');
    expect(detectLanguage('App.swift')).toBe('swift');
    expect(detectLanguage('Program.cs')).toBe('csharp');
    expect(detectLanguage('main.c')).toBe('c');
    expect(detectLanguage('util.h')).toBe('c');
    expect(detectLanguage('engine.cpp')).toBe('cpp');
    expect(detectLanguage('engine.hpp')).toBe('cpp');
  });

  it('maps other common server-side extensions', () => {
    expect(detectLanguage('index.php')).toBe('php');
    expect(detectLanguage('archive.rb')).toBe('ruby');
    expect(detectLanguage('schema.sql')).toBe('sql');
  });

  it('is case-insensitive on the extension', () => {
    expect(detectLanguage('src/Caller.TS')).toBe('typescript');
    expect(detectLanguage('App.JAVA')).toBe('java');
  });

  it('falls back to plaintext for unknown extensions', () => {
    expect(detectLanguage('archive.tar')).toBe('plaintext');
    expect(detectLanguage('no-extension')).toBe('plaintext');
  });
});
