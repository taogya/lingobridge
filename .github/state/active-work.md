# Active Work State

軽量な引き継ぎ用。直近の判断、次アクション、検証状態だけを残します。

## Current Focus

- v0.2.1 のコミット準備完了。GitHub Issues #1-#4 を再現テスト → 修正 (TASK-00009..00012) し、TASK-00007 Walkthrough と TASK-00013 Translate Selection (B1) を取り込み済み。テストは 55 passing / 2 pending。
- 次アクション: VSIX を `lingobridge-0.2.1.vsix` でビルドし、`git add -A && git commit -m "v0.2.1: ..."` でコミット (push はユーザー判断)。

## Latest Handoff

- 2026-05-12: Issue #1 (TASK-00009) — 英語環境で UI が生キー表示される問題。`src/i18n.ts` を新設し `tr()` ラッパーで `bundle.l10n.json` フォールバック。`extension.ts` / `translateView.ts` / `statusBar.ts` / `providers/*` を `tr(` に置換。
- 2026-05-12: Issue #2 (TASK-00010) — 履歴クリアの `window.confirm` 依存を撤廃し、確認は拡張ホスト側のモーダルへ移行。
- 2026-05-12: Issue #3 (TASK-00011) — LibreTranslate の `socket hang up` 対策で `Connection: close` + transient エラーの 1 回リトライを実装。
- 2026-05-12: Issue #4 (TASK-00012) — `msg.tokensOf` に engine プレースホルダ `{3}` を追加し `estimateSelection()` から渡す。
- 2026-05-12: TASK-00007 Walkthrough — `package.json` に `lingobridge.gettingStarted` (5 ステップ) と `media/walkthrough/*.md` を追加。
- 2026-05-12: TASK-00013 Translate Selection (B1) — 右クリックメニュー → 翻訳パネル prefill + 自動翻訳。`TranslateViewProvider.prefill()` 公開、Webview 側に `prefill` ハンドラ追加。
- 2026-05-12: 再現テスト `test/suite/issuesV021.test.ts` 追加。`contributions.test.ts` のコマンド数を 7 → 8 に更新。

## Verification

- `npm test`: 55 passing, 2 pending (gated)。
- VSIX: 未ビルド (このリリース手順で実施)。
- 実機 F5: 未検証 (ユーザー側で確認)。

## Backlog (次期候補)

- TASK-00004 (保護の細粒度) / TASK-00005 (差分翻訳)。
- TASK-libretranslate-no-server-investigation: transformers.js による「サーバ常駐レス」プロバイダ追加。
- VS Code Language Model `countTokens` API の利用。
- Issue #5: TASK-00007 で対応済 (closes 候補)。
