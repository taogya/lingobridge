import * as vscode from 'vscode';
import { LanguageCode } from './providers/translationProvider';
import { StatusBar } from './statusBar';
import { estimateTokensWith, formatTokens, TokenEngine } from './tokenEstimator';
import { openTranslationInNewTab, translateText } from './translationService';
import { TranslateViewProvider } from './translateView';

export function activate(context: vscode.ExtensionContext): void {
  const statusBar = new StatusBar();
  context.subscriptions.push(statusBar);

  const view = new TranslateViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(TranslateViewProvider.viewId, view)
  );

  context.subscriptions.push(
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
    )
  );
}

export function deactivate(): void {
  // nothing
}

async function translateActiveDocument(from: LanguageCode, to: LanguageCode): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('lingobridge: アクティブなエディタがありません。');
    return;
  }
  const doc = editor.document;
  const text = doc.getText();
  if (!text.trim()) {
    vscode.window.showWarningMessage('lingobridge: ドキュメントが空です。');
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `lingobridge: ${from.toUpperCase()} → ${to.toUpperCase()} 翻訳中…`,
      cancellable: false
    },
    async () => {
      const result = await translateText(text, { from, to });
      if (result.status !== 'ok' || result.translatedText === undefined) {
        vscode.window.showErrorMessage(
          `lingobridge: ${result.errorMessage ?? '翻訳に失敗しました。'}`
        );
        return;
      }
      const openInTab = vscode.workspace
        .getConfiguration('lingobridge')
        .get<boolean>('output.openInNewTab', true);
      if (openInTab) {
        await openTranslationInNewTab(doc, to, result.translatedText);
      } else {
        await vscode.env.clipboard.writeText(result.translatedText);
        vscode.window.showInformationMessage(
          'lingobridge: 翻訳結果をクリップボードにコピーしました。'
        );
      }
    }
  );
}

function estimateSelection(): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('lingobridge: アクティブなエディタがありません。');
    return;
  }
  const sel = editor.selection;
  const text =
    sel && !sel.isEmpty ? editor.document.getText(sel) : editor.document.getText();
  const engine = vscode.workspace
    .getConfiguration('lingobridge')
    .get<TokenEngine>('tokenEstimator.engine', 'heuristic');
  const n = estimateTokensWith(engine, text);
  const scope = sel && !sel.isEmpty ? '選択範囲' : 'ドキュメント全体';
  vscode.window.showInformationMessage(
    `lingobridge: ${scope}は約 ${formatTokens(n)} (${Array.from(text).length} 字)`
  );
}
