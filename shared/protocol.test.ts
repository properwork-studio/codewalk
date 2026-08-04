import { describe, expect, it } from 'vitest';
import { parseWebviewToHostMessage } from './protocol';

describe('parseWebviewToHostMessage', () => {
  it('parses a webviewReady message', () => {
    expect(parseWebviewToHostMessage({ type: 'webviewReady' })).toEqual({ type: 'webviewReady' });
  });

  it('parses a selectWalkFile message with a path', () => {
    expect(parseWebviewToHostMessage({ type: 'selectWalkFile', path: 'a.codewalk.json' })).toEqual({
      type: 'selectWalkFile',
      path: 'a.codewalk.json',
    });
  });

  it('parses a quizSubmitted message with an answers array', () => {
    const msg = { type: 'quizSubmitted', answers: [0, 1, 2, 0, 1] };
    expect(parseWebviewToHostMessage(msg)).toEqual(msg);
  });

  it('parses a jumpToStep message with a stepIndex', () => {
    expect(parseWebviewToHostMessage({ type: 'jumpToStep', stepIndex: 0 })).toEqual({
      type: 'jumpToStep',
      stepIndex: 0,
    });
  });

  it('rejects jumpToStep without a numeric stepIndex', () => {
    expect(parseWebviewToHostMessage({ type: 'jumpToStep' })).toBeNull();
    expect(parseWebviewToHostMessage({ type: 'jumpToStep', stepIndex: 'first' })).toBeNull();
  });

  it('rejects selectWalkFile without a path', () => {
    expect(parseWebviewToHostMessage({ type: 'selectWalkFile' })).toBeNull();
  });

  it('rejects quizSubmitted with a non-numeric answers array', () => {
    expect(parseWebviewToHostMessage({ type: 'quizSubmitted', answers: ['a'] })).toBeNull();
  });

  it('parses an openReference message with a url', () => {
    expect(parseWebviewToHostMessage({ type: 'openReference', url: 'https://example.com' })).toEqual({
      type: 'openReference',
      url: 'https://example.com',
    });
  });

  it('rejects openReference without a url', () => {
    expect(parseWebviewToHostMessage({ type: 'openReference' })).toBeNull();
  });

  it('parses a jumpToSnippet message with stepIndex and itemIndex', () => {
    expect(parseWebviewToHostMessage({ type: 'jumpToSnippet', stepIndex: 1, itemIndex: 2 })).toEqual({
      type: 'jumpToSnippet',
      stepIndex: 1,
      itemIndex: 2,
    });
  });

  it('rejects jumpToSnippet without numeric indexes', () => {
    expect(parseWebviewToHostMessage({ type: 'jumpToSnippet', stepIndex: 1 })).toBeNull();
    expect(parseWebviewToHostMessage({ type: 'jumpToSnippet', stepIndex: '1', itemIndex: 2 })).toBeNull();
  });

  it('parses a clearAttempt message with a path', () => {
    expect(parseWebviewToHostMessage({ type: 'clearAttempt', path: 'a.codewalk.json' })).toEqual({
      type: 'clearAttempt',
      path: 'a.codewalk.json',
    });
  });

  it('rejects clearAttempt without a path', () => {
    expect(parseWebviewToHostMessage({ type: 'clearAttempt' })).toBeNull();
  });

  it('parses a copyRegenerateHint message', () => {
    expect(parseWebviewToHostMessage({ type: 'copyRegenerateHint' })).toEqual({ type: 'copyRegenerateHint' });
  });

  it('rejects an unknown message type', () => {
    expect(parseWebviewToHostMessage({ type: 'unknown' })).toBeNull();
  });

  it('rejects non-object input', () => {
    expect(parseWebviewToHostMessage('not an object')).toBeNull();
    expect(parseWebviewToHostMessage(null)).toBeNull();
  });
});
