import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  looksLikeMarkdown,
  splitBlocks,
  translateIncremental
} from '../../src/incremental';
import { protect } from '../../src/protection';
import { TranslateResult, TranslationDirection } from '../../src/providers/translationProvider';

/**
 * v0.3.5 — closes the remaining branches of Issue #7 and Issue #9.
 *
 * Issue #7 (v0.3.4 残課題):
 *   ドキュメント翻訳 (Ctrl+Alt+E) と Translate パネルでの出力が一致しない。
 *   原因は TranslateViewProvider が `vscode.window.activeTextEditor` を
 *   読みに行くが、Activity Bar の Webview にフォーカスがある間は
 *   `undefined` を返すため `languageId` が落ち、Markdown 構造分割が
 *   バイパスされて段落丸ごと (`#` / `|` / `-` を含む) が破壊的モデルに
 *   渡されていた。
 *   修正: `splitBlocks` に内容ベース Markdown スニッファを追加し、
 *   `languageId` 不明時でも Markdown を検出して構造行を分割する。
 *
 * Issue #9 (Windows で Ctrl+Alt+L が機能しない):
 *   JP/EU 配列では `Ctrl+Alt+<letter>` が AltGr+<letter> として消費され、
 *   キーバインドが発火しない。`win:` オーバライドで `Ctrl+Alt+Shift+…`
 *   に切り替え、AltGr が掴まないようにする。
 */

const dir: TranslationDirection = { from: 'ja', to: 'en' };

