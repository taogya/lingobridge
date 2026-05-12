# Active Work State

軽量な引き継ぎ用。直近の判断、次アクション、検証状態だけを残します。

## Current Focus

- v0.3.1 修正完了。Issue #5〜#7 を対象に、Onboarding のセットアップ導線整理・
	Translate View の provider availability 再検知・Markdown 文書翻訳の構造保持を
	修正済み。回帰テストと VSIX ビルドまで完了。
- 次アクション: リリースコミットを作成し、必要なら実機 F5 で最終確認。

## Latest Handoff

- 2026-05-13: v0.3.1 Issue #5〜#7 修正 — `docs/setup/providers/transformers.md`
	を新設し、`docs/setup/providers/README.md` に `transformers` を追加。
	Walkthrough の `pickProvider.md` は 3 プロバイダ表記へ更新し、install 系
	Markdown は重複手順を削除して canonical setup docs へのリンク方式へ統一。
- 2026-05-13: Translate View 再検知 — `src/translateView.ts` で
	`view.onDidChangeVisibility` を購読し、View 再表示時に `postState()` /
	`postHistory()` を再送するよう変更。
- 2026-05-13: Markdown 構造保持 — `src/incremental.ts` の block splitter を
	改修し、空行・行境界を passthrough span として保持。Markdown の見出し・
	引用・リスト・表行を 1 行単位で分離し、`translateIncremental()` は `join('')`
	で構造を復元する。`runFullTranslation()` も同じロジックを利用するよう変更。

- 2026-05-12: TASK-libretranslate-no-server-investigation — `src/providers/transformersProvider.ts` 追加。`@huggingface/transformers` を**遅延 require**し、未インストール時は `provider.transformers.notInstalled` を返す。`installTransformersBackend(context)` (コマンド `lingobridge.installTransformersBackend`) が拡張ディレクトリで `npm install @huggingface/transformers` を実行。バックエンド本体は VSIX に同梱しない (onnxruntime-node ~260MB のため)。
- 2026-05-12: TASK-00005 差分翻訳 — `src/incremental.ts` を新設。Markdown は見出し / 空行で、それ以外は段落で分割。SHA-1 を `<basename>.<lang>.lb.json` に保存。コマンド `lingobridge.translateDocumentIncremental` (`cmd+alt+i`) と `runIncrementalTranslation()` を `extension.ts` に追加。Status Bar に `msg.incrementalStats` 表示。
- 2026-05-12: TASK-00004 保護細粒度化 — `src/protection.ts` をルールテーブル方式へ refactor。`ProtectionTargetKey` に 11 種類 (`fencedCode` / `inlineCode` / `url` / `markdownHeading` / `markdownTable` / `markdownList` / `shellCommand` / `filePath` / `logLine` / `diffMarker` / `identifier`) を定義し、`lingobridge.protection.targets` で個別 ON/OFF。既定値は v0.2.x 互換 (3 種のみ ON)。`translationService.readProtectionTargets()` を export。
- 2026-05-12: TASK-00014 Onboarding 再設計 — `globalState` キー `lingobridge.onboarding.shown.v0.3.0` で初回起動時に Walkthrough を 1.5s 後に自動オープン。再オープン用に `lingobridge.openGettingStarted` を追加。Walkthrough に `installTransformers` ステップ + `media/walkthrough/installTransformers.md` を新設。
- 2026-05-12: l10n 更新 — `package.nls.json` / `package.nls.ja.json` / `l10n/bundle.l10n.{json,ja.json}` に `cmd.translateDocumentIncremental` / `cmd.openGettingStarted` / `cmd.installTransformersBackend` / `provider.transformers.*` (9 件) / `msg.incrementalStats` などを追加。
- 2026-05-12: テスト更新 — `test/suite/incremental.test.ts` / `transformersProvider.test.ts` を新規作成。`contributions.test.ts` をコマンド 8 → 11、キーバインド 5 → 6 に更新。

## Verification

- focused regression: `npm test -- --grep "Issue #5|Issue #6|markdown tables keep one-line row boundaries in output"`
  → 5 passing。
- full `npm test`: 82 passing, 2 pending (gated)。
- VSIX: `npm run package:vsix` で `lingobridge-0.3.1.vsix` を生成済み。
- 実機 F5: 未検証 (ユーザー側で確認)。

## Backlog (次期候補)

- TASK-00007/00013 のフォローアップ (Walkthrough のステップ完了検知精度向上)。
- VS Code Language Model `countTokens` API の利用 (現状はヒューリスティック / tiktoken)。
- 差分翻訳のサイドカー UI (履歴ビューでの可視化)。
- transformers プロバイダの組み込みモデル DL ステータス表示。
