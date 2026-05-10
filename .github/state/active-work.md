# Active Work State

軽量な引き継ぎ用。直近の判断、次アクション、検証状態だけを残します。

## Current Focus

- v0.2.0 リリース準備完了。TASK-00002/00003/00006/00008 を取り込み、テストを 49 passing (+2 gated) まで拡充。VSIX (`lingobridge-0.2.0.vsix`) ビルド済み。
- 次アクション: コミット → `git tag v0.2.0` → `git push --follow-tags` → Marketplace へ手動アップロード。

## Latest Handoff

- 2026-05-10: lingobridge v0.2.0 実装。タイトルバーは `$(globe)` 1 ボタン + QuickPick に集約し、多言語ペアを見越しした記号へ変更。
- 2026-05-10: 設定 13 項目 (`lingobridge.languagePairs` / `lingobridge.history.enabled` / `lingobridge.history.maxEntries` を追加)。
- 2026-05-10: i18n は en 既定、`vscode.env.language` が `ja*` のとき日本語。クラスタイトル/設定説明は `package.nls(.ja).json`、ランタイム文言は `l10n/bundle.l10n(.ja).json` に集約。Webview / プロバイダのエラー文も `vscode.l10n.t()` 化。
- 2026-05-10: 自動テストを拡充 (`contributions` / `configuration` / `languagePairs` / `history` / `view` / `statusBar` / `liveProviders`)。実プロバイダ通信は環境変数 `LINGOBRIDGE_TEST_LIBRE_ENDPOINT` / `LINGOBRIDGE_TEST_ATRANS=1` で gating。
- 2026-05-10: `.vscodeignore` に開発者向け README を追記し、VSIX を 31 files / 1.63 MB に整理。

## Verification

- `npm test`: 49 passing, 2 pending (gated)。
- VSIX: `lingobridge-0.2.0.vsix` 再ビルド済み (1.63 MB)。
- 実機 F5: 未検証 (ユーザー側で確認)。

## Backlog (次期候補)

- TASK-00004 (保護の細粒度) / TASK-00005 (差分翻訳) / TASK-00007 (Walkthrough)。
- VS Code Language Model `countTokens` API の利用。
