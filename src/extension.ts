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
import { installTransformersBackend } from './providers/transformersProvider';
import { LanguageCode } from './providers/translationProvider';
import { StatusBar } from './statusBar';
import { estimateTokensWith, formatTokens, TokenEngine } from './tokenEstimator';
import {
  buildOutputFileName,
  openTranslationInNewTab,
  translateText
} from './translationService';
import { TranslateViewProvider } from './translateView';

const ONBOARDING_KEY = 'lingobridge.onboarding.shown.v0.3.0';

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
    )
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
  const result = await translateText(text, { from, to });
  if (result.status !== 'ok' || result.translatedText === undefined) {
    vscode.window.showErrorMessage(
      tr(
        'msg.translateFailed',
        result.errorMessage ?? tr('msg.translateFailedDefault')
      )
    );
    return;
  }
  await history?.add({
    from,
    to,
    input: text,
    output: result.translatedText
  });
  const openInTab = vscode.workspace
    .getConfiguration('lingobridge')
    .get<boolean>('output.openInNewTab', true);
  if (openInTab) {
    await openTranslationInNewTab(doc, to, result.translatedText);
  } else {
    await vscode.env.clipboard.writeText(result.translatedText);
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
