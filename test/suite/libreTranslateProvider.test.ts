import * as assert from 'assert';
import { LibreTranslateProvider } from '../../src/providers/libreTranslateProvider';

// We don't hit a real server here. We only validate that:
//   - When endpoint is unreachable, checkAvailability returns available=false.
//   - When endpoint is unreachable, translate returns notInstalled or failed
//     with a helpful message.
suite('LibreTranslateProvider', () => {
  const provider = new LibreTranslateProvider({
    // Reserved discard prefix port that is virtually always closed.
    endpoint: 'http://127.0.0.1:9' // discard
  });

  test('checkAvailability returns false when server is down', async function () {
    this.timeout(5000);
    const r = await provider.checkAvailability();
    assert.strictEqual(r.available, false);
    assert.ok(r.detail && r.detail.length > 0);
  });

  test('translate returns notInstalled or failed on connection refused', async function () {
    this.timeout(5000);
    const r = await provider.translate('hello', {
      direction: { from: 'en', to: 'ja' },
      timeoutMs: 2000
    });
    assert.ok(r.status === 'notInstalled' || r.status === 'failed' || r.status === 'timeout');
    assert.ok(r.errorMessage && r.errorMessage.length > 0);
  });
});
