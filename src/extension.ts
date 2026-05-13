import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { HistoryStore } from './history';
import { tr } from './i18n';
import {
  isIncrementalEnabled,
  loadSidecarFor,
  sidecarPathFor,
  translateIncremental
} from './incremental';
import { getLanguagePairs, LanguagePair, pairPickLabel } from './languagePairs';
import { AtransProvider } from './providers/atransProvider';
import { LibreTranslateProvider } from './providers/libreTranslateProvider';
import { installTransformersBackend, TransformersProvider } from './providers/transformersProvider';
import { LanguageCode, TranslationProvider } from './providers/translationProvider';
import { StatusBar } from './statusBar';
import { estimateTokensWith, formatTokens, TokenEngine } from './tokenEstimator';
import {
  buildOutputFileName,
  openTranslationInNewTab,
  translateText
} from './translationService';
import { TranslateViewProvider } from './translateView';

const ONBOARDING_KEY = 'lingobridge.onboarding.shown.v0.3.0';
const CHECK_PROVIDER_SETUP_BUTTON: vscode.QuickInputButton = {
  iconPath: new vscode.ThemeIcon('book'),
  tooltip: tr('msg.checkProviders.setup')
};
const CHECK_PROVIDER_ACTIVATE_BUTTON: vscode.QuickInputButton = {
  iconPath: new vscode.ThemeIcon('check'),
  tooltip: tr('msg.checkProviders.activate')
};
const CHECK_PROVIDER_INSTALL_BUTTON: vscode.QuickInputButton = {
  iconPath: new vscode.ThemeIcon('cloud-download'),
  tooltip: tr('msg.checkProviders.install')
};

let history: HistoryStore | undefined;
let viewProvider: TranslateViewProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const statusBar = new StatusBar();
  context.subscriptions.push(statusBar);

  history = new HistoryStore(context);

  const view = new TranslateViewProvider(context, history);
  viewProvider = view;
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(TranslateViewProvider.viewId, view)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('lingobridge.translateDocument', () =>
      translateActiveDocumentWithPicker()
    ),
    vscode.commands.registerCommand('lingobridge.translateDocumentToEnglish', () =>
      translateActiveDocument('ja', 'en')
    ),
    vscode.commands.registerCommand('lingobridge.translateDocumentToJapanese', () =>
      translateActiveDocument('en', 'ja')
    ),
    vscode.commands.registerCommand('lingobridge.translateDocumentIncremental', () =>
      translateActiveDocumentIncrementalWithPicker()
    ),
    vscode.commands.registerCommand('lingobridge.estimateSelectionTokens', () =>
      estimateSelection()
    ),
    vscode.commands.registerCommand('lingobridge.translateSelection', () =>
      translateSelection()
    ),
    vscode.commands.registerCommand('lingobridge.openSettings', () =>
      vscode.commands.executeCommand('workbench.action.openSettings', '@ext:taogya.lingobridge')
    ),
    vscode.commands.registerCommand('lingobridge.clearHistory', () => clearHistory()),
    vscode.commands.registerCommand('lingobridge.focusTranslateView', () =>
      vscode.commands.executeCommand('lingobridge.translatePanel.focus')
    ),
    vscode.commands.registerCommand('lingobridge.openGettingStarted', () =>
      vscode.commands.executeCommand(
        'workbench.action.openWalkthrough',
        'taogya.lingobridge#lingobridge.gettingStarted',
        false
      )
    ),
    vscode.commands.registerCommand('lingobridge.installTransformersBackend', () =>
      installTransformersBackend(context)
    ),
    vscode.commands.registerCommand('lingobridge.checkProviders', () => checkProviders(context))
  );

  // TASK-00014: show the walkthrough once on first activation. We avoid
  // popping it up on every startup by remembering a flag in globalState.
  void maybeAutoOpenOnboarding(context);
}

export function deactivate(): void {
  history = undefined;
  viewProvider = undefined;
}

