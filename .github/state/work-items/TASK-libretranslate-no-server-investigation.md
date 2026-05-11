> Status: completed (v0.3.0 — 2026-05-12)

# TASK-libretranslate-no-server-investigation

- Version: **v0.3.0** (機能追加のため MINOR バンプ)
- Status: completed (transformers プロバイダとして v0.3.0 で実装)
- Owner: -

> v0.2.1 (patch) には**含めない**。理由は以下:
>
> - 新プロバイダ追加 + 新依存 (transformers.js / ONNX runtime) は機能追加であり patch では不適切。
> - VSIX サイズへの影響 (>10MB) があり、patch 配布の互換性期待を裏切る。
> - v0.2.1 CHANGELOG には「v0.3.0 で予定」とのみ告知済み。

## Goal

LibreTranslate プロバイダの「サーバー常駐」要求を撤廃するため、
ローカルプロセス内 (拡張ホスト or 子プロセス) で完結する代替手段を調査する。

## 背景

- LibreTranslate は Python 製。`pip install libretranslate` 後、
  `libretranslate --host 127.0.0.1 --port 5000 --load-only ja,en` で常駐する必要がある。
- ユーザー (特に Windows / 非開発者) は「常駐サーバを立て続ける」のを嫌う傾向。
- atrans CLI のように「都度実行 → 結果を取る」モデルにできれば導入障壁が大きく下がる。

## 調査結果サマリ

| 候補 | 言語 | 特徴 | 実用性 |
| --- | --- | --- | --- |
| **transformers.js (`@huggingface/transformers`)** | TS/JS (純 JS) | ONNX Runtime Web/Node で MarianMT/NLLB を直接実行。`Helsinki-NLP/opus-mt-ja-en` / `opus-mt-en-jap` の ONNX 変換モデルが Hub に存在 | **◎ 最有力**。VS Code 拡張から直接 import 可能。初回モデルダウンロード (50–200MB) を `globalStoragePath` にキャッシュ |
| ONNX Runtime + 自前ローダー | TS/JS | transformers.js より軽量だが BPE トークナイザを自前実装する必要あり | △ 工数大 |
| `ctranslate2-node` | Native (binding) | 高速だが prebuilt が limited、Windows ビルド要注意 | △ 配布が面倒 |
| Python サブプロセス (atrans 方式) | Python | `python -m libretranslate ...` を都度起動 → 1 リクエスト 5 秒以上 (モデル毎ロード) | ✕ 性能不足 |
| Mozilla Bergamot WASM | C++/WASM | ja↔en の公式モデル提供なし。`firefox-translations-models` も 2025-12 アーカイブ済み | ✕ 不可 |
| `libretranslate-js` 等の HTTP クライアント | TS/JS | サーバ前提のラッパー。本要件 (サーバ撤廃) には寄与しない | ✕ |

## 推奨アクション

1. **新プロバイダ `transformers` を追加**して LibreTranslate と並存させる。
   - 設定キー: `lingobridge.transformers.model.<from>-<to>` (既定: Helsinki-NLP)
   - モデルキャッシュ先: `context.globalStorageUri` 配下
   - 初回起動時に「~120MB ダウンロードします。続行しますか?」確認モーダル
2. v0.3.x スコープ。VSIX サイズが極端に増えないよう、依存は **ピア (lazy require)** に留め
   ユーザーがオプションで `npm i @huggingface/transformers` 相当を VS Code 拡張内から
   `installDependency` 実行する形式を検討。
3. LibreTranslate サーバ方式は「マルチユーザー / リモート共有」用途の選択肢として残す。

## Open questions

- `@huggingface/transformers` の Node サポート (>= v3.0) で seq2seq 翻訳が安定動作するか?
  → 公式に `Xenova/opus-mt-ja-en`, `Xenova/opus-mt-en-jap` の ONNX が存在。
- VS Code 拡張ホストの heap 上限 (~1.5GB) 内で MarianMT が完走するか? メモリ計測が必要。
- VSIX に含めず初回起動時にダウンロードする場合の UX (Copilot 流の進捗 UI)。

## References

- https://huggingface.co/docs/transformers.js
- https://huggingface.co/Xenova/opus-mt-ja-en
- https://huggingface.co/Xenova/opus-mt-en-jap
- https://onnxruntime.ai/docs/get-started/with-javascript/
