import * as vscode from 'vscode';
import { HistoryEntry, HistoryStore } from './history';
import { getLanguagePairs, LanguagePair } from './languagePairs';
import { getActiveProvider } from './providers/providerRegistry';
import { LanguageCode } from './providers/translationProvider';
import { estimateTokensWith, formatTokens, TokenEngine } from './tokenEstimator';
import { openTranslationInNewTab, translateText } from './translationService';

interface InMessage {
  type:
    | 'translate'
    | 'estimate'
    | 'copy'
    | 'openInTab'
    | 'openSettings'
    | 'ready'
    | 'historyDelete'
    | 'historyClear'
    | 'historyRestore';
  text?: string;
  from?: LanguageCode;
  to?: LanguageCode;
  id?: string;
}

interface PairView {
  from: LanguageCode;
  to: LanguageCode;
  label: string;
}

interface UiStrings {
  provider: string;
  direction: string;
  input: string;
  run: string;
  running: string;
  result: string;
  copy: string;
  openInTab: string;
  history: string;
  historyEmpty: string;
  historyClearAll: string;
  restore: string;
  delete: string;
  placeholder: string;
  placeholderEnter: string;
  badgeOk: string;
  badgeWarn: string;
  errInputEmpty: string;
  errUnknown: string;
  pairUnsupported: string;
  charsSuffix: string;
  confirmClearAll: string;
}

interface OutMessage {
  type: 'inputTokens' | 'resultTokens' | 'result' | 'error' | 'state' | 'history' | 'restore';
  text?: string;
  tokens?: string;
  state?: {
    providerLabel: string;
    providerAvailable: boolean;
    providerDetail?: string;
    translateOnEnter: boolean;
    pairs: PairView[];
    ui: UiStrings;
  };
  entries?: HistoryEntry[];
  entry?: HistoryEntry;
}

export class TranslateViewProvider implements vscode.WebviewViewProvider {
  static readonly viewId = 'lingobridge.translatePanel';

  private view: vscode.WebviewView | undefined;
  private lastResult = '';
  private lastTargetLang: LanguageCode = 'en';
  private historySub: vscode.Disposable | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly history: HistoryStore
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.renderHtml(view.webview);
    view.webview.onDidReceiveMessage((m: InMessage) => this.onMessage(m));

