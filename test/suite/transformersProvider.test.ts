import * as assert from 'assert';
import * as path from 'path';
import {
  getTransformersBackendRoot,
  TransformersProvider
} from '../../src/providers/transformersProvider';

suite('transformers provider', () => {
  test('reports notInstalled when @huggingface/transformers is missing', async () => {
    // The package is intentionally not bundled with lingobridge; in CI it is
    // not installed, so checkAvailability must report unavailable.
    const provider = new TransformersProvider();
    const a = await provider.checkAvailability();
    if (a.available) {
      // If a developer happened to install it locally, just assert we got
      // a non-empty pair list back.
      assert.ok((a.supportedPairs ?? []).length > 0);
      return;
    }
    assert.strictEqual(a.available, false);
    assert.ok(a.detail && a.detail.length > 0);

    const r = await provider.translate('hello', {
      direction: { from: 'en', to: 'ja' }
    });
    assert.strictEqual(r.status, 'notInstalled');
  });

  test('resolveModelMap merges defaults with user overrides', () => {
    const p = new TransformersProvider({ modelMap: { 'ja-en': 'custom/model' } });
    const map = p.resolveModelMap();
    assert.strictEqual(map['ja-en'], 'custom/model');
    assert.ok(map['en-ja']); // default still present
  });

  test('Issue #8: backend root is derived from globalStorageUri', () => {
    const fakeContext = {
      globalStorageUri: { fsPath: '/tmp/lingobridge-global' }
    } as any;
    const root = getTransformersBackendRoot(fakeContext);
    assert.strictEqual(root, path.join('/tmp/lingobridge-global', 'transformers-backend'));
    assert.ok(!root.includes('taogya.lingobridge-0.3.2'));
  });
});
