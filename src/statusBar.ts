import * as vscode from 'vscode';
import { tr } from './i18n';
import { estimateTokensWith, formatTokens, TokenEngine } from './tokenEstimator';

/** Single status bar item showing token count of the active editor (selection-aware). */
export class StatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private readonly disposables: vscode.Disposable[] = [];

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.tooltip = tr('msg.statusTooltip');
    this.item.command = 'lingobridge.estimateSelectionTokens';

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.refresh()),
      vscode.window.onDidChangeTextEditorSelection(() => this.refresh()),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (vscode.window.activeTextEditor?.document === e.document) {
          this.refresh();
        }
      }),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('lingobridge.statusBar.enabled')) {
          this.refresh();
        }
      })
    );

    this.refresh();
  }

  refresh(): void {
    const enabled = vscode.workspace
      .getConfiguration('lingobridge')
      .get<boolean>('statusBar.enabled', true);
    if (!enabled) {
      this.item.hide();
      return;
    }
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.item.hide();
      return;
    }
    const sel = editor.selection;
    const text = sel && !sel.isEmpty ? editor.document.getText(sel) : editor.document.getText();
    const cfg = vscode.workspace.getConfiguration('lingobridge');
    const engine = cfg.get<TokenEngine>('tokenEstimator.engine', 'heuristic');
    const n = estimateTokensWith(engine, text);
    const prefix = sel && !sel.isEmpty ? '$(symbol-numeric) sel ' : '$(symbol-numeric) ';
    this.item.text = `${prefix}${formatTokens(n)}`;
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
    for (const d of this.disposables) d.dispose();
  }
}
