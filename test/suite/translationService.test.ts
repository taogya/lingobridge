import * as assert from 'assert';
import { buildOutputFileName } from '../../src/translationService';

suite('buildOutputFileName', () => {
  test('appends lang before extension', () => {
    assert.strictEqual(buildOutputFileName('README.md', 'en'), 'README.en.md');
    assert.strictEqual(buildOutputFileName('notes.txt', 'ja'), 'notes.ja.txt');
  });
  test('replaces existing lang segment', () => {
    assert.strictEqual(buildOutputFileName('README.ja.md', 'en'), 'README.en.md');
    assert.strictEqual(buildOutputFileName('README.en.md', 'ja'), 'README.ja.md');
  });
  test('handles no extension', () => {
    assert.strictEqual(buildOutputFileName('LICENSE', 'en'), 'LICENSE.en');
  });
});
