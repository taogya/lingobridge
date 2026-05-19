import * as assert from 'assert';
import { protect } from '../../src/protection';

/**
 * v0.3.4 Phase 1 extra Markdown protection rules:
 *   mathBlock / mathInline / htmlInline / autoLink / referenceLink / taskList.
 *
 * Each rule must:
 *   1) Survive a destructive translator that strips common ASCII punctuation.
 *   2) Round-trip exactly when the translator is the identity function.
 *   3) Stay disabled when the user explicitly turns the target off.
 */

// Destructive: strips characters that MarianMT/LibreTranslate routinely drop.
function destroy(text: string): string {
  return text.replace(/[*_~\[\]()!<>$`]/g, '');
}

function roundtrip(input: string, modify: (s: string) => string = (s) => s): string {
  const { protectedText, restore } = protect(input);
  return restore(modify(protectedText));
}

suite('protection extra rules (v0.3.4 Phase 1)', () => {
  test('mathBlock: $$ ... $$ survives destructive stripper', () => {
    const src = 'See:\n$$\nE = mc^2\n$$\nThat is famous.';
    const restored = roundtrip(src, destroy);
    assert.ok(restored.includes('$$\nE = mc^2\n$$'), restored);
  });

  test('mathInline: inline math survives destructive stripper', () => {
    const src = 'Energy is $E = mc^2$ in Einstein\u2019s theory.';
    const restored = roundtrip(src, destroy);
    assert.ok(restored.includes('$E = mc^2$'), restored);
  });

  test('mathInline: ignores currency like `$10`', () => {
    const src = 'It costs $10 and another $20.';
    const { protectedText } = protect(src);
    // Should not stash; placeholder must NOT appear.
    assert.ok(!/\u27e6LB_/.test(protectedText), protectedText);
  });

  test('htmlInline: <kbd>/<br>/<sup> survive destructive stripper', () => {
    const src = 'Press <kbd>Ctrl</kbd>+<kbd>C</kbd>.<br>X<sup>2</sup>';
    const restored = roundtrip(src, destroy);
    assert.ok(restored.includes('<kbd>Ctrl</kbd>'), restored);
    assert.ok(restored.includes('<br>'), restored);
    assert.ok(restored.includes('<sup>2</sup>'), restored);
  });

  test('autoLink: <https://example.com> survives destructive stripper', () => {
    const src = 'Visit <https://example.com/path> for info.';
    const restored = roundtrip(src, destroy);
    assert.ok(restored.includes('<https://example.com/path>'), restored);
  });

  test('autoLink: <mailto:user@example.com> survives', () => {
    const src = 'Email <mailto:user@example.com> now.';
    const restored = roundtrip(src, destroy);
    assert.ok(restored.includes('<mailto:user@example.com>'), restored);
  });

  test('referenceLink: inline `[text][ref]` survives destructive stripper', () => {
    const src = 'See [the docs][docs] for details.\n\n[docs]: https://example.com';
    const restored = roundtrip(src, destroy);
    assert.ok(restored.includes('[the docs][docs]'), restored);
    assert.ok(restored.includes('[docs]: https://example.com'), restored);
  });

  test('taskList: `- [ ]` / `- [x]` markers survive destructive stripper', () => {
    const src = '- [ ] todo one\n- [x] done two\n- [X] done three';
    const restored = roundtrip(src, destroy);
    assert.ok(restored.includes('- [ ] todo one'), restored);
    assert.ok(restored.includes('- [x] done two'), restored);
    assert.ok(restored.includes('- [X] done three'), restored);
  });

  test('disabling mathInline lets destructive stripper remove `$`', () => {
    const src = 'Energy is $E = mc^2$ here.';
    const { protectedText, restore } = protect(src, {
      mathInline: false,
      mathBlock: false
    });
    const restored = restore(destroy(protectedText));
    assert.ok(!restored.includes('$E = mc^2$'), restored);
  });

  test('disabling autoLink lets destructive stripper remove `<>`', () => {
    const src = 'Visit <https://example.com> please.';
    const { protectedText, restore } = protect(src, {
      autoLink: false,
      url: false
    });
    const restored = restore(destroy(protectedText));
    assert.ok(!restored.includes('<https://example.com>'), restored);
  });

  test('identity translation round-trips exactly for combined markdown', () => {
    const src = [
      '# Heading',
      '',
      'Press <kbd>Ctrl</kbd>+<kbd>C</kbd> then visit <https://example.com>.',
      '',
      'Inline math $a^2 + b^2 = c^2$ and **bold**.',
      '',
      '$$',
      'f(x) = x^2',
      '$$',
      '',
      'See [the docs][docs].',
      '',
      '- [ ] task one',
      '- [x] task two',
      '',
      '[docs]: https://example.com/docs'
    ].join('\n');
    const restored = roundtrip(src);
    assert.strictEqual(restored, src);
  });
});
