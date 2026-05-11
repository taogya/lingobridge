# TASK-00009-issue1-i18n-fallback

- Version: v0.2.1
- Status: done
- Owner: -
- Issue: taogya/lingobridge#1

## Goal

英語環境 (デフォルト言語) で UI ラベルや通知が `ui.provider` などの **生のキー** のまま表示される不具合を解消する。

## Root cause

`vscode.l10n.t(key)` は対応する `bundle.l10n.<lang>.json` がロードされていないとき第1引数を **そのまま返す**。
本拡張は `bundle.l10n.json` (英語ソース) しか持たないため、英語ロケールでは bundle がロードされずキーがそのまま表示されていた。

## Acceptance

- [x] 再現テスト (Issue #1) を `test/suite/issuesV021.test.ts` に追加し、最初に Fail することを確認。
- [x] `src/i18n.ts` にラッパー `tr(key, ...args)` を追加。`vscode.l10n.t` が key を返したら `l10n/bundle.l10n.json` から英語にフォールバック。
- [x] `extension.ts` / `translateView.ts` / `statusBar.ts` / `providers/*` の `vscode.l10n.t(` を `tr(` に置換。
- [x] テスト全件 GREEN。
