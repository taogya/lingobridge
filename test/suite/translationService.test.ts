import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  buildOutputFileName,
  openTranslationInNewTab
} from '../../src/translationService';

suite('buildOutputFileName', () => {
  test('appends lang before extension', () => {
    assert.strictEqual(buildOutputFileName('README.md', 'en'), 'README.en.md');
    assert.strictEqual(buildOutputFileName('notes.txt', 'ja'), 'notes.ja.txt');
  });
  test('replaces existing lang segment', () => {
    assert.strictEqual(buildOutputFileName('README.ja.md', 'en'), 'README.en.md');
    assert.strictEqual(buildOutputFileName('README.en.md', 'ja'), 'README.ja.md');
  });
  test('handles no extension', () => {
    assert.strictEqual(buildOutputFileName('LICENSE', 'en'), 'LICENSE.en');
  });
});

suite('openTranslationInNewTab (Linux + 日本語ファイル名 互換性)', () => {
  // 旧実装は untitled URI に絶対パスを埋め込んでおり、Linux の glibc
  // (LANG=C や NFC/NFD ミスマッチ) で失敗していた。修正後は untitled:
  // にファイル名のみを載せる。タブ名 = <元名>.<lang>.<ext> は維持する。
  test('日本語ファイル名でも新規タブが開ける + 絶対パスを含まない', async () => {
    const original = await vscode.workspace.openTextDocument({
      content: 'これはテストです。\n',
      language: 'markdown'
    });
    // openTextDocument({content}) は untitled になるので、fileName を
    // 日本語に差し替えて originalDoc 相当として渡す。
    const fakeDoc = {
      ...original,
      isUntitled: false,
      fileName: '/tmp/テスト ファイル.md',
      uri: vscode.Uri.file('/tmp/テスト ファイル.md'),
      languageId: 'markdown'
    } as unknown as vscode.TextDocument;

    await openTranslationInNewTab(fakeDoc, 'en', 'This is a test.\n');

    const opened = vscode.window.activeTextEditor?.document;
    assert.ok(opened, 'expected an editor to be active after openTranslationInNewTab');
    assert.strictEqual(opened!.uri.scheme, 'untitled');
    // 絶対パスを埋め込んでいないこと (Linux + 日本語名 不具合の回帰防止)。
    assert.ok(
      !/^\/|^[A-Za-z]:[\\/]/.test(opened!.uri.path),
      `untitled URI must not embed an absolute path: ${opened!.uri.toString()}`
    );
    // タブ名が <元名>.<lang>.<ext> 由来になっていること。
    assert.ok(
      /テスト ファイル\.en\.md$/.test(decodeURIComponent(opened!.uri.path)),
      `expected suggested file name in URI path: ${opened!.uri.path}`
    );

    await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
  });
});

