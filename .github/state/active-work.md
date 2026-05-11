# Active Work State

軽量な引き継ぎ用。直近の判断、次アクション、検証状態だけを残します。

## Current Focus

- v0.3.0 実装完了。`transformers` プロバイダ (TASK-libretranslate-no-server-investigation)・差分翻訳 (TASK-00005)・保護の細粒度化 (TASK-00004)・Onboarding 自動オープン (TASK-00014) を取り込み済み。テストは 61 passing / 2 pending。
- 次アクション: `npm run package:vsix` で `lingobridge-0.3.0.vsix` をビルド → ユーザー側で実機 F5 / `code --install-extension` 検証。

## Latest Handoff

- 2026-05-12: TASK-libretranslate-no-server-investigation — `src/providers/transformersProvider.ts` 追加。`@huggingface/transformers` を**遅延 require**し、未インストール時は `provider.transformers.notInstalled` を返す。`installTransformersBackend(context)` (コマンド `lingobridge.installTransformersBackend`) が拡張ディレクトリで `npm install @huggingface/transformers` を実行。バックエンド本体は VSIX に同梱しない (onnxruntime-node ~260MB のため)。
- 2026-05-12: TASK-00005 差分翻訳 — `src/incremental.ts` を新設。Markdown は見出し / 空行で、それ以外は段落で分割。SHA-1 を `<basename>.<lang>.lb.json` に保存。コマンド `lingobridge.translateDocumentIncremental` (`cmd+alt+i`) と `runIncrementalTranslation()` を `extension.ts` に追加。Status Bar に `msg.incrementalStats` 表示。
- 2026-05-12: TASK-00004 保護細粒度化 — `src/protection.ts` をルールテーブル方式へ refactor。`ProtectionTargetKey` に 11 種類 (`fencedCode` / `inlineCode` / `url` / `markdownHeading` / `markdownTable` / `markdownList` / `shellCommand` / `filePath` / `logLine` / `diffMarker` / `identifier`) を定義し、`lingobridge.protection.targets` で個別 ON/OFF。既定値は v0.2.x 互換 (3 種のみ ON)。`translationService.readProtectionTargets()` を export。
- 2026-05-12: TASK-00014 Onboarding 再設計 — `globalState` キー `lingobridge.onboarding.shown.v0.3.0` で初回起動時に Walkthrough を 1.5s 後に自動オープン。再オープン用に `lingobridge.openGettingStarted` を追加。Walkthrough に `installTransformers` ステップ + `media/walkthrough/installTransformers.md` を新設。
- 2026-05-12: l10n 更新 — `package.nls.json` / `package.nls.ja.json` / `l10n/bundle.l10n.{json,ja.json}` に `cmd.translateDocumentIncremental` / `cmd.openGettingStarted` / `cmd.installTransformersBackend` / `provider.transformers.*` (9 件) / `msg.incrementalStats` などを追加。
- 2026-05-12: テスト更新 — `test/suite/incremental.test.ts` / `transformersProvider.test.ts` を新規作成。`contributions.test.ts` をコマンド 8 → 11、キーバインド 5 → 6 に更新。

## Verification

- `npm test`: 61 passing, 2 pending (gated)。
- VSIX: 未ビルド (このリリース手順で実施)。
- 実機 F5: 未検証 (ユーザー側で確認)。

## Backlog (次期候補)

- TASK-00007/00013 のフォローアップ (Walkthrough のステップ完了検知精度向上)。
- VS Code Language Model `countTokens` API の利用 (現状はヒューリスティック / tiktoken)。
- 差分翻訳のサイドカー UI (履歴ビューでの可視化)。
- transformers プロバイダの組み込みモデル DL ステータス表示。
