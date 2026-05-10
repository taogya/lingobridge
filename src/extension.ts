import * as vscode from 'vscode';
import { HistoryStore } from './history';
import { getLanguagePairs, LanguagePair, pairPickLabel } from './languagePairs';
import { LanguageCode } from './providers/translationProvider';
import { StatusBar } from './statusBar';
import { estimateTokensWith, formatTokens, TokenEngine } from './tokenEstimator';
import { openTranslationInNewTab, translateText } from './translationService';
import { TranslateViewProvider } from './translateView';

let history: HistoryStore | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const statusBar = new StatusBar();
  context.subscriptions.push(statusBar);

  history = new HistoryStore(context);

  const view = new TranslateViewProvider(context, history);
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
    vscode.commands.registerCommand('lingobridge.estimateSelectionTokens', () =>
      estimateSelection()
    ),
    vscode.commands.registerCommand('lingobridge.openSettings', () =>
      vscode.commands.executeCommand('workbench.action.openSettings', '@ext:taogya.lingobridge')
    ),
    vscode.commands.registerCommand('lingobridge.clearHistory', () => clearHistory()),
    vscode.commands.registerCommand('lingobridge.focusTranslateView', () =>
      vscode.commands.executeCommand('lingobridge.translatePanel.focus')
    )
  );
}

export function deactivate(): void {
  history = undefined;
}

async function translateActiveDocumentWithPicker(): Promise<void> {
  const pairs = getLanguagePairs();
  if (pairs.length === 0) {
    vscode.window.showWarningMessage(vscode.l10n.t('msg.pickPairNoneConfigured'));
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
          title: vscode.l10n.t('msg.pickPair'),
          placeHolder: vscode.l10n.t('msg.pickPair')
        });
  if (!picked) return;
  await translateActiveDocument(picked.pair.from, picked.pair.to);
}

async function translateActiveDocument(from: LanguageCode, to: LanguageCode): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage(vscode.l10n.t('msg.noActiveEditor'));
    return;
  }
  const doc = editor.document;
  const text = doc.getText();
  if (!text.trim()) {
    vscode.window.showWarningMessage(vscode.l10n.t('msg.documentEmpty'));
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: vscode.l10n.t('msg.translating', from.toUpperCase(), to.toUpperCase()),
      cancellable: false
    },
    async () => {
      const result = await translateText(text, { from, to });
      if (result.status !== 'ok' || result.translatedText === undefined) {
        vscode.window.showErrorMessage(
          vscode.l10n.t(
            'msg.translateFailed',
            result.errorMessage ?? vscode.l10n.t('msg.translateFailedDefault')
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
        vscode.window.showInformationMessage(vscode.l10n.t('msg.copiedToClipboard'));
      }
    }
  );
}

function estimateSelection(): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage(vscode.l10n.t('msg.noActiveEditor'));
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
      ? vscode.l10n.t('msg.scopeSelection')
      : vscode.l10n.t('msg.scopeDocument');
  vscode.window.showInformationMessage(
    vscode.l10n.t('msg.tokensOf', formatTokens(n), scope, String(Array.from(text).length))
  );
}

async function clearHistory(): Promise<void> {
  if (!history) return;
  const ok = await vscode.window.showWarningMessage(
    vscode.l10n.t('msg.confirmClearHistory'),
    { modal: true },
    vscode.l10n.t('msg.btn.clear')
  );
  if (!ok) return;
  await history.clear();
  vscode.window.setStatusBarMessage(vscode.l10n.t('msg.historyCleared'), 2000);
}
