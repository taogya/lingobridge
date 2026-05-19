import * as assert from 'assert';
import { AtransProvider } from '../../src/providers/atransProvider';
import { LibreTranslateProvider } from '../../src/providers/libreTranslateProvider';
import {
  configureTransformersBackendRoot,
  TransformersProvider
} from '../../src/providers/transformersProvider';
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
//   - LINGOBRIDGE_TEST_TRANSFORMERS=1  : `@huggingface/transformers` が解決可能なときに transformers.js 実推論テストを有効化
//     (任意で `LINGOBRIDGE_TEST_TRANSFORMERS_BACKEND_DIR` に拡張のグローバル
//     ストレージ配下 `transformers-backend/` の絶対パスを指定可能)
//
// 環境変数が設定されていないテストは skip し、CI 等で誤検出しないようにする。

const LIBRE = process.env.LINGOBRIDGE_TEST_LIBRE_ENDPOINT;
const ATRANS = process.env.LINGOBRIDGE_TEST_ATRANS === '1';
const TRANSFORMERS = process.env.LINGOBRIDGE_TEST_TRANSFORMERS === '1';
const TRANSFORMERS_BACKEND_DIR = process.env.LINGOBRIDGE_TEST_TRANSFORMERS_BACKEND_DIR;

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

  // Issue #7 (v0.3.4) follow-up: transformers.js は markdown 記号を
  // 落としやすいモデル (Helsinki-NLP MarianMT) を使うため、Ctrl+Alt+E
  // 経由のドキュメント翻訳で結果が崩れる事象が長く再発していた。
  // 既定の保護層 (`inlineEmphasis` / `markdownLink` / 構造行スプリッタ)
  // が実推論でも構造を保つことを確認するための実通信テスト。
  suite('transformers', function () {
    if (!TRANSFORMERS) {
      test.skip('skipped — set LINGOBRIDGE_TEST_TRANSFORMERS=1 to enable', () => {});
      return;
    }
    if (TRANSFORMERS_BACKEND_DIR) {
      configureTransformersBackendRoot(TRANSFORMERS_BACKEND_DIR);
    }
    const provider = new TransformersProvider();

    test('checkAvailability returns available=true', async function () {
      this.timeout(15000);
      const r = await provider.checkAvailability();
      assert.strictEqual(r.available, true, r.detail);
    });

    test('translate en → ja preserves inline bold / link markers via default protection', async function () {
      this.timeout(120000); // first run downloads ONNX model (~300MB)
      const content = [
        'See **bold** text or visit [docs](https://example.com/docs).',
        'Image: ![logo](https://example.com/logo.png).'
      ].join('\n');
      const output = await translateWithDefaultProtection(provider, content, {
        direction: { from: 'en', to: 'ja' },
        timeoutMs: 120000
      });
      assert.ok(output.length > 0, 'output must be non-empty');
      assert.ok(output.includes('**'), 'bold markers must survive transformers run');
      assert.ok(output.includes('https://example.com/docs'), 'link URL must survive');
      assert.ok(output.includes('https://example.com/logo.png'), 'image URL must survive');
      assert.ok(!/⟦|⟧/.test(output), 'no placeholder leakage in final text');
    });

    test('translate ja → en preserves structural markdown lines (heading / list / table)', async function () {
      this.timeout(120000);
      const md = [
        '# 概要',
        '- **重要** な項目',
        '',
        '| キー | 値 |',
        '| --- | --- |',
        '| 名前 | 太郎 |'
      ].join('\n');
      const output = await translateWithDefaultProtection(provider, md, {
        direction: { from: 'ja', to: 'en' },
        timeoutMs: 120000
      });
      assert.ok(output.includes('#'), 'heading marker # must survive');
      assert.ok(output.includes('-'), 'list marker - must survive');
      assert.ok(output.includes('| --- |'), 'table separator must survive verbatim');
      assert.ok(!/⟦|⟧/.test(output), 'no placeholder leakage in final text');
    });
  });
});