    const cfgSub = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('lingobridge')) {
        this.postState();
        this.postHistory();
      }
    });
    this.historySub?.dispose();
    this.historySub = this.history.onDidChange(() => this.postHistory());
    view.onDidDispose(() => {
      cfgSub.dispose();
      this.historySub?.dispose();
      this.historySub = undefined;
    });
  }

  private async onMessage(m: InMessage): Promise<void> {
    switch (m.type) {
      case 'ready':
        this.postState();
        this.postHistory();
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
          this.post({ type: 'error', text: vscode.l10n.t('ui.errInputEmpty') });
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
            const inputTokens = estimateTokensWith(engine, text);
            const outputTokens = estimateTokensWith(engine, result.translatedText);
            this.post({ type: 'resultTokens', tokens: formatTokens(outputTokens) });
            await this.history.add({
              from,
              to,
              input: text,
              output: result.translatedText,
              inputTokens,
              outputTokens
            });
          } else {
            this.post({
              type: 'error',
              text: result.errorMessage ?? vscode.l10n.t('ui.errUnknown')
            });
          }
        } catch (e) {
          this.post({
            type: 'error',
            text: e instanceof Error ? e.message : vscode.l10n.t('ui.errUnknown')
          });
        }
        break;
      }
      case 'copy': {
        if (this.lastResult) {
          await vscode.env.clipboard.writeText(this.lastResult);
          vscode.window.setStatusBarMessage(vscode.l10n.t('msg.resultCopied'), 2000);
        }
        break;
      }
      case 'openInTab': {
        if (!this.lastResult) return;
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          await openTranslationInNewTab(editor.document, this.lastTargetLang, this.lastResult);
        } else {
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
      case 'historyDelete':
        if (m.id) await this.history.remove(m.id);
        break;
      case 'historyClear':
        await this.history.clear();
        break;
      case 'historyRestore': {
        const entry = this.history.list().find((e) => e.id === m.id);
        if (entry) this.post({ type: 'restore', entry });
        break;
      }
    }
  }

  private async postState(): Promise<void> {
    const provider = getActiveProvider();
    const avail = await provider.checkAvailability();
    const translateOnEnter = vscode.workspace
      .getConfiguration('lingobridge')
      .get<boolean>('input.translateOnEnter', true);
    const pairs: PairView[] = getLanguagePairs().map((p) => toPairView(p));
    const ui = collectUiStrings();
    this.post({
      type: 'state',
      state: {
        providerLabel: provider.displayName,
        providerAvailable: avail.available,
        providerDetail: avail.detail,
        translateOnEnter,
        pairs,
        ui
      }
    });
  }

  private postHistory(): void {
    const entries = this.history.isEnabled() ? this.history.list() : [];
    this.post({ type: 'history', entries });
  }

  private post(msg: OutMessage): void {
    this.view?.webview.postMessage(msg);
  }

  private renderHtml(_webview: vscode.Webview): string {
    const nonce = makeNonce();
    return /* html */ `<!doctype html>
<html lang="${vscode.env.language || 'en'}">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
<title>lingobridge</title>
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground);
         background: var(--vscode-sideBar-background); margin: 0; padding: 8px; font-size: 12px; }
  h3 { font-size: 11px; text-transform: uppercase; color: var(--vscode-descriptionForeground);
       letter-spacing: .5px; margin: 10px 0 4px; display: flex; justify-content: space-between; align-items: center; }
  h3 button { font-size: 10px; padding: 2px 6px; }
  .row { display: flex; gap: 6px; flex-wrap: wrap; }
  .row > button { flex: 1 1 auto; }
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
  .history-list { display: flex; flex-direction: column; gap: 4px; }
  .history-item {
    display: flex; gap: 6px; align-items: center;
    background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 2px; padding: 4px 6px; font-size: 11px;
  }
  .history-item .ts { color: var(--vscode-descriptionForeground); flex: 0 0 auto; font-variant-numeric: tabular-nums; }
  .history-item .dir { font-weight: bold; flex: 0 0 auto; }
  .history-item .text { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
  .history-item .text:hover { color: var(--vscode-textLink-foreground); }
  .history-item .tok { color: var(--vscode-descriptionForeground); flex: 0 0 auto; }
  .history-item .del { padding: 1px 6px; font-size: 10px; }
  .history-empty { color: var(--vscode-descriptionForeground); font-size: 11px; padding: 4px 0; }
</style>
</head>
<body>
  <h3 id="hProvider">Provider</h3>
  <div class="provider">
    <span id="providerLabel">—</span>
    <span class="badge" id="providerBadge">—</span>
  </div>

  <h3 id="hDirection">Direction</h3>
  <div class="row" id="dirRow"></div>

  <h3 id="hInput">Input</h3>
  <textarea id="input" placeholder=""></textarea>
  <div class="meta">
    <span id="inputChars">0</span>
    <span id="inputTokens">0 tok</span>
  </div>
  <div class="actions">
    <button id="run" class="primary" style="flex:1;">Translate</button>
  </div>
  <div id="error" class="error"></div>

  <h3 id="hResult">Result</h3>
  <div id="result" class="result"></div>
  <div class="meta">
    <span></span>
    <span id="resultTokens">0 tok</span>
  </div>
  <div class="actions">
    <button id="copy">Copy</button>
    <button id="openTab">Open in new tab</button>
  </div>

  <h3>
    <span id="hHistory">History</span>
    <button id="historyClear">Clear all</button>
  </h3>
  <div id="historyList" class="history-list"></div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  let dir = { from: 'ja', to: 'en' };
  let pairs = [];
  let translateOnEnter = true;
  let ui = null;

  function setDir(from, to) {
    dir = { from, to };
    document.querySelectorAll('#dirRow button').forEach((b) => {
      const f = b.dataset.from, t = b.dataset.to;
      b.classList.toggle('active', f === from && t === to);
    });
  }

  function rebuildDirRow() {
    const row = $('dirRow');
    row.innerHTML = '';
    pairs.forEach((p, i) => {
      const b = document.createElement('button');
      b.textContent = p.label;
      b.title = p.from.toUpperCase() + ' → ' + p.to.toUpperCase();
      b.dataset.from = p.from;
      b.dataset.to = p.to;
      b.onclick = () => setDir(p.from, p.to);
      row.appendChild(b);
    });
    if (pairs.length > 0) {
      // keep current direction if still in list, else pick first
      const current = pairs.find((p) => p.from === dir.from && p.to === dir.to);
      if (current) setDir(current.from, current.to);
      else setDir(pairs[0].from, pairs[0].to);
    }
  }

  function runTranslate() {
    if ($('run').disabled) return;
    $('error').textContent = '';
    $('run').disabled = true;
    $('run').textContent = ui ? ui.running : 'Translating…';
    vscode.postMessage({ type: 'translate', text: $('input').value, from: dir.from, to: dir.to });
  }

  let estimateTimer;
  $('input').addEventListener('input', () => {
    const t = $('input').value;
    $('inputChars').textContent = (Array.from(t).length) + (ui ? ' ' + ui.charsSuffix : ' chars');
    clearTimeout(estimateTimer);
    estimateTimer = setTimeout(() => {
      vscode.postMessage({ type: 'estimate', text: t });
    }, 80);
  });
  $('input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && translateOnEnter) {
      e.preventDefault();
      runTranslate();
    }
  });

  $('run').onclick = runTranslate;
  $('copy').onclick = () => vscode.postMessage({ type: 'copy' });
  $('openTab').onclick = () => vscode.postMessage({ type: 'openInTab' });
  $('historyClear').onclick = () => {
    const msg = (ui && ui.confirmClearAll) || 'Clear all translation history?';
    if (confirm(msg)) vscode.postMessage({ type: 'historyClear' });
  };

  function fmtTs(ts) {
    const d = new Date(ts);
    const z = (n) => String(n).padStart(2, '0');
    return z(d.getMonth()+1) + '/' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
  }

  function renderHistory(entries) {
    const list = $('historyList');
    list.innerHTML = '';
    if (!entries || entries.length === 0) {
      const e = document.createElement('div');
      e.className = 'history-empty';
      e.textContent = ui ? ui.historyEmpty : '—';
      list.appendChild(e);
      return;
    }
    entries.forEach((entry) => {
      const item = document.createElement('div');
      item.className = 'history-item';
      const ts = document.createElement('span'); ts.className = 'ts'; ts.textContent = fmtTs(entry.ts);
      const dir = document.createElement('span'); dir.className = 'dir';
      dir.textContent = entry.from.toUpperCase() + '→' + entry.to.toUpperCase();
      const text = document.createElement('span'); text.className = 'text';
      text.textContent = entry.input.slice(0, 60).replace(/\\s+/g, ' ');
      text.title = entry.input;
      text.onclick = () => vscode.postMessage({ type: 'historyRestore', id: entry.id });
      const tok = document.createElement('span'); tok.className = 'tok';
      if (entry.outputTokens != null) tok.textContent = entry.outputTokens + ' tok';
      const del = document.createElement('button'); del.className = 'del';
      del.textContent = ui ? ui.delete : '×';
      del.onclick = () => vscode.postMessage({ type: 'historyDelete', id: entry.id });
      item.append(ts, dir, text, tok, del);
      list.appendChild(item);
    });
  }

  window.addEventListener('message', (event) => {
    const m = event.data;
    if (m.type === 'inputTokens') $('inputTokens').textContent = m.tokens;
    if (m.type === 'resultTokens') $('resultTokens').textContent = m.tokens;
    if (m.type === 'result') {
      $('result').textContent = m.text;
      $('run').disabled = false;
      $('run').textContent = ui ? ui.run : 'Translate';
    }
    if (m.type === 'error') {
      $('error').textContent = m.text;
      $('run').disabled = false;
      $('run').textContent = ui ? ui.run : 'Translate';
    }
    if (m.type === 'state' && m.state) {
      ui = m.state.ui;
      $('hProvider').textContent = ui.provider;
      $('hDirection').textContent = ui.direction;
      $('hInput').textContent = ui.input;
      $('hResult').textContent = ui.result;
      $('hHistory').textContent = ui.history;
      $('historyClear').textContent = ui.historyClearAll;
      $('run').textContent = ui.run;
      $('copy').textContent = ui.copy;
      $('openTab').textContent = ui.openInTab;
      $('providerLabel').textContent = m.state.providerLabel;
      const b = $('providerBadge');
      b.textContent = m.state.providerAvailable ? ui.badgeOk : ui.badgeWarn;
      b.className = 'badge ' + (m.state.providerAvailable ? 'ok' : 'warn');
      b.title = m.state.providerDetail || '';
      translateOnEnter = !!m.state.translateOnEnter;
      $('input').placeholder = translateOnEnter ? ui.placeholderEnter : ui.placeholder;
      pairs = m.state.pairs || [];
      rebuildDirRow();
    }
    if (m.type === 'history') {
      renderHistory(m.entries || []);
    }
    if (m.type === 'restore' && m.entry) {
      $('input').value = m.entry.input;
      $('input').dispatchEvent(new Event('input'));
      $('result').textContent = m.entry.output;
      if (m.entry.outputTokens != null) {
        $('resultTokens').textContent = m.entry.outputTokens + ' tok';
      }
      setDir(m.entry.from, m.entry.to);
    }
  });

  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
  }
}

function toPairView(p: LanguagePair): PairView {
  return { from: p.from, to: p.to, label: p.label ?? `→ ${p.to.toUpperCase()}` };
}

function collectUiStrings(): UiStrings {
  return {
    provider: vscode.l10n.t('ui.provider'),
    direction: vscode.l10n.t('ui.direction'),
    input: vscode.l10n.t('ui.input'),
    run: vscode.l10n.t('ui.run'),
    running: vscode.l10n.t('ui.running'),
    result: vscode.l10n.t('ui.result'),
    copy: vscode.l10n.t('ui.copy'),
    openInTab: vscode.l10n.t('ui.openInTab'),
    history: vscode.l10n.t('ui.history'),
    historyEmpty: vscode.l10n.t('ui.historyEmpty'),
    historyClearAll: vscode.l10n.t('ui.historyClearAll'),
    restore: vscode.l10n.t('ui.restore'),
    delete: vscode.l10n.t('ui.delete'),
    placeholder: vscode.l10n.t('ui.placeholder'),
    placeholderEnter: vscode.l10n.t('ui.placeholderEnter'),
    badgeOk: vscode.l10n.t('ui.badge.ok'),
    badgeWarn: vscode.l10n.t('ui.badge.warn'),
    errInputEmpty: vscode.l10n.t('ui.errInputEmpty'),
    errUnknown: vscode.l10n.t('ui.errUnknown'),
    pairUnsupported: vscode.l10n.t('ui.pairUnsupported'),
    charsSuffix: vscode.l10n.t('ui.chars', '').trim() || 'chars',
    confirmClearAll: vscode.l10n.t('ui.confirmClearAll')
  };
}

function makeNonce(): string {
  let s = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}
