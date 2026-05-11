# TASK-00010-issue2-history-clear

- Version: v0.2.1
- Status: done
- Owner: -
- Issue: taogya/lingobridge#2

## Goal

翻訳パネルの「履歴すべてクリア」ボタンを押しても何も起こらない不具合を解消する。

## Root cause

Webview HTML が `if (window.confirm(msg)) postMessage(...)` を使っており、
VS Code の Webview は `window.confirm` をサポートせず undefined を返すため postMessage が発火しない。

## Acceptance

- [x] 再現テスト: 生成された Webview HTML に `\bconfirm\s*\(` が含まれないことを assert。
- [x] Webview からは `historyClear` を即時 post し、確認は **拡張ホスト側で `vscode.window.showWarningMessage(..., {modal:true}, ...)`** に変更。
- [x] テスト全件 GREEN。
