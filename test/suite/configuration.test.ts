import * as assert from 'assert';
import * as vscode from 'vscode';

// NFR-01: settings.json で各種挙動を制御可能 (既定値が package.json と同期していること)。
suite('configuration defaults', () => {
  const cfg = () => vscode.workspace.getConfiguration('lingobridge');

  test('provider.active defaults to atrans', () => {
    assert.strictEqual(cfg().get<string>('provider.active'), 'atrans');
  });
  test('protection.enabled defaults to true', () => {
    assert.strictEqual(cfg().get<boolean>('protection.enabled'), true);
  });
  test('output.openInNewTab defaults to true', () => {
    assert.strictEqual(cfg().get<boolean>('output.openInNewTab'), true);
  });
  test('statusBar.enabled defaults to true', () => {
    assert.strictEqual(cfg().get<boolean>('statusBar.enabled'), true);
  });
  test('input.translateOnEnter defaults to true', () => {
    assert.strictEqual(cfg().get<boolean>('input.translateOnEnter'), true);
  });
  test('tokenEstimator.engine defaults to heuristic', () => {
    assert.strictEqual(cfg().get<string>('tokenEstimator.engine'), 'heuristic');
  });
  test('atrans.timeoutMs defaults to 30000', () => {
    assert.strictEqual(cfg().get<number>('atrans.timeoutMs'), 30000);
  });
  test('libretranslate.endpoint defaults to local server', () => {
    assert.strictEqual(
      cfg().get<string>('libretranslate.endpoint'),
      'http://127.0.0.1:5000'
    );
  });
  test('libretranslate.timeoutMs defaults to 30000', () => {
    assert.strictEqual(cfg().get<number>('libretranslate.timeoutMs'), 30000);
  });
  test('history.enabled defaults to true', () => {
    assert.strictEqual(cfg().get<boolean>('history.enabled'), true);
  });
  test('history.maxEntries defaults to 50', () => {
    assert.strictEqual(cfg().get<number>('history.maxEntries'), 50);
  });
  test('languagePairs defaults to ja<->en', () => {
    const pairs = cfg().get<{ from: string; to: string; label?: string }[]>(
      'languagePairs'
    );
    assert.ok(Array.isArray(pairs));
    assert.strictEqual(pairs!.length, 2);
    assert.deepStrictEqual(
      pairs!.map((p) => `${p.from}->${p.to}`).sort(),
      ['en->ja', 'ja->en']
    );
  });
});
