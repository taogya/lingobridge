> Status: completed (v0.3.0 — 2026-05-12)

# TASK-00004-fine-grained-protection

- Version: v0.2.0
- Status: completed
- Owner: -

## Goal

現状一括 ON/OFF の保護機能を、対象種別ごとに細かく制御できるようにする。Markdown 構造保護 (見出し記号・表区切り・リスト記号) もこの仕組みに統合する。

## Acceptance

- [x] 設定 `lingobridge.protection.targets` (object) を新設:
  ```jsonc
  "lingobridge.protection.targets": {
    "fencedCode": true,
    "inlineCode": true,
    "url": true,
    "markdownHeading": true,    // # ## ### の記号と階層
    "markdownTable": true,      // | --- | などの区切り
    "markdownList": true,       // -, *, 1. 等の行頭記号
    "shellCommand": false,      // $ で始まる行など (オプトイン)
    "filePath": false,
    "logLine": false,
    "diffMarker": false,        // +/- 行頭
    "identifier": false         // snake_case / CamelCase
  }
  ```
- [x] 既定値は現行互換 (`fencedCode`, `inlineCode`, `url` のみ true)。
- [x] `lingobridge.protection.enabled` が false の場合はすべて無効化 (上位スイッチ)。
- [x] `protection.ts` をプラガブルなルールセットに再構成。各ルールは `{name, pattern, replace, restore}` を実装。
- [x] 各ルールのテストを追加 (round-trip テスト: 保護 → 翻訳ダミー → 復元 で原文の構造が保たれること)。
- [x] requirements.md / design.md の保護機能説明を更新。

## Notes

- B3 (Markdown 構造保護) は本タスクに統合。
- ルール衝突 (ネスト) は登録順で評価。
- placeholder トークンは現行同様 `⟦LB:N⟧` 系を踏襲。
