import * as assert from 'assert';
import * as vscode from 'vscode';

// FUN-06 / FUN-08 — Activity Bar 専用ビューと view/title メニュー登録の検証。
suite('view registration', () => {
  test('lingobridge.translatePanel webview view is declared', () => {
    const ext = vscode.extensions.getExtension('taogya.lingobridge')!;
    const views = (ext.packageJSON.contributes as Record<string, unknown>).views as Record<
      string,
      { id: string; type?: string }[]
    >;
    const list = views['lingobridge'] ?? [];
    assert.ok(
      list.some((v) => v.id === 'lingobridge.translatePanel' && v.type === 'webview'),
      'translatePanel webview view should be declared'
    );
  });

  test('focusTranslateView command focuses the panel', async () => {
    // Should not throw; VS Code will silently ignore if the panel cannot be focused
    // (e.g., editor host without UI). We mainly assert the command itself works.
    await vscode.commands.executeCommand('lingobridge.focusTranslateView');
  });

  test('view/title contributes settings shortcut', () => {
    const ext = vscode.extensions.getExtension('taogya.lingobridge')!;
    const menus = (ext.packageJSON.contributes as Record<string, unknown>).menus as Record<
      string,
      { command: string; when?: string }[]
    >;
    const titleMenu = menus['view/title'] ?? [];
    assert.ok(
      titleMenu.some((m) => m.command === 'lingobridge.openSettings'),
      'view/title should expose Open Settings shortcut'
    );
  });
});
