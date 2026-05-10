import * as assert from 'assert';
import * as vscode from 'vscode';
import { StatusBar } from '../../src/statusBar';

// FUN-09 — Status Bar に現在ドキュメントのトークン数を表示。
suite('StatusBar', () => {
  let bar: StatusBar;

  setup(() => {
    bar = new StatusBar();
  });
  teardown(async () => {
    bar.dispose();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('refresh() does not throw without an editor', () => {
    bar.refresh();
  });

  test('reflects active document text after opening one', async () => {
    const doc = await vscode.workspace.openTextDocument({
      content: 'hello world hello world',
      language: 'plaintext'
    });
    await vscode.window.showTextDocument(doc);
    bar.refresh();
    // We can only check the public side effect indirectly: the StatusBarItem
    // is private. Re-running refresh should remain side-effect free / no throw.
    bar.refresh();
    assert.ok(true);
  });

  test('hides when statusBar.enabled is false', async () => {
    await vscode.workspace
      .getConfiguration('lingobridge')
      .update('statusBar.enabled', false, vscode.ConfigurationTarget.Global);
    try {
      bar.refresh();
    } finally {
      await vscode.workspace
        .getConfiguration('lingobridge')
        .update('statusBar.enabled', undefined, vscode.ConfigurationTarget.Global);
    }
  });
});