async function maybeAutoOpenOnboarding(context: vscode.ExtensionContext): Promise<void> {
  if (context.globalState.get<boolean>(ONBOARDING_KEY)) return;
  await context.globalState.update(ONBOARDING_KEY, true);
  // Defer slightly so the editor finishes start-up first.
  setTimeout(() => {
    void vscode.commands.executeCommand(
      'workbench.action.openWalkthrough',
      'taogya.lingobridge#lingobridge.gettingStarted',
      false
    );
  }, 1500);
}

async function translateActiveDocumentWithPicker(): Promise<void> {
  const pairs = getLanguagePairs();
  if (pairs.length === 0) {
    vscode.window.showWarningMessage(tr('msg.pickPairNoneConfigured'));
    return;
  }
  const items = pairs.map<vscode.QuickPickItem & { pair: LanguagePair }>((p) => ({
    label: pairPickLabel(p),
    pair: p
  }));
  const picked =
    items.length === 1
      ? items[0]
      : await vscode.window.showQuickPick(items, {
          title: tr('msg.pickPair'),
          placeHolder: tr('msg.pickPair')
        });
  if (!picked) return;
  await translateActiveDocument(picked.pair.from, picked.pair.to);
}

async function translateActiveDocumentIncrementalWithPicker(): Promise<void> {
  const pairs = getLanguagePairs();
  if (pairs.length === 0) {
    vscode.window.showWarningMessage(tr('msg.pickPairNoneConfigured'));
    return;
  }
  const items = pairs.map<vscode.QuickPickItem & { pair: LanguagePair }>((p) => ({
    label: pairPickLabel(p),
    pair: p
  }));
  const picked =
    items.length === 1
      ? items[0]
      : await vscode.window.showQuickPick(items, {
          title: tr('msg.pickPair'),
          placeHolder: tr('msg.pickPair')
        });
  if (!picked) return;
  await translateActiveDocument(picked.pair.from, picked.pair.to, { incremental: true });
}

interface TranslateOpts {
  incremental?: boolean;
}

async function translateActiveDocument(
  from: LanguageCode,
  to: LanguageCode,
  opts: TranslateOpts = {}
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage(tr('msg.noActiveEditor'));
    return;
  }
  const doc = editor.document;
  const text = doc.getText();
  if (!text.trim()) {
    vscode.window.showWarningMessage(tr('msg.documentEmpty'));
    return;
  }

  const useIncremental = opts.incremental && isIncrementalEnabled();

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: tr('msg.translating', from.toUpperCase(), to.toUpperCase()),
      cancellable: false
    },
    async () => {
      try {
        if (useIncremental) {
          await runIncrementalTranslation(doc, from, to);
        } else {
          await runFullTranslation(doc, text, from, to);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : tr('msg.translateFailedDefault');
        vscode.window.showErrorMessage(tr('msg.translateFailed', msg));
      }
    }
  );
}

async function runFullTranslation(
  doc: vscode.TextDocument,
  text: string,
  from: LanguageCode,
  to: LanguageCode
): Promise<void> {
  const { stats } = await translateIncremental({
    source: text,
    languageId: doc.languageId,
    direction: { from, to }
  });
  await history?.add({
    from,
    to,
    input: text,
    output: stats.outputText
  });
  const openInTab = vscode.workspace
    .getConfiguration('lingobridge')
    .get<boolean>('output.openInNewTab', true);
  if (openInTab) {
    await openTranslationInNewTab(doc, to, stats.outputText);
  } else {
    await vscode.env.clipboard.writeText(stats.outputText);
    vscode.window.showInformationMessage(tr('msg.copiedToClipboard'));
  }
}

/**
 * TASK-00005 — Translate only blocks whose hash changed since the last run.
 * Sidecar JSON (`<basename>.lb.json`) lives next to the output file.
 *
 * For untitled / un-saved sources we fall back to a one-shot full
 * translation since there is no stable on-disk path for the sidecar.
 */
