import { describe, expect, it } from 'vitest';
import { resolvePassThreshold, validateCodewalk } from './schema';

function validSample() {
  return {
    title: '範例導讀',
    ref: 'a1b2c3d4',
    steps: [
      {
        title: '第一步',
        file: 'src/index.ts',
        startLine: 1,
        endLine: 1,
        narration: '這是入口檔案',
        terms: [{ term: 'entry point', explanation: '程式進入點' }],
      },
    ],
    quiz: Array.from({ length: 5 }, (_, i) => ({
      question: `題目 ${i + 1}`,
      options: ['A', 'B'],
      correctIndex: 0,
    })),
  };
}

describe('validateCodewalk', () => {
  it('accepts a well-formed codewalk file', () => {
    const result = validateCodewalk(validSample());
    expect(result.valid).toBe(true);
  });

  it('accepts startLine === endLine as single-line anchor', () => {
    const sample = validSample();
    sample.steps[0].startLine = 10;
    sample.steps[0].endLine = 10;
    const result = validateCodewalk(sample);
    expect(result.valid).toBe(true);
  });

  it('rejects non-object input', () => {
    const result = validateCodewalk('not an object');
    expect(result.valid).toBe(false);
  });

  it('rejects missing steps array', () => {
    const sample = validSample() as any;
    delete sample.steps;
    const result = validateCodewalk(sample);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('steps'))).toBe(true);
    }
  });

  it('rejects a step where endLine < startLine', () => {
    const sample = validSample();
    sample.steps[0].startLine = 20;
    sample.steps[0].endLine = 10;
    const result = validateCodewalk(sample);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('endLine'))).toBe(true);
    }
  });

  it('accepts a quiz with a question count other than 5', () => {
    const sample = validSample();
    sample.quiz = sample.quiz.slice(0, 3);
    const result = validateCodewalk(sample);
    expect(result.valid).toBe(true);
  });

  it('rejects an empty quiz array', () => {
    const sample = validSample();
    sample.quiz = [];
    const result = validateCodewalk(sample);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('quiz'))).toBe(true);
    }
  });

  it('rejects a quiz question whose correctIndex is out of range', () => {
    const sample = validSample();
    sample.quiz[0].correctIndex = 5;
    const result = validateCodewalk(sample);
    expect(result.valid).toBe(false);
  });

  it('accepts an explicit passThreshold within range', () => {
    const sample = { ...validSample(), passThreshold: 2 };
    const result = validateCodewalk(sample);
    expect(result.valid).toBe(true);
  });

  it('rejects a passThreshold greater than the number of quiz questions', () => {
    const sample = { ...validSample(), passThreshold: 6 };
    const result = validateCodewalk(sample);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('passThreshold'))).toBe(true);
    }
  });

  it('rejects a passThreshold less than 1', () => {
    const sample = { ...validSample(), passThreshold: 0 };
    const result = validateCodewalk(sample);
    expect(result.valid).toBe(false);
  });

  it('rejects a non-integer passThreshold', () => {
    const sample = { ...validSample(), passThreshold: 2.5 };
    const result = validateCodewalk(sample);
    expect(result.valid).toBe(false);
  });
});

describe('validateCodewalk — step.items', () => {
  function sampleWithItems(items: unknown[]) {
    const sample = validSample() as any;
    sample.steps[0].items = items;
    return sample;
  }

  it('accepts a step with one of each of the 5 item kinds', () => {
    const sample = sampleWithItems([
      { kind: 'tip', text: '可以搭配 X 使用' },
      { kind: 'pitfall', misconception: '這裡是非同步呼叫', reality: '其實是同步阻塞' },
      { kind: 'todo', text: '這段行為未來可能會變' },
      { kind: 'reference', label: 'RFC 793', url: 'https://www.rfc-editor.org/rfc/rfc793' },
      { kind: 'snippet', label: '呼叫端在這裡', file: 'src/caller.ts', startLine: 10, endLine: 20 },
    ]);
    const result = validateCodewalk(sample);
    expect(result.valid).toBe(true);
  });

  it('accepts a step without items (backwards compatible)', () => {
    const result = validateCodewalk(validSample());
    expect(result.valid).toBe(true);
  });

  it('rejects an item with an unknown kind', () => {
    const result = validateCodewalk(sampleWithItems([{ kind: 'unknown', text: 'x' }]));
    expect(result.valid).toBe(false);
  });

  it('rejects a tip item missing text', () => {
    const result = validateCodewalk(sampleWithItems([{ kind: 'tip' }]));
    expect(result.valid).toBe(false);
  });

  it('rejects a pitfall item missing reality', () => {
    const result = validateCodewalk(sampleWithItems([{ kind: 'pitfall', misconception: '誤解' }]));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('reality'))).toBe(true);
    }
  });

  it('rejects a todo item missing text', () => {
    const result = validateCodewalk(sampleWithItems([{ kind: 'todo' }]));
    expect(result.valid).toBe(false);
  });

  it('rejects a reference item with a non-http(s) url', () => {
    const result = validateCodewalk(
      sampleWithItems([{ kind: 'reference', label: 'x', url: 'ftp://example.com/file' }]),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('url'))).toBe(true);
    }
  });

  it('rejects a reference item with a malformed url', () => {
    const result = validateCodewalk(sampleWithItems([{ kind: 'reference', label: 'x', url: 'not a url' }]));
    expect(result.valid).toBe(false);
  });

  it('accepts a reference item with a valid https url', () => {
    const result = validateCodewalk(
      sampleWithItems([{ kind: 'reference', label: 'x', url: 'https://example.com/docs' }]),
    );
    expect(result.valid).toBe(true);
  });

  it('rejects a snippet item where endLine < startLine', () => {
    const result = validateCodewalk(
      sampleWithItems([{ kind: 'snippet', label: 'x', file: 'src/a.ts', startLine: 20, endLine: 10 }]),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('endLine'))).toBe(true);
    }
  });

  it('rejects a snippet item missing file', () => {
    const result = validateCodewalk(
      sampleWithItems([{ kind: 'snippet', label: 'x', startLine: 1, endLine: 2 }]),
    );
    expect(result.valid).toBe(false);
  });

  it('rejects items that is not an array', () => {
    const sample = validSample() as any;
    sample.steps[0].items = 'not an array';
    const result = validateCodewalk(sample);
    expect(result.valid).toBe(false);
  });
});

describe('resolvePassThreshold', () => {
  it('uses the explicit passThreshold when present', () => {
    const walk = { ...validSample(), passThreshold: 2 } as any;
    expect(resolvePassThreshold(walk)).toBe(2);
  });

  it('defaults to a simple majority (ceil(N/2)) when passThreshold is absent', () => {
    const walk = validSample() as any;
    expect(resolvePassThreshold(walk)).toBe(3); // ceil(5/2) === 3, matches the previous hardcoded MVP behaviour
  });

  it('defaults correctly for an even question count', () => {
    const walk = { ...validSample(), quiz: validSample().quiz.slice(0, 4) } as any;
    expect(resolvePassThreshold(walk)).toBe(2); // ceil(4/2) === 2
  });
});
