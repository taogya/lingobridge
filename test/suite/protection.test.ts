import * as assert from 'assert';
import { protect } from '../../src/protection';

suite('protection', () => {
  test('protects fenced code, inline code, urls and restores', () => {
    const text = [
      'これは `inline` のテストです。',
      'URL は https://example.com/path?x=1 を含みます。',
      '```ts',
      'const x = 1;',
      '```'
    ].join('\n');
    const { protectedText, restore } = protect(text);
    assert.ok(!protectedText.includes('https://example.com'));
    assert.ok(!protectedText.includes('const x = 1'));
    assert.ok(!protectedText.includes('`inline`'));
    // After translation (simulated as identity), restore returns original.
    assert.strictEqual(restore(protectedText), text);
  });

  test('no-op for plain text', () => {
    const { protectedText, restore } = protect('普通の日本語テキスト');
    assert.strictEqual(protectedText, '普通の日本語テキスト');
    assert.strictEqual(restore(protectedText), '普通の日本語テキスト');
  });
});
