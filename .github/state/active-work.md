# Active Work State

軽量な引き継ぎ用。直近の判断、次アクション、検証状態だけを残します。

## Current Focus

- v0.3.4 で Issue #7 を「再々対応」として根本修正 + Phase 1 追加保護ルールを
	既定 ON 化 + requirements.md を同期。Ctrl+Alt+E 経由のドキュメント翻訳で
	インライン Markdown / 数式 / HTML / autolink / 参照リンク / タスクリストが
	破壊的モデルで失われる事象をまとめて解消。
- 次アクション: ユーザー側で実機 F5 確認 → コミット → Push / release tag。

## Latest Handoff

- 2026-05-20 (v0.3.4 release prep / 拡張スコープ完了):
	**TASK-issue7-v034-inline-markdown** に加え、ユーザー指示で A+C+E
	(requirements 同期 / Phase 1 追加保護 / プロバイダ選択ガイド) を同一
	コミットへ集約。
	- 保護層: `src/protection.ts` に既定 ON ルール 8 種を追加 ―
		`inlineEmphasis` / `markdownLink` (Issue #7 本体) と
		`mathBlock` / `mathInline` / `htmlInline` / `autoLink` /
		`referenceLink` / `taskList` (Phase 1)。`restore()` は最大 6 パスで
		(a) 完全一致 → (b) `⟦...⟧` 内部分残存 → (c) relaxed regex を反復。
		`mathInline` は通貨 `$10` 誤検出を lookahead で回避、`autoLink` は
		`url` より先に走らせて `<>` ごと保持。
	- 設定: `package.json` schema を 19 キー (既定 ON 11 / OFF 8) に拡張、
		`package.nls(.ja).json` の説明を更新、`translationService.ts` の
		compatDefaults も同期。
	- テスト: `test/suite/protectionExtraRules.test.ts` を新設 (11 件)。
		`test/suite/configuration.test.ts` / `test/suite/protection.test.ts` /
		`test/suite/issuesV034.test.ts` (9 件) の既定値アサートも更新。
		`npm test` は 118 passing / 3 pending。
	- ドキュメント: `docs/requirements.md` を v0.3.4 ヘッダへ更新し、§5 に
		コマンド一覧 (`lingobridge.checkProviders` 含む 10 件)、§8 に
		プロバイダ選択ガイド (atrans / libretranslate / transformers の
		比較表 + 選択フロー) を追加。FUN-11 / FUN-19 / FUN-20 と §4 設定表を
		19 保護キー構成に同期。
	- リリース成果物: `npm run package:vsix` で `lingobridge-0.3.4.vsix` を
		再生成 (本コミット前の最終ステップ)。VSIX には `docs/` / `examples/` /
		`src/` / `test/` / `.venv/` / `node_modules/@huggingface/transformers`
		を含めない。

- 2026-05-19 (v0.3.3 release prep): 未Push `Release v0.3.3` は機能修正だけが
	先行し、`package.json` / `package-lock.json` / `CHANGELOG.md` /
	`.github/state/active-work.md` / `test/suite/issuesV032.test.ts` の release metadata
	が作業ツリー側に残っていた。v0.3.3 は 1 コミットへ再集約する前提で
	`npm test` (98 passing, 2 pending) と `npm run package:vsix`
	(`lingobridge-0.3.3.vsix`, 38 files, 1.65 MB) を再実行し、VSIX に
	`docs/` / `examples/` / `src/` / `test/` / `.venv/` /
	`node_modules/@huggingface/transformers` が含まれないことを確認。
- 2026-05-14 (v0.3.2 follow-up): Walkthrough の command link は `media.markdown`
	ではなく step `description` に移動。`checkProviders` / `firstTranslation` の
	アクションリンクを nls description 側へ移し、media 側の死にリンクを撤去。
	`lingobridge.checkProviders` は長文 modal をやめ、QuickPick で状態確認・
	セットアップガイド起動・active 切替・transformers 導入に進める UI へ変更。
- 2026-05-14 (v0.3.2 release prep): README / provider docs / settings samples を更新し、
	削除済み `media/walkthrough/installTransformers.md` 参照を撤去。`transformers`
	用 `examples/settings/transformers.settings.jsonc` を追加し、
	`lingobridge: Install transformers.js Backend (server-less)…` 表記へ統一。
	`.vscodeignore` に `*.vsix` / `.DS_Store` を追加。Markdown 相対リンク検証、
	PII / 不要記述スキャン、VSIX 内容検査を通過。
- 2026-05-13 (v0.3.2): Issue #7 真の修正 — `src/incremental.ts` の `BlockSpan`
	に `parts: BlockPart[]` を追加し、見出し/引用/リスト/表行をリテラル markup
	部とテキスト部に分解。翻訳器にはテキスト部のみ渡し、結果を再縫合する。
	表 separator 行 (`| --- |`) は翻訳器に渡さず温存。サイドカー JSON は
	`version: 2` に bump。`splitMarkdownStructuralLine` を export。
- 2026-05-13 (v0.3.2): Issue #7 再現テスト追加 — markdown 記号 (`#>|*-`) を
	落とす破壊的スタブで `# Title` → `# TITLE`、`| Key | Value |` →
	`| KEY | VALUE |` などを検証。`test/suite/incremental.test.ts` に 2 件、
	`test/suite/issuesV032.test.ts` に splitter 単体テスト 1 件を追加。
- 2026-05-13 (v0.3.2): Issue #5 再対応 — Walkthrough を再設計。
	`pickProvider.md` を冒頭リンク+短文化。`installAtrans/Libre/Transformers.md`
	を削除し `checkProviders.md` を新設。新コマンド `lingobridge.checkProviders`
	が 3 プロバイダの可用性を `[x]/[ ]` 表示。`firstTranslation.md` に翻訳
	パネル起動の command link を追加。
- 2026-05-13 (v0.3.2): l10n 更新 — `cmd.checkProviders.title` /
	`walkthrough.step.checkProviders.*` / `msg.checkProviders` を追加し、
	旧 `installAtrans/Libre/Transformers` キーを削除。
- 2026-05-13 (v0.3.2): テスト更新 — `contributions.test.ts` を 11 → 12
	コマンドへ。`issuesV031.test.ts` の install-pages 検証を撤去。

- 2026-05-13: v0.3.1 Issue #5〜#7 修正 — `docs/setup/providers/transformers.md`
	を新設し、`docs/setup/providers/README.md` に `transformers` を追加。
	Walkthrough の `pickProvider.md` は 3 プロバイダ表記へ更新し、install 系
	Markdown は重複手順を削除して canonical setup docs へのリンク方式へ統一。
- 2026-05-13: Translate View 再検知 — `src/translateView.ts` で
	`view.onDidChangeVisibility` を購読し、View 再表示時に `postState()` /
	`postHistory()` を再送するよう変更。
- 2026-05-13: Markdown 構造保持 (v0.3.1 の暫定対応) — `src/incremental.ts` の
	block splitter を改修し、空行・行境界を passthrough span として保持。

## Verification

- focused regression: `npx vscode-test --run out/test/suite/issuesV034.test.js`
	`--run out/test/suite/protection.test.js` `--run out/test/suite/incremental.test.js`
	`--run out/test/suite/configuration.test.js` → 52 passing。
- full `npm test`: 107 passing, 3 pending (transformers gated を含む)。
- VSIX: `npm run package:vsix` 済み。`lingobridge-0.3.4.vsix`。packaging log で
	`dist/` / `l10n/` / `media/` / `resources/` / `node_modules/js-tiktoken/`
	のみ同梱、`docs/` / `examples/` / `src/` / `test/` / `.venv/` /
	`node_modules/@huggingface/transformers` が除外されることを確認。
- 実機 F5: 未検証 (ユーザー側で確認)。

- 2026-05-12: TASK-libretranslate-no-server-investigation — `src/providers/transformersProvider.ts` 追加。`@huggingface/transformers` を**遅延 require**し、未インストール時は `provider.transformers.notInstalled` を返す。`installTransformersBackend(context)` (コマンド `lingobridge.installTransformersBackend`) が拡張ディレクトリで `npm install @huggingface/transformers` を実行。バックエンド本体は VSIX に同梱しない (onnxruntime-node ~260MB のため)。
- 2026-05-12: TASK-00005 差分翻訳 — `src/incremental.ts` を新設。Markdown は見出し / 空行で、それ以外は段落で分割。SHA-1 を `<basename>.<lang>.lb.json` に保存。コマンド `lingobridge.translateDocumentIncremental` (`cmd+alt+i`) と `runIncrementalTranslation()` を `extension.ts` に追加。Status Bar に `msg.incrementalStats` 表示。
- 2026-05-12: TASK-00004 保護細粒度化 — `src/protection.ts` をルールテーブル方式へ refactor。`ProtectionTargetKey` に 11 種類 (`fencedCode` / `inlineCode` / `url` / `markdownHeading` / `markdownTable` / `markdownList` / `shellCommand` / `filePath` / `logLine` / `diffMarker` / `identifier`) を定義し、`lingobridge.protection.targets` で個別 ON/OFF。既定値は v0.2.x 互換 (3 種のみ ON)。`translationService.readProtectionTargets()` を export。
- 2026-05-12: TASK-00014 Onboarding 再設計 — `globalState` キー `lingobridge.onboarding.shown.v0.3.0` で初回起動時に Walkthrough を 1.5s 後に自動オープン。再オープン用に `lingobridge.openGettingStarted` を追加。Walkthrough に `installTransformers` ステップ + `media/walkthrough/installTransformers.md` を新設。
- 2026-05-12: l10n 更新 — `package.nls.json` / `package.nls.ja.json` / `l10n/bundle.l10n.{json,ja.json}` に `cmd.translateDocumentIncremental` / `cmd.openGettingStarted` / `cmd.installTransformersBackend` / `provider.transformers.*` (9 件) / `msg.incrementalStats` などを追加。
- 2026-05-12: テスト更新 — `test/suite/incremental.test.ts` / `transformersProvider.test.ts` を新規作成。`contributions.test.ts` をコマンド 8 → 11、キーバインド 5 → 6 に更新。

## Backlog (次期候補)

- TASK-00007/00013 のフォローアップ (Walkthrough のステップ完了検知精度向上)。
- VS Code Language Model `countTokens` API の利用 (現状はヒューリスティック / tiktoken)。
- 差分翻訳のサイドカー UI (履歴ビューでの可視化)。
- transformers プロバイダの組み込みモデル DL ステータス表示。
