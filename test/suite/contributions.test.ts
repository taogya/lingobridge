import * as assert from 'assert';
import * as vscode from 'vscode';

// FUN-01..08 / FUN-12 を有効化するためのコマンド・キーバインド・メニュー登録を検証する。
suite('extension contributions', () => {
  const expectedCommands = [
    'lingobridge.translateDocument',
    'lingobridge.translateDocumentToEnglish',
    'lingobridge.translateDocumentToJapanese',
    'lingobridge.translateDocumentIncremental',
    'lingobridge.openGettingStarted',
    'lingobridge.installTransformersBackend',
    'lingobridge.estimateSelectionTokens',
    'lingobridge.translateSelection',
    'lingobridge.openSettings',
    'lingobridge.clearHistory',
    'lingobridge.focusTranslateView'
  ];

  test('all commands are registered', async () => {
    const all = await vscode.commands.getCommands(true);
    for (const id of expectedCommands) {
      assert.ok(all.includes(id), `command not registered: ${id}`);
    }
  });

  test('extension is present and activatable', async () => {
    const ext = vscode.extensions.getExtension('taogya.lingobridge');
    assert.ok(ext, 'extension taogya.lingobridge not found');
    if (!ext.isActive) await ext.activate();
    assert.strictEqual(ext.isActive, true);
  });

  test('package.json declares 11 commands and 6 keybindings', () => {
    const ext = vscode.extensions.getExtension('taogya.lingobridge')!;
    const contrib = ext.packageJSON.contributes as Record<string, unknown>;
    const cmds = contrib.commands as { command: string }[];
    const keys = contrib.keybindings as { command: string }[];
    assert.strictEqual(cmds.length, expectedCommands.length);
    for (const id of expectedCommands) {
      assert.ok(cmds.some((c) => c.command === id), `missing command: ${id}`);
    }
    assert.strictEqual(keys.length, 6);
  });

  test('editor/title menu shows only the unified $(globe) button', () => {
    const ext = vscode.extensions.getExtension('taogya.lingobridge')!;
    const menus = (ext.packageJSON.contributes as Record<string, unknown>).menus as Record<
      string,
      { command: string }[]
    >;
    const titleMenu = menus['editor/title'] ?? [];
    assert.strictEqual(titleMenu.length, 1, 'title bar should expose exactly 1 button');
    assert.strictEqual(titleMenu[0].command, 'lingobridge.translateDocument');
  });
});
