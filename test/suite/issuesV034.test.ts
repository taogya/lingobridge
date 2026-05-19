import * as assert from 'assert';
import { translateIncremental } from '../../src/incremental';
import { protect } from '../../src/protection';
import { TranslateResult, TranslationDirection } from '../../src/providers/translationProvider';

/**
 * Issue #7 follow-up for v0.3.4.
 *
 * v0.3.2/0.3.3 fixed *line-level* markdown markers (`#`, `>`, `|`, `-`)
 * by splitting structural lines into literal markup + translatable text.
 * The reporter however still observes broken output on v0.3.3 with
 * `transformers` because the same destructive model also strips **inline**
 * markdown markers — `**bold**`, `__bold__`, `~~strike~~`, `[text](url)`,
 * `![alt](src)` — that live inside paragraph / structural text content.
 *
 * These reproducers fail before the fix and pass once `inlineEmphasis` /
 * `markdownLink` protection rules are added to the default protection set.
 */

const dir: TranslationDirection = { from: 'ja', to: 'en' };

// Destructive translator: strips all common inline markdown punctuation that
// MarianMT / LibreTranslate routinely drop. Mirrors real-world model behaviour.
function makeInlineStripper(): (text: string, _dir: TranslationDirection) => Promise<TranslateResult> {
  return async (text: string, _dir: TranslationDirection): Promise<TranslateResult> => {
    const cleaned = text.replace(/[*_~\[\]()!]/g, '');
    return { status: 'ok', translatedText: cleaned };
  };
}

// Protection-wrapped translator. Uses default protection targets so the test
// exercises the same path as the production code (translateText → protect).
function makeProtectedStripper(): (text: string, _dir: TranslationDirection) => Promise<TranslateResult> {
  const stripper = makeInlineStripper();
  return async (text: string, d: TranslationDirection): Promise<TranslateResult> => {
    const { protectedText, restore } = protect(text);
    const r = await stripper(protectedText, d);
    if (r.status === 'ok' && r.translatedText !== undefined) {
      return { ...r, translatedText: restore(r.translatedText) };
    }
    return r;
  };
}

suite('Issue #7 (v0.3.4): inline markdown markers survive destructive translation', () => {
  test('bold (**word**) markers survive in paragraph text', async () => {
    const src = 'これは**重要**な文章です。';
    const out = await translateIncremental({
      source: src,
      languageId: 'markdown',
      direction: dir,
      translator: makeProtectedStripper()
    });
    assert.ok(
      out.stats.outputText.includes('**重要**'),
      `bold markers must survive, got: ${out.stats.outputText}`
    );
  });

  test('underscore bold (__word__) markers survive', async () => {
    const src = 'Plain __strong__ word.';
    const out = await translateIncremental({
      source: src,
      languageId: 'markdown',
      direction: dir,
      translator: makeProtectedStripper()
    });
    assert.ok(
      out.stats.outputText.includes('__strong__'),
      `underscore bold markers must survive, got: ${out.stats.outputText}`
    );
  });

  test('strikethrough (~~word~~) markers survive', async () => {
    const src = 'これは~~削除済み~~の項目です。';
    const out = await translateIncremental({
      source: src,
      languageId: 'markdown',
      direction: dir,
      translator: makeProtectedStripper()
    });
    assert.ok(
      out.stats.outputText.includes('~~削除済み~~'),
      `strikethrough markers must survive, got: ${out.stats.outputText}`
    );
  });

  test('inline link [text](url) survives in paragraph', async () => {
    const src = '詳細は[ドキュメント](https://example.com/docs)を参照。';
    const out = await translateIncremental({
      source: src,
      languageId: 'markdown',
      direction: dir,
      translator: makeProtectedStripper()
    });
    const text = out.stats.outputText;
    assert.ok(
      text.includes('[ドキュメント](https://example.com/docs)'),
      `markdown link must survive, got: ${text}`
    );
  });

  test('image link ![alt](src) survives in paragraph', async () => {
    const src = 'ロゴ: ![logo](https://example.com/logo.png) 終わり。';
    const out = await translateIncremental({
      source: src,
      languageId: 'markdown',
      direction: dir,
      translator: makeProtectedStripper()
    });
    const text = out.stats.outputText;
    assert.ok(
      text.includes('![logo](https://example.com/logo.png)'),
      `image link must survive, got: ${text}`
    );
  });

  test('inline markdown survives even inside structural lines (heading / list / quote)', async () => {
    const src = [
      '# **太字**の見出し',
      '',
      '- **項目** with [link](https://example.com)',
      '',
      '> ~~取り消し~~の引用'
    ].join('\n');
    const out = await translateIncremental({
      source: src,
      languageId: 'markdown',
      direction: dir,
      translator: makeProtectedStripper()
    });
    const text = out.stats.outputText;
    assert.match(text, /^# \*\*太字\*\*の見出し$/m, `heading bold must survive: ${text}`);
    assert.match(
      text,
      /^- \*\*項目\*\* with \[link\]\(https:\/\/example\.com\)$/m,
      `list bold + link must survive: ${text}`
    );
    assert.match(text, /^> ~~取り消し~~の引用$/m, `quote strikethrough must survive: ${text}`);
  });

  test('inline markdown round-trips inside a markdown table cell', async () => {
    const src = [
      '| 項目 | 説明 |',
      '| --- | --- |',
      '| **重要** | [リンク](https://example.com) |'
    ].join('\n');
    const out = await translateIncremental({
      source: src,
      languageId: 'markdown',
      direction: dir,
      translator: makeProtectedStripper()
    });
    const text = out.stats.outputText;
    assert.match(
      text,
      /^\| \*\*重要\*\* \| \[リンク\]\(https:\/\/example\.com\) \|$/m,
      `table cell inline markdown must survive: ${text}`
    );
  });

  test('protection layer (direct) round-trips inline emphasis and links', () => {
    const src = '**bold** and __strong__ and ~~strike~~ and [link](https://example.com).';
    const { protectedText, restore } = protect(src);
    // The translator only sees the inner text, no markers.
    assert.ok(!protectedText.includes('**'), `bold markers must be stashed: ${protectedText}`);
    assert.ok(!protectedText.includes('~~'), `strike markers must be stashed: ${protectedText}`);
    assert.ok(!protectedText.includes('[link]'), `link bracket must be stashed: ${protectedText}`);
    assert.ok(
      !protectedText.includes('https://example.com'),
      `link URL must be stashed (also covered by url rule): ${protectedText}`
    );
    // After a no-op translation, restore returns the original verbatim.
    assert.strictEqual(restore(protectedText), src);
  });

  test('protection layer round-trips when model only strips markdown punctuation', () => {
    // Real MarianMT / LibreTranslate models keep the placeholder glyphs
    // (`⟦` / `⟧` are passed through as unknown tokens) but happily strip
    // every `*` / `_` / `~` / `[` / `]` / `(` / `)` / `!` they see — which
    // is exactly the case our protection layer must handle.
    const src = 'See **bold** text or visit [docs](https://example.com).';
    const { protectedText, restore } = protect(src);
    const corrupted = protectedText.replace(/[*_~\[\]()!]/g, '');
    const restored = restore(corrupted);
    assert.ok(restored.includes('**bold**'), `bold must round-trip: ${restored}`);
    assert.ok(
      restored.includes('[docs](https://example.com)'),
      `link must round-trip: ${restored}`
    );
  });
});
