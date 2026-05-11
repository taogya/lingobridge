import * as vscode from 'vscode';
import { HistoryStore } from './history';
import { tr } from './i18n';
import { getLanguagePairs, LanguagePair, pairPickLabel } from './languagePairs';
import { LanguageCode } from './providers/translationProvider';
import { StatusBar } from './statusBar';
import { estimateTokensWith, formatTokens, TokenEngine } from './tokenEstimator';
import { openTranslationInNewTab, translateText } from './translationService';
import { TranslateViewProvider } from './translateView';

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
    )
  );
}

export function deactivate(): void {
  history = undefined;
  viewProvider = undefined;
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

async function translateActiveDocument(from: LanguageCode, to: LanguageCode): Promise<void> {
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

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: tr('msg.translating', from.toUpperCase(), to.toUpperCase()),
      cancellable: false
    },
    async () => {
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
  );
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
