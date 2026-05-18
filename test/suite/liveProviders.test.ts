import * as assert from 'assert';
import { AtransProvider } from '../../src/providers/atransProvider';
import { LibreTranslateProvider } from '../../src/providers/libreTranslateProvider';
import {
  TranslateOptions,
  TranslationProvider
} from '../../src/providers/translationProvider';
import { protect } from '../../src/protection';

// FUN-10 + 各プロバイダの「実通信」テスト。
//
// 実プロバイダを起動済みのときだけ走らせる。詳細は test/README.md を参照。
//   - LINGOBRIDGE_TEST_LIBRE_ENDPOINT  : 例 "http://127.0.0.1:5000" を設定すると LibreTranslate 実通信テストを有効化
//   - LINGOBRIDGE_TEST_ATRANS=1        : macOS で atrans CLI が PATH にあるとき有効化
//
// 環境変数が設定されていないテストは skip し、CI 等で誤検出しないようにする。

const LIBRE = process.env.LINGOBRIDGE_TEST_LIBRE_ENDPOINT;
const ATRANS = process.env.LINGOBRIDGE_TEST_ATRANS === '1';

async function translateWithDefaultProtection(
  provider: TranslationProvider,
  text: string,
  options: TranslateOptions
): Promise<string> {
  const { protectedText, restore } = protect(text);
  const result = await provider.translate(protectedText, options);
  assert.strictEqual(result.status, 'ok', result.errorMessage);
  return restore(result.translatedText || '');
}

suite('live providers (gated)', () => {
  suite('LibreTranslate', function () {
    if (!LIBRE) {
      test.skip('skipped — set LINGOBRIDGE_TEST_LIBRE_ENDPOINT to enable', () => {});
      return;
    }
    const provider = new LibreTranslateProvider({ endpoint: LIBRE });

    test('checkAvailability returns available=true', async function () {
      this.timeout(8000);
      const r = await provider.checkAvailability();
      assert.strictEqual(r.available, true, r.detail);
      assert.ok(Array.isArray(r.supportedPairs) && r.supportedPairs!.length > 0);
    });

    test('translate ja → en returns ok with non-empty text', async function () {
      this.timeout(15000);
      const r = await provider.translate('こんにちは', {
        direction: { from: 'ja', to: 'en' },
        timeoutMs: 10000
      });
      assert.strictEqual(r.status, 'ok', r.errorMessage);
      assert.ok(r.translatedText && r.translatedText.trim().length > 0);
    });

    test('translate en → ja returns ok with non-empty text', async function () {
      this.timeout(15000);
      const r = await provider.translate('hello world', {
        direction: { from: 'en', to: 'ja' },
        timeoutMs: 10000
      });
      assert.strictEqual(r.status, 'ok', r.errorMessage);
      assert.ok(r.translatedText && r.translatedText.trim().length > 0);
    });

    test('translate complex markdown content: mixed headings, lists, tables', async function () {
      this.timeout(20000);
      const complexMd = [
        '# Documentation',
        '',
        '## Overview',
        '- This is important content',
        '- With multiple items',
        '',
        '| Key | Value |',
        '| --- | --- |',
        '| Name | John |',
        '| Age | 30 |',
        '',
        '> A quote goes here.',
        '> Second line of quote.'
      ].join('\n');

      const r = await provider.translate(complexMd, {
        direction: { from: 'en', to: 'ja' },
        timeoutMs: 15000
      });
      assert.strictEqual(r.status, 'ok', r.errorMessage);
      assert.ok(r.translatedText, 'should have translation result');
      // Verify structure markers survived (loose check - presence of key chars)
      const output = r.translatedText || '';
      assert.ok(output.includes('#'), 'heading marker # should be present');
      assert.ok(output.includes('-') || output.includes('•'), 'list marker should be present');
    });

    test('translate content with inline code, URLs, and punctuation through the default protection layer', async function () {
      this.timeout(20000);
      const content = [
        'Install with: `npm install package`',
        'Visit https://example.com for details.',
        'Important: Follow the instructions carefully!',
        'Variables: $price, €cost, ¥amount.'
      ].join('\n');

      const output = await translateWithDefaultProtection(provider, content, {
        direction: { from: 'en', to: 'ja' },
        timeoutMs: 15000
      });
      assert.ok(output.length > 0);
      assert.ok(output.includes('`npm install package`'), 'inline code should survive');
      assert.ok(output.includes('https://example.com'), 'URL should survive');
    });
  });

  suite('atrans', function () {
    if (!ATRANS) {
      test.skip('skipped — set LINGOBRIDGE_TEST_ATRANS=1 to enable (macOS)', () => {});
      return;
    }
    const provider = new AtransProvider();

    test('checkAvailability returns available=true', async function () {
      this.timeout(5000);
      const r = await provider.checkAvailability();
      assert.strictEqual(r.available, true, r.detail);
    });

    test('translate ja → en returns ok with non-empty text', async function () {
      this.timeout(15000);
      const r = await provider.translate('こんにちは', {
        direction: { from: 'ja', to: 'en' },
        timeoutMs: 10000
      });
      assert.strictEqual(r.status, 'ok', r.errorMessage);
      assert.ok(r.translatedText && r.translatedText.trim().length > 0);
    });

    test('translate complex JP markdown: headings, lists, tables, quotes', async function () {
      this.timeout(20000);
      const complexMd = [
        '# ドキュメント',
        '',
        '## 概要',
        '- 重要なコンテンツです',
        '- 複数の項目があります',
        '',
        '| キー | 値 |',
        '| --- | --- |',
        '| 名前 | 太郎 |',
        '| 年齢 | 30 |',
        '',
        '> 引用します。',
        '> 引用の2行目です。'
      ].join('\n');

      const r = await provider.translate(complexMd, {
        direction: { from: 'ja', to: 'en' },
        timeoutMs: 15000
      });
      assert.strictEqual(r.status, 'ok', r.errorMessage);
      assert.ok(r.translatedText, 'should have translation result');
      const output = r.translatedText || '';
      assert.ok(output.includes('#'), 'heading marker # should be present');
      assert.ok(output.includes('-') || output.includes('•'), 'list marker should be present');
    });

    test('translate JP content with punctuation, symbols, and inline code through the default protection layer', async function () {
      this.timeout(20000);
      const content = [
        '重要な情報：以下を確認してください。',
        '実行コマンド：`npm install @package`',
        'リンク：https://github.com/user/repo',
        '価格：¥1,000（税込）',
        '結果は「成功」です！'
      ].join('\n');

      const output = await translateWithDefaultProtection(provider, content, {
        direction: { from: 'ja', to: 'en' },
        timeoutMs: 15000
      });
      assert.ok(output.length > 0);
      assert.ok(output.includes('`npm install @package`'), 'inline code should survive');
      assert.ok(output.includes('https://github.com/user/repo'), 'URL should survive');
    });
  });
});