// Mirror real-world destructive translators (transformers / libretranslate
// short-form): strip every Markdown punctuation char, keep words.
function makeDestructive(): (text: string, _dir: TranslationDirection) => Promise<TranslateResult> {
  return async (text: string, _dir: TranslationDirection): Promise<TranslateResult> => {
    const cleaned = text.replace(/[*_~\[\]()!#>|\-]/g, '');
    return { status: 'ok', translatedText: cleaned };
  };
}

// Same destructive model wrapped with the default protection pipeline —
// mirrors `translationService.translateText` so the test exercises the
// real production path.
function makeDestructiveWithProtection(): (text: string, _dir: TranslationDirection) => Promise<TranslateResult> {
  const inner = makeDestructive();
  return async (text: string, d: TranslationDirection): Promise<TranslateResult> => {
    const { protectedText, restore } = protect(text);
    const r = await inner(protectedText, d);
    if (r.status === 'ok' && r.translatedText !== undefined) {
      return { ...r, translatedText: restore(r.translatedText) };
    }
    return r;
  };
}

function makeDotMutatingWithProtection(): (text: string, _dir: TranslationDirection) => Promise<TranslateResult> {
  return async (text: string, _dir: TranslationDirection): Promise<TranslateResult> => {
    const { protectedText, restore } = protect(text);
    const mutated = protectedText.replace(/⟦LB_(\d+)⟧/g, '.LB_$1.');
    return { status: 'ok', translatedText: restore(mutated) };
  };
}

suite('Issue #7 (v0.3.5): panel vs file translation must produce identical output', () => {
  const markdownSample = [
    '# 今日は空気がやわらかく、過ごしやすい一日だった。',
    '- 朝は少しひんやりしていた。',
    '',
    '## 風も穏やかで、外を歩くと気分が落ち着いた。',
    '',
    '| 回 | 感想 |',
    '| --- | --- |',
    '| 1 | 余裕が生まれる。 |',
    ''
  ].join('\n');

  test('looksLikeMarkdown detects headings / lists / tables / fenced blocks', () => {
    assert.strictEqual(looksLikeMarkdown('# Title'), true, 'heading');
    assert.strictEqual(looksLikeMarkdown('- item'), true, 'list');
    assert.strictEqual(looksLikeMarkdown('> quote'), true, 'quote');
    assert.strictEqual(looksLikeMarkdown('| a | b |'), true, 'table');
    assert.strictEqual(looksLikeMarkdown('```\ncode\n```'), true, 'fence');
    assert.strictEqual(looksLikeMarkdown('Just a sentence.'), false, 'plain');
    assert.strictEqual(looksLikeMarkdown(''), false, 'empty');
  });

  test('splitBlocks(undefined languageId) sniffs markdown content', () => {
    const sniffed = splitBlocks(markdownSample, undefined).filter((b) => !b.passthrough);
    const plain = splitBlocks(markdownSample, 'plaintext').filter((b) => !b.passthrough);
    // Sniffed path must split per-structural-line (heading + list + headings
    // + table rows), so it produces strictly more blocks than the plain
    // paragraph split.
    assert.ok(
      sniffed.length > plain.length,
      `markdown sniff should produce more blocks, sniffed=${sniffed.length} plain=${plain.length}`
    );
    // Every structural block must carry `parts` so the translator only ever
    // sees the translatable text portion.
    const structural = sniffed.filter((b) => Array.isArray(b.parts));
    assert.ok(structural.length >= 4, `expected ≥4 structural blocks, got ${structural.length}`);
  });

  test('panel path (no languageId) yields the SAME output as file path (languageId=markdown)', async () => {
    const filePath = await translateIncremental({
      source: markdownSample,
      languageId: 'markdown',
      direction: dir,
      translator: makeDestructiveWithProtection()
    });
    // Simulate the panel: `vscode.window.activeTextEditor` was undefined
    // when the user pressed Translate, so languageId is unavailable.
    const panelPath = await translateIncremental({
      source: markdownSample,
      languageId: undefined,
      direction: dir,
      translator: makeDestructiveWithProtection()
    });
    assert.strictEqual(
      panelPath.stats.outputText,
      filePath.stats.outputText,
      'panel translation must match file translation byte-for-byte'
    );
  });

  test('structural markers survive on the panel path even though languageId is unknown', async () => {
    const out = await translateIncremental({
      source: markdownSample,
      languageId: undefined,
      direction: dir,
      translator: makeDestructiveWithProtection()
    });
    const text = out.stats.outputText;
    assert.match(text, /^# /m, 'heading marker must survive on panel path');
    assert.match(text, /^## /m, 'second-level heading must survive');
    assert.match(text, /^- /m, 'list marker must survive');
    assert.match(text, /^\| --- \| --- \|$/m, 'table separator row must pass through verbatim');
  });

  test('non-markdown plain text is unaffected by the sniffer (no false positives)', async () => {
    const src = 'これは普通の段落です。\n\n別の段落。';
    const sniffed = await translateIncremental({
      source: src,
      languageId: undefined,
      direction: dir,
      translator: makeDestructiveWithProtection()
    });
    const plain = await translateIncremental({
      source: src,
      languageId: 'plaintext',
      direction: dir,
      translator: makeDestructiveWithProtection()
    });
    assert.strictEqual(sniffed.stats.outputText, plain.stats.outputText);
  });

  test('splitBlocks treats fenced code blocks as passthrough blocks', () => {
    const src = [
      '## 見出し',
      '',
      '```',
      '天気が安定していると、普段より前向きな気持ちになれる。',
      '```',
      '',
      '| 回 | 感想 |',
      '| --- | --- |'
    ].join('\n');
    const blocks = splitBlocks(src, undefined);
    assert.ok(
      blocks.some((b) => b.passthrough && b.raw === '```\n天気が安定していると、普段より前向きな気持ちになれる。\n```\n'),
      'fenced code block should bypass translation as one raw passthrough span'
    );
  });

  test('fenced code blocks do not grow synthetic dots when placeholder-like models mutate tokens', async () => {
    const src = [
      '# Today was a soft day and easy to spend.',
      '- I was a little nervous in the morning, but as the sun fell in the afternoon, the view of the city looked bright.',
      '',
      '## The wind was calm, and walking out felt calm.',
      '```',
      '天気が安定していると、普段より前向きな気持ちになれる。',
      '```',
      '| & Time | What\'s the point? |',
      '|---|---|',
      '| 1 | I felt that looking up at the sky gave me a little bit of room in my mind in the busy day. |'
    ].join('\n');
    const out = await translateIncremental({
      source: src,
      languageId: undefined,
      direction: dir,
      translator: makeDotMutatingWithProtection()
    });
    assert.strictEqual(out.stats.outputText, src);
    assert.ok(!out.stats.outputText.includes('.```'), 'opening fence must not gain a leading dot');
    assert.ok(!out.stats.outputText.includes('```.'), 'closing fence must not gain a trailing dot');
  });
});

suite('Issue #9 (v0.3.5): Windows keybindings avoid Ctrl+Alt AltGr conflict', () => {
  function getBindings(): Array<Record<string, string>> {
    const ext = vscode.extensions.getExtension('taogya.lingobridge')!;
    const contrib = ext.packageJSON.contributes as Record<string, unknown>;
    return contrib.keybindings as Array<Record<string, string>>;
  }

  test('every default Ctrl+Alt+<letter> binding has a win override using Ctrl+Alt+Shift+…', () => {
    const bindings = getBindings();
    const ctrlAltOnly = bindings.filter(
      (b) => /^ctrl\+alt\+[a-z]$/i.test(b.key) && !/shift/i.test(b.key)
    );
    assert.ok(ctrlAltOnly.length > 0, 'expected at least one Ctrl+Alt+<letter> binding');
    for (const b of ctrlAltOnly) {
      assert.ok(b.win, `${b.command}: missing win override`);
      assert.match(
        b.win,
        /^ctrl\+(alt\+)?shift\+/i,
        `${b.command}: win override must include Shift to bypass AltGr (got "${b.win}")`
      );
    }
  });

  test('win overrides are unique (no two commands share the same Windows shortcut)', () => {
    const bindings = getBindings();
    const seen = new Map<string, string>();
    for (const b of bindings) {
      if (!b.win) continue;
      const prior = seen.get(b.win);
      assert.ok(
        !prior,
        `win shortcut "${b.win}" is assigned to both ${prior} and ${b.command}`
      );
      seen.set(b.win, b.command);
    }
  });

  test('translateDocument and focusTranslateView both have working win overrides', () => {
    const bindings = getBindings();
    const td = bindings.find((b) => b.command === 'lingobridge.translateDocument');
    const fv = bindings.find((b) => b.command === 'lingobridge.focusTranslateView');
    assert.ok(td?.win, 'translateDocument must define win override');
    assert.ok(fv?.win, 'focusTranslateView must define win override');
    assert.notStrictEqual(td!.win, fv!.win, 'win overrides must differ');
  });
});
