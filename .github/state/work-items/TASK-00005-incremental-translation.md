> Status: completed (v0.3.0 — 2026-05-12)

# TASK-00005-incremental-translation

- Version: v0.2.0
- Status: completed
- Owner: -

## Goal

既存の翻訳済みファイル (`README.en.md` 等) と原文の差分を検出し、変更があったブロックだけを再翻訳して結果をマージする。大規模ドキュメントの再翻訳コストを大幅削減する。

## Acceptance

- [x] コマンド `lingobridge.translateDocumentIncremental` を追加 (タイトルバー/コンテキストにも追加検討)。
- [x] 原文をブロック分割 (Markdown は見出し + 空行区切り、プレーンテキストは段落 = 空行区切り)。
- [x] 既存出力ファイルのサイドカー JSON (`.<basename>.lb.json`) に「ブロックハッシュ → 翻訳結果」マップを保存。
- [x] 再実行時、ハッシュ一致ブロックは流用、不一致のみプロバイダに送る。
- [x] 削除されたブロックは出力から除去、追加ブロックは末尾でなく原文順位置に挿入。
- [x] `lingobridge.incremental.enabled` (default true) で従来動作に戻せる。
- [x] 統計表示: 「翻訳: X / 流用: Y / 計: Z ブロック」を Status Bar に出す (空白だけのブロックは passthrough として総数に含めず、「スキップ」概念は採用しない)。
- [x] テスト: 1 ブロック差し替え時に対象ブロックのみ翻訳されること、順序が保たれること、空白だけの変更で再翻訳されないこと (`test/suite/incremental.test.ts`)。

## Notes

- A2 (選択範囲のみ翻訳) は本タスクの「ブロック単位翻訳」と相性が良いので、内部 API を共用できる設計にする。
- ハッシュは正規化 (改行コード/末尾空白除去) 後の SHA-1 で十分。
- サイドカー JSON は `.gitignore` 推奨か、コミット推奨かをドキュメントに明記。
- Markdown ブロック分割ロジックは `protection.ts` の placeholder 機構を拡張する形で組むのが筋。