async function runIncrementalTranslation(
  doc: vscode.TextDocument,
  from: LanguageCode,
  to: LanguageCode
): Promise<void> {
  if (doc.isUntitled || doc.uri.scheme !== 'file') {
    await runFullTranslation(doc, doc.getText(), from, to);
    return;
  }
  const sourcePath = doc.uri.fsPath;
  const dir = path.dirname(sourcePath);
  const outputName = buildOutputFileName(path.basename(sourcePath), to);
  const outputPath = path.join(dir, outputName);
  const sidecar = loadSidecarFor(outputPath);

  const { stats, sidecar: nextSidecar } = await translateIncremental({
    source: doc.getText(),
    languageId: doc.languageId,
    direction: { from, to },
    cache: sidecar
  });

  // Persist output + sidecar.
  fs.writeFileSync(outputPath, stats.outputText, 'utf8');
  fs.writeFileSync(sidecarPathFor(outputPath), JSON.stringify(nextSidecar, null, 2), 'utf8');

  await history?.add({
    from,
    to,
    input: doc.getText(),
    output: stats.outputText
  });

  vscode.window.setStatusBarMessage(
    tr(
      'msg.incrementalStats',
      String(stats.translated),
      String(stats.reused),
      String(stats.total)
    ),
    5000
  );

  const openInTab = vscode.workspace
    .getConfiguration('lingobridge')
    .get<boolean>('output.openInNewTab', true);
  if (openInTab) {
    const uri = vscode.Uri.file(outputPath);
    const opened = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(opened, {
      viewColumn: vscode.ViewColumn.Beside,
      preview: false
    });
  } else {
    await vscode.env.clipboard.writeText(stats.outputText);
    vscode.window.showInformationMessage(tr('msg.copiedToClipboard'));
  }
}

function estimateSelection(): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage(tr('msg.noActiveEditor'));
    return;
  }
  const sel = editor.selection;
  const text =
    sel && !sel.isEmpty ? editor.document.getText(sel) : editor.document.getText();
  const engine = vscode.workspace
    .getConfiguration('lingobridge')
    .get<TokenEngine>('tokenEstimator.engine', 'heuristic');
  const n = estimateTokensWith(engine, text);
  const scope =
    sel && !sel.isEmpty
      ? tr('msg.scopeSelection')
      : tr('msg.scopeDocument');
  vscode.window.showInformationMessage(
    tr('msg.tokensOf', formatTokens(n), scope, String(Array.from(text).length), engine)
  );
}

/**
 * B1 — Translate Selection. Opens the Translate side panel with the current
 * selection prefilled and triggers a translation in the panel-selected
 * direction. Useful for translating one paragraph without round-tripping
 * through a new tab.
 */
async function translateSelection(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage(tr('msg.noActiveEditor'));
    return;
  }
  const sel = editor.selection;
  const text = sel && !sel.isEmpty ? editor.document.getText(sel) : '';
  if (!text.trim()) {
    vscode.window.showWarningMessage(tr('msg.noSelection'));
    return;
  }
  await vscode.commands.executeCommand('lingobridge.translatePanel.focus');
  await viewProvider?.prefill(text, { autoRun: true });
}

async function clearHistory(): Promise<void> {
  if (!history) return;
  const ok = await vscode.window.showWarningMessage(
    tr('msg.confirmClearHistory'),
    { modal: true },
    tr('msg.btn.clear')
  );
  if (!ok) return;
  await history.clear();
  vscode.window.setStatusBarMessage(tr('msg.historyCleared'), 2000);
}

/**
 * Issue #5 — Probe every supported provider and show an availability
 * checklist so users can see at a glance which backends are installed and
 * ready to use.
 */
type ProviderId = 'atrans' | 'libretranslate' | 'transformers';

interface ProviderStatusItem extends vscode.QuickPickItem {
  providerId: ProviderId;
}

