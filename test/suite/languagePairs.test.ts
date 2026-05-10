import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  defaultLabel,
  getLanguagePairs,
  pairPickLabel
} from '../../src/languagePairs';

// TASK-00003 多言語対応 — 設定読み込み・サニタイズ・表示ラベル。
suite('languagePairs', () => {
  const KEY = 'languagePairs';
  const cfg = () => vscode.workspace.getConfiguration('lingobridge');

  teardown(async () => {
    await cfg().update(KEY, undefined, vscode.ConfigurationTarget.Global);
  });

  test('returns defaults when nothing is configured', () => {
    const pairs = getLanguagePairs();
    assert.strictEqual(pairs.length, 2);
    assert.deepStrictEqual(
      pairs.map((p) => `${p.from}->${p.to}`).sort(),
      ['en->ja', 'ja->en']
    );
  });

  test('reads valid configured pairs', async () => {
    await cfg().update(
      KEY,
      [
        { from: 'ja', to: 'zh', label: '→ ZH' },
        { from: 'fr', to: 'de' }
      ],
      vscode.ConfigurationTarget.Global
    );
    const pairs = getLanguagePairs();
    assert.strictEqual(pairs.length, 2);
    assert.strictEqual(pairs[0].label, '→ ZH');
    assert.strictEqual(pairs[1].label, defaultLabel('de'));
  });

  test('rejects invalid codes / self-pairs / duplicates and falls back to defaults if all bad', async () => {
    await cfg().update(
      KEY,
      [
        { from: '##', to: 'en' }, // bad code
        { from: 'ja', to: 'ja' }, // self
        { from: 'ja', to: 'en' },
        { from: 'ja', to: 'en' } // dup
      ],
      vscode.ConfigurationTarget.Global
    );
    const pairs = getLanguagePairs();
    assert.strictEqual(pairs.length, 1);
    assert.strictEqual(pairs[0].from, 'ja');
    assert.strictEqual(pairs[0].to, 'en');
  });

  test('falls back to defaults when array becomes empty after sanitization', async () => {
    await cfg().update(
      KEY,
      [{ from: 'ja', to: 'ja' }, { from: 'xyz!', to: 'en' }],
      vscode.ConfigurationTarget.Global
    );
    const pairs = getLanguagePairs();
    assert.strictEqual(pairs.length, 2);
  });

  test('pairPickLabel composes tag + label', () => {
    assert.strictEqual(
      pairPickLabel({ from: 'ja', to: 'en', label: 'My label' }),
      'JA → EN  My label'
    );
    assert.strictEqual(pairPickLabel({ from: 'ja', to: 'en' }), 'JA → EN');
  });
});
