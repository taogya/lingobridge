import * as assert from 'assert';
import { DEFAULT_PROTECTION_TARGETS, protect, ProtectionTargetKey } from '../../src/protection';

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

  test('default targets only enable fencedCode/inlineCode/url (backward-compat)', () => {
    assert.deepStrictEqual(
      Object.fromEntries(
        Object.entries(DEFAULT_PROTECTION_TARGETS).filter(([, v]) => v === true)
      ),
      { fencedCode: true, inlineCode: true, url: true }
    );
  });

  // Round-trip per opt-in target (FUN-20).
  const cases: { key: ProtectionTargetKey; sample: string; mustHide: string[] }[] = [
    { key: 'markdownHeading', sample: '## 見出しテスト\n本文。', mustHide: ['## '] },
    {
      key: 'markdownTable',
      sample: '| col |\n| --- |\n| val |',
      mustHide: ['| --- |']
    },
    {
      key: 'markdownList',
      sample: '- item one\n- item two\n1. ordered',
      mustHide: ['- ', '1. ']
    },
    { key: 'shellCommand', sample: '$ npm install\n本文', mustHide: ['$ npm install'] },
    {
      key: 'filePath',
      sample: 'パス ./src/extension.ts と /usr/local/bin/atrans を参照',
      mustHide: ['./src/extension.ts', '/usr/local/bin/atrans']
    },
    {
      key: 'logLine',
      sample: '[INFO] start\n[2024-01-01T00:00:00] tick',
      mustHide: ['[INFO] ', '[2024-01-01T00:00:00] ']
    },
    {
      key: 'diffMarker',
      sample: '+ added line\n- removed line',
      mustHide: ['+ ', '- ']
    },
    {
      key: 'identifier',
      sample: 'snake_case と CamelCaseToken と kebab-case-id を保護',
      mustHide: ['snake_case', 'CamelCaseToken', 'kebab-case-id']
    }
  ];

  for (const c of cases) {
    test(`target '${c.key}' protects expected fragments and restores`, () => {
      const { protectedText, restore } = protect(c.sample, { [c.key]: true });
      for (const frag of c.mustHide) {
        assert.ok(
          !protectedText.includes(frag),
          `expected fragment '${frag}' to be stashed for ${c.key}, got: ${protectedText}`
        );
      }
      assert.strictEqual(restore(protectedText), c.sample);
    });
  }
});