async function checkProviders(context: vscode.ExtensionContext): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('lingobridge');
  const providers: Array<{ id: ProviderId; instance: TranslationProvider }> = [
    { id: 'atrans', instance: new AtransProvider({ explicitPath: cfg.get<string>('atrans.path', '') || undefined }) },
    {
      id: 'libretranslate',
      instance: new LibreTranslateProvider({
        endpoint: cfg.get<string>('libretranslate.endpoint', 'http://127.0.0.1:5000'),
        apiKey: cfg.get<string>('libretranslate.apiKey', '') || undefined
      })
    },
    {
      id: 'transformers',
      instance: new TransformersProvider({
        modelMap: cfg.get<Record<string, string>>('transformers.modelMap', {}) || {},
        cacheDir: cfg.get<string>('transformers.cacheDir', '') || undefined
      })
    }
  ];
  const active = cfg.get<ProviderId>('provider.active', 'atrans');
  const items: ProviderStatusItem[] = [];
  for (const p of providers) {
    const avail = await p.instance.checkAvailability();
    const summary = [p.id === active ? tr('msg.checkProviders.active') : '', avail.available ? tr('ui.badge.ok') : tr('ui.badge.warn')]
      .filter(Boolean)
      .join(' • ');
    items.push({
      label: `${avail.available ? '$(check)' : '$(warning)'} ${providerLabel(p.id)}`,
      description: summary,
      detail: avail.detail,
      providerId: p.id,
      buttons: [
        ...(p.id === active ? [] : [CHECK_PROVIDER_ACTIVATE_BUTTON]),
        CHECK_PROVIDER_SETUP_BUTTON,
        ...(p.id === 'transformers' && !avail.available ? [CHECK_PROVIDER_INSTALL_BUTTON] : [])
      ]
    });
  }

  await new Promise<void>((resolve) => {
    const pick = vscode.window.createQuickPick<ProviderStatusItem>();
    const disposables: vscode.Disposable[] = [];
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      while (disposables.length > 0) {
        const d = disposables.pop();
        d?.dispose();
      }
      resolve();
    };

    pick.title = tr('msg.checkProviders.title');
    pick.placeholder = tr('msg.checkProviders.placeholder');
    pick.matchOnDescription = true;
    pick.matchOnDetail = true;
    pick.items = items;

    disposables.push(
      pick.onDidAccept(() => {
        const picked = pick.selectedItems[0];
        pick.hide();
        if (picked) {
          void openProviderSetupGuide(picked.providerId);
        }
      }),
      pick.onDidTriggerItemButton((e) => {
        if (e.button === CHECK_PROVIDER_SETUP_BUTTON) {
          void openProviderSetupGuide(e.item.providerId);
          return;
        }
        if (e.button === CHECK_PROVIDER_ACTIVATE_BUTTON) {
          pick.hide();
          void activateProvider(e.item.providerId);
          return;
        }
        if (e.button === CHECK_PROVIDER_INSTALL_BUTTON) {
          pick.hide();
          void installTransformersBackend(context);
        }
      }),
      pick.onDidHide(done)
    );

    pick.show();
  });
}

function providerLabel(id: ProviderId): string {
  switch (id) {
    case 'atrans':
      return 'atrans';
    case 'libretranslate':
      return 'LibreTranslate';
    case 'transformers':
      return 'transformers.js';
  }
}

async function openProviderSetupGuide(id: ProviderId): Promise<void> {
  const uri = vscode.Uri.parse(
    `https://github.com/taogya/lingobridge/blob/main/docs/setup/providers/${id === 'transformers' ? 'transformers' : id}.md`
  );
  await vscode.env.openExternal(uri);
}

async function activateProvider(id: ProviderId): Promise<void> {
  const resource = vscode.window.activeTextEditor?.document.uri ?? vscode.workspace.workspaceFolders?.[0]?.uri;
  const cfg = vscode.workspace.getConfiguration('lingobridge', resource);
  const inspect = cfg.inspect<ProviderId>('provider.active');
  const target = inspect?.workspaceFolderValue !== undefined
    ? vscode.ConfigurationTarget.WorkspaceFolder
    : inspect?.workspaceValue !== undefined
      ? vscode.ConfigurationTarget.Workspace
      : vscode.ConfigurationTarget.Global;
  await cfg.update('provider.active', id, target);
  vscode.window.setStatusBarMessage(tr('msg.checkProviders.activated', providerLabel(id)), 2500);
}
