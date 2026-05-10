import * as assert from 'assert';
import { AtransProvider } from '../../src/providers/atransProvider';
import { LibreTranslateProvider } from '../../src/providers/libreTranslateProvider';

// FUN-10 + 各プロバイダの「実通信」テスト。
//
// 実プロバイダを起動済みのときだけ走らせる。詳細は test/README.md を参照。
//   - LINGOBRIDGE_TEST_LIBRE_ENDPOINT  : 例 "http://127.0.0.1:5000" を設定すると LibreTranslate 実通信テストを有効化
//   - LINGOBRIDGE_TEST_ATRANS=1        : macOS で atrans CLI が PATH にあるとき有効化
//
// 環境変数が設定されていないテストは skip し、CI 等で誤検出しないようにする。

const LIBRE = process.env.LINGOBRIDGE_TEST_LIBRE_ENDPOINT;
const ATRANS = process.env.LINGOBRIDGE_TEST_ATRANS === '1';

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
  });
});
