import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { LibreTranslateProvider } from '../../src/providers/libreTranslateProvider';

// v0.2.1 で修正する 4 件の Issue (#1〜#4) の再現/回帰テスト。

suite('Issue #1: 英語環境でローカライズキーが生のまま表示される', () => {
  // ランタイム文言は src 内では vscode.l10n.t('msg.xxx') を使っているが、
  // 既定 (en) 環境では bundle が読み込まれずキーがそのまま返る。
  // 修正後は English フォールバックが効くこと。
  test('vscode.l10n.t は en 環境ではキーを返す (現象再現)', () => {
    const out = vscode.l10n.t('ui.provider');
    // 直接 vscode.l10n.t を呼ぶとキーがそのまま返る (これが Issue #1)。
    assert.strictEqual(out, 'ui.provider');
  });

  test('tr() ヘルパーは en bundle にフォールバックする', async () => {
    const { tr } = await import('../../src/i18n');
    assert.strictEqual(tr('ui.provider'), 'Provider');
    assert.strictEqual(tr('msg.noActiveEditor'), 'lingobridge: No active editor.');
    // プレースホルダ展開も動く
    assert.strictEqual(
      tr('msg.translating', 'JA', 'EN'),
      'lingobridge: JA \u2192 EN translating\u2026'
    );
  });
});

suite('Issue #2: 履歴の「すべてクリア」ボタンが効かない', () => {
  // Webview 内では window.confirm() が常に undefined を返すため、
  // 現実装の `if (confirm(msg)) postMessage(...)` は決して true にならない。
  test('Webview HTML が壊れている window.confirm() に依存していないこと', async () => {
    const mod = await import('../../src/translateView');
    const proto: any = (mod as any).TranslateViewProvider.prototype;
    const html: string = proto.renderHtml.call({}, {} as vscode.Webview);
    assert.ok(
      !/\bconfirm\s*\(/.test(html),
      'webview HTML must not call confirm() (returns undefined in webview iframe)'
    );
  });
});

suite('Issue #3: LibreTranslate がアイドル後にネットワークエラーで失敗する', () => {
  test('socket reset 系のエラーは 1 回リトライされる', async function () {
    this.timeout(5000);
    const provider = new LibreTranslateProvider({ endpoint: 'http://127.0.0.1:9' });
    // global.fetch をモック: 1 回目は ECONNRESET 風、2 回目は 200 OK。
    const orig = global.fetch;
    let calls = 0;
    (global as any).fetch = async (_url: string, _init?: RequestInit): Promise<Response> => {
      calls += 1;
      if (calls === 1) {
        const e: any = new Error('socket hang up');
        e.code = 'ECONNRESET';
        throw e;
      }
      return new Response(JSON.stringify({ translatedText: 'hello' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    };
    try {
      const r = await provider.translate('やあ', {
        direction: { from: 'ja', to: 'en' },
        timeoutMs: 2000
      });
      assert.strictEqual(r.status, 'ok', r.errorMessage);
      assert.strictEqual(r.translatedText, 'hello');
      assert.strictEqual(calls, 2, 'should retry exactly once on socket reset');
    } finally {
      global.fetch = orig;
    }
  });
});

suite('Issue #4: tokenEstimator のエンジン切替がユーザーから判別できない', () => {
  test('エンジン名がメッセージテンプレートに含まれる', async () => {
    const { tr } = await import('../../src/i18n');
    const msg = tr('msg.tokensOf', '120 tok', 'selection', '300', 'tiktoken');
    assert.ok(
      /tiktoken/.test(msg),
      `expected the engine name in the info message, got: ${msg}`
    );
  });
});

suite('リソース確認', () => {
  test('l10n/bundle.l10n.json が package とともに同梱可能な位置にある', () => {
    const p = path.join(__dirname, '..', '..', '..', 'l10n', 'bundle.l10n.json');
    assert.ok(fs.existsSync(p), `not found: ${p}`);
  });
});
