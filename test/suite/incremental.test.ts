import * as assert from 'assert';
import { hashBlock, splitBlocks, translateIncremental } from '../../src/incremental';
import { TranslateResult, TranslationDirection } from '../../src/providers/translationProvider';

suite('incremental', () => {
  test('splitBlocks splits markdown by headings and blank lines', () => {
    const md = '# Title\n\nIntro paragraph.\n\n## Section\n\nBody.';
    const blocks = splitBlocks(md, 'markdown').filter((b) => !b.passthrough);
    assert.strictEqual(blocks.length, 4);
    assert.strictEqual(blocks[0].text, '# Title');
    assert.strictEqual(blocks[1].text, 'Intro paragraph.');
    assert.strictEqual(blocks[2].text, '## Section');
    assert.strictEqual(blocks[3].text, 'Body.');
  });

  test('splitBlocks splits plain text by blank lines', () => {
    const txt = 'First para.\nSecond line.\n\nNext para.';
    const blocks = splitBlocks(txt, 'plaintext').filter((b) => !b.passthrough);
    assert.strictEqual(blocks.length, 2);
    assert.strictEqual(blocks[0].text, 'First para.\nSecond line.');
    assert.strictEqual(blocks[1].text, 'Next para.');
  });

  test('hashBlock is deterministic and differs for different content', () => {
    assert.strictEqual(hashBlock('abc'), hashBlock('abc'));
    assert.notStrictEqual(hashBlock('abc'), hashBlock('abcd'));
  });

  // Helper translator: uppercases input. Counts how many times it's called.
  const makeUpcase = () => {
    const calls: string[] = [];
    const fn = async (text: string, _dir: TranslationDirection): Promise<TranslateResult> => {
      calls.push(text);
      return { status: 'ok', translatedText: text.toUpperCase() };
    };
    return { fn, calls };
  };

  const dir: TranslationDirection = { from: 'ja', to: 'en' };

  test('only the changed block is re-translated, order is preserved', async () => {
    const src1 = 'Para A.\n\nPara B.\n\nPara C.';
    const upcase1 = makeUpcase();
    const first = await translateIncremental({
      source: src1,
      languageId: 'plaintext',
      direction: dir,
      translator: upcase1.fn
    });
    assert.strictEqual(first.stats.total, 3);
    assert.strictEqual(first.stats.translated, 3);
    assert.strictEqual(first.stats.reused, 0);
    assert.strictEqual(upcase1.calls.length, 3);

    const src2 = 'Para A.\n\nPara B changed.\n\nPara C.';
    const upcase2 = makeUpcase();
    const second = await translateIncremental({
      source: src2,
      languageId: 'plaintext',
      direction: dir,
      cache: first.sidecar,
      translator: upcase2.fn
    });
    assert.strictEqual(second.stats.total, 3);
    assert.strictEqual(second.stats.translated, 1);
    assert.strictEqual(second.stats.reused, 2);
    assert.strictEqual(upcase2.calls.length, 1);
    assert.ok(upcase2.calls[0].includes('B changed'));
    // Order preserved: A → B → C in output.
    const out = second.stats.outputText;
    const ai = out.indexOf('PARA A');
    const bi = out.indexOf('PARA B CHANGED');
    const ci = out.indexOf('PARA C');
    assert.ok(ai >= 0 && bi > ai && ci > bi, `order broken: ${out}`);
  });

  test('whitespace-only differences do not trigger re-translation', async () => {
    const src1 = 'Hello world.\n\nSecond.';
    const upcase1 = makeUpcase();
    const first = await translateIncremental({
      source: src1,
      languageId: 'plaintext',
      direction: dir,
      translator: upcase1.fn
    });
    assert.strictEqual(first.stats.translated, 2);

    // Add trailing spaces and an extra blank line — content unchanged.
    const src2 = 'Hello world.   \n\n\nSecond.   ';
    const upcase2 = makeUpcase();
    const second = await translateIncremental({
      source: src2,
      languageId: 'plaintext',
      direction: dir,
      cache: first.sidecar,
      translator: upcase2.fn
    });
    assert.strictEqual(second.stats.translated, 0);
    assert.strictEqual(second.stats.reused, 2);
    assert.strictEqual(upcase2.calls.length, 0);
  });

  test('markdown tables keep one-line row boundaries in output', async () => {
    const src = '# Summary\n\n| Key | Value |\n| --- | --- |\n| 1 | One |\n';
    const wrap = async (text: string, _dir: TranslationDirection): Promise<TranslateResult> => ({
      status: 'ok',
      translatedText: `[${text}]`
    });

    const out = await translateIncremental({
      source: src,
      languageId: 'markdown',
      direction: dir,
      translator: wrap
    });

    assert.strictEqual(
      out.stats.outputText,
      '[# Summary]\n\n[| Key | Value |]\n[| --- | --- |]\n[| 1 | One |]\n'
    );
  });
});
