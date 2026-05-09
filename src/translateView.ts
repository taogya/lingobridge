import * as vscode from 'vscode';
import { getActiveProvider } from './providers/providerRegistry';
import { LanguageCode } from './providers/translationProvider';
import { estimateTokensWith, formatTokens, TokenEngine } from './tokenEstimator';
import { openTranslationInNewTab, translateText } from './translationService';

interface InMessage {
  type: 'translate' | 'estimate' | 'copy' | 'openInTab' | 'openSettings' | 'ready';
  text?: string;
  from?: LanguageCode;
  to?: LanguageCode;
}

interface OutMessage {
  type: 'inputTokens' | 'resultTokens' | 'result' | 'error' | 'state';
  text?: string;
  tokens?: string;
  state?: {
    providerLabel: string;
    providerAvailable: boolean;
    providerDetail?: string;
    translateOnEnter: boolean;
  };
}

export class TranslateViewProvider implements vscode.WebviewViewProvider {
  static readonly viewId = 'lingobridge.translatePanel';

  private view: vscode.WebviewView | undefined;
  private lastResult = '';
  private lastTargetLang: LanguageCode = 'en';

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.renderHtml(view.webview);
    view.webview.onDidReceiveMessage((m: InMessage) => this.onMessage(m));

    // Keep state updated when settings change.
    const sub = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('lingobridge')) this.postState();
    });
    view.onDidDispose(() => sub.dispose());
  }

  private async onMessage(m: InMessage): Promise<void> {
    switch (m.type) {
      case 'ready':
        this.postState();
        break;
      case 'estimate': {
        const engine = vscode.workspace
          .getConfiguration('lingobridge')
          .get<TokenEngine>('tokenEstimator.engine', 'heuristic');
        const n = estimateTokensWith(engine, m.text ?? '');
        this.post({ type: 'inputTokens', tokens: formatTokens(n) });
        break;
      }
      case 'translate': {
        const from = (m.from ?? 'ja') as LanguageCode;
        const to = (m.to ?? 'en') as LanguageCode;
        this.lastTargetLang = to;
        const text = m.text ?? '';
        if (!text.trim()) {
          this.post({ type: 'error', text: '入力テキストが空です。' });
          return;
        }
        try {
          const result = await translateText(text, { from, to });
          if (result.status === 'ok' && result.translatedText !== undefined) {
            this.lastResult = result.translatedText;
            this.post({ type: 'result', text: result.translatedText });
            const engine = vscode.workspace
              .getConfiguration('lingobridge')
              .get<TokenEngine>('tokenEstimator.engine', 'heuristic');
            this.post({
              type: 'resultTokens',
              tokens: formatTokens(estimateTokensWith(engine, result.translatedText))
            });
          } else {
            this.post({
              type: 'error',
              text: result.errorMessage ?? '翻訳に失敗しました。'
            });
          }
        } catch (e) {
          this.post({
            type: 'error',
            text: e instanceof Error ? e.message : '不明なエラー'
          });
        }
        break;
      }
      case 'copy': {
        if (this.lastResult) {
          await vscode.env.clipboard.writeText(this.lastResult);
          vscode.window.setStatusBarMessage('lingobridge: 結果をコピーしました', 2000);
        }
        break;
      }
      case 'openInTab': {
        if (!this.lastResult) return;
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          await openTranslationInNewTab(editor.document, this.lastTargetLang, this.lastResult);
        } else {
          // No active editor: open as plain untitled.
          const doc = await vscode.workspace.openTextDocument({ content: this.lastResult });
          await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside });
        }
        break;
      }
      case 'openSettings':
        await vscode.commands.executeCommand(
          'workbench.action.openSettings',
          '@ext:taogya.lingobridge'
        );
        break;
    }
  }

  private async postState(): Promise<void> {
    const provider = getActiveProvider();
    const avail = await provider.checkAvailability();
    const translateOnEnter = vscode.workspace
      .getConfiguration('lingobridge')
      .get<boolean>('input.translateOnEnter', true);
    this.post({
      type: 'state',
      state: {
        providerLabel: provider.displayName,
        providerAvailable: avail.available,
        providerDetail: avail.detail,
        translateOnEnter
      }
    });
  }

  private post(msg: OutMessage): void {
    this.view?.webview.postMessage(msg);
  }

  private renderHtml(_webview: vscode.Webview): string {
    const nonce = makeNonce();
    return /* html */ `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
<title>lingobridge</title>
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground);
         background: var(--vscode-sideBar-background); margin: 0; padding: 8px; font-size: 12px; }
  h3 { font-size: 11px; text-transform: uppercase; color: var(--vscode-descriptionForeground);
       letter-spacing: .5px; margin: 10px 0 4px; }
  .row { display: flex; gap: 6px; }
  .row > * { flex: 1; }
  button {
    background: var(--vscode-button-secondaryBackground, #3a3d41);
    color: var(--vscode-button-secondaryForeground, #fff);
    border: 1px solid var(--vscode-button-border, transparent);
    padding: 5px 8px; border-radius: 2px; cursor: pointer; font-size: 12px;
  }
  button.primary {
    background: var(--vscode-button-background); color: var(--vscode-button-foreground);
  }
  button.active {
    background: var(--vscode-button-background); color: var(--vscode-button-foreground);
  }
  button:disabled { opacity: .5; cursor: default; }
  textarea, .result {
    width: 100%; box-sizing: border-box;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 2px; padding: 6px; font-family: var(--vscode-editor-font-family);
    font-size: 12px; resize: vertical; min-height: 90px;
  }
  textarea:focus { outline: 1px solid var(--vscode-focusBorder); }
  .meta { display: flex; justify-content: space-between;
          color: var(--vscode-descriptionForeground); font-size: 11px; margin-top: 3px; }
  .provider {
    display: flex; align-items: center; justify-content: space-between;
    background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 2px; padding: 6px 8px;
  }
  .badge { font-size: 10px; padding: 1px 6px; border-radius: 8px; }
  .badge.ok { background: var(--vscode-testing-iconPassed, #2d4f2d); color: #fff; }
  .badge.warn { background: var(--vscode-testing-iconFailed, #5a4a1a); color: #fff; }
  .result { white-space: pre-wrap; min-height: 90px; }
  .error { color: var(--vscode-errorForeground); margin-top: 6px; font-size: 11px; }
  .actions { display: flex; gap: 6px; margin-top: 6px; }
  .actions button { flex: none; }
</style>
</head>
<body>
  <h3>プロバイダ</h3>
  <div class="provider">
    <span id="providerLabel">—</span>
    <span class="badge" id="providerBadge">—</span>
  </div>

  <h3>方向</h3>
  <div class="row">
    <button id="dirJaEn" class="active">日本語 → English</button>
    <button id="dirEnJa">English → 日本語</button>
  </div>

  <h3>入力</h3>
  <textarea id="input" placeholder="翻訳したいテキストを入力"></textarea>
  <div class="meta">
    <span id="inputChars">0 字</span>
    <span id="inputTokens">0 tok</span>
  </div>
  <div class="actions">
    <button id="run" class="primary" style="flex:1;">翻訳実行</button>
  </div>
  <div id="error" class="error"></div>

  <h3>結果</h3>
  <div id="result" class="result"></div>
  <div class="meta">
    <span></span>
    <span id="resultTokens">0 tok</span>
  </div>
  <div class="actions">
    <button id="copy">コピー</button>
    <button id="openTab">新規タブで開く</button>
  </div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  let dir = { from: 'ja', to: 'en' };
  let translateOnEnter = true;

  function setDir(from, to) {
    dir = { from, to };
    $('dirJaEn').classList.toggle('active', from === 'ja');
    $('dirEnJa').classList.toggle('active', from === 'en');
  }
  $('dirJaEn').onclick = () => setDir('ja', 'en');
  $('dirEnJa').onclick = () => setDir('en', 'ja');

  function runTranslate() {
    if ($('run').disabled) return;
    $('error').textContent = '';
    $('run').disabled = true;
    $('run').textContent = '翻訳中…';
    vscode.postMessage({ type: 'translate', text: $('input').value, from: dir.from, to: dir.to });
  }

  let estimateTimer;
  $('input').addEventListener('input', () => {
    const t = $('input').value;
    $('inputChars').textContent = Array.from(t).length + ' 字';
    clearTimeout(estimateTimer);
    estimateTimer = setTimeout(() => {
      vscode.postMessage({ type: 'estimate', text: t });
    }, 80);
  });
  $('input').addEventListener('keydown', (e) => {
    // Enter alone -> translate. Shift+Enter / IME composition -> insert newline as usual.
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && translateOnEnter) {
      e.preventDefault();
      runTranslate();
    }
  });

  $('run').onclick = runTranslate;
  $('copy').onclick = () => vscode.postMessage({ type: 'copy' });
  $('openTab').onclick = () => vscode.postMessage({ type: 'openInTab' });

  window.addEventListener('message', (event) => {
    const m = event.data;
    if (m.type === 'inputTokens') $('inputTokens').textContent = m.tokens;
    if (m.type === 'resultTokens') $('resultTokens').textContent = m.tokens;
    if (m.type === 'result') {
      $('result').textContent = m.text;
      $('run').disabled = false;
      $('run').textContent = '翻訳実行';
    }
    if (m.type === 'error') {
      $('error').textContent = m.text;
      $('run').disabled = false;
      $('run').textContent = '翻訳実行';
    }
    if (m.type === 'state' && m.state) {
      $('providerLabel').textContent = m.state.providerLabel;
      const b = $('providerBadge');
      b.textContent = m.state.providerAvailable ? '利用可' : '未検出';
      b.className = 'badge ' + (m.state.providerAvailable ? 'ok' : 'warn');
      b.title = m.state.providerDetail || '';
      translateOnEnter = !!m.state.translateOnEnter;
      $('input').placeholder = translateOnEnter
        ? '翻訳したいテキストを入力 (Enter で翻訳 / Shift+Enter で改行)'
        : '翻訳したいテキストを入力';
    }
  });

  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
  }
}

function makeNonce(): string {
  let s = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}
