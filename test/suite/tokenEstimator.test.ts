import * as assert from 'assert';
import { estimateTokens, estimateTokensWith, formatTokens } from '../../src/tokenEstimator';

suite('tokenEstimator', () => {
  test('returns 0 for empty', () => {
    assert.strictEqual(estimateTokens(''), 0);
  });
  test('ASCII word run uses ceil(len/4)', () => {
    // 'hello' -> ceil(5/4) = 2
    assert.strictEqual(estimateTokens('hello'), 2);
    // 'hi' -> ceil(2/4) = 1, clamped
    assert.strictEqual(estimateTokens('hi'), 1);
  });
  test('CJK chars are 1 token each', () => {
    // 5 hiragana = 5
    assert.strictEqual(estimateTokens('こんにちは'), 5);
  });
  test('mixed JA/EN: JA dominates', () => {
    // 4 kanji + ' is ' + 'good' (4) -> 4 + 0 (ws) + ceil(2/4)+ceil(4/4) ... approx
    // We just assert JA-heavy text gets larger token count than the same length English.
    const ja = 'これはテストです。上手くいくかわからない。';
    const en = 'This is a test sentence to compare token counts roughly.';
    assert.ok(estimateTokens(ja) > estimateTokens(en), `ja=${estimateTokens(ja)} en=${estimateTokens(en)}`);
  });
  test('formatTokens', () => {
    assert.strictEqual(formatTokens(0), '0 tok');
    assert.strictEqual(formatTokens(999), '999 tok');
    assert.strictEqual(formatTokens(1234), '1.2k tok');
    assert.strictEqual(formatTokens(15000), '15k tok');
  });
  test('tiktoken engine returns positive count for non-empty', () => {
    const n = estimateTokensWith('tiktoken', 'Hello, world!');
    assert.ok(n > 0, `expected > 0, got ${n}`);
  });
  test('tiktoken engine handles JA', () => {
    const n = estimateTokensWith('tiktoken', 'こんにちは世界');
    assert.ok(n > 0);
  });
});
