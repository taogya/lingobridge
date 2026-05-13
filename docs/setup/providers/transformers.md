# transformers (マルチOS)

VS Code 拡張プロセス内で MarianMT / ONNX モデルを動かす方式です。
Python サーバや外部 API を使わず、macOS / Linux / Windows で利用できます。

## インストール

コマンドパレットから次のコマンドを実行します。

- `lingobridge: Install transformers.js Backend (server-less)…`

拡張の配置先に `@huggingface/transformers` が追加されます。
初回セットアップ後は **Developer: Reload Window** でウィンドウを再読み込みしてください。
導入後は `lingobridge: Check Providers (availability)…` で利用可能か確認できます。

## 初回利用時の注意

- バックエンド本体として `onnxruntime-node` を含むため、展開後サイズは大きめです。
- 最初の翻訳ではモデル重みがダウンロードされるため、通常より時間が掛かります。
- モデルは既定で transformers.js のキャッシュディレクトリに保存されます。

## 設定

| 設定キー | 既定値 | 用途 |
| --- | --- | --- |
| `lingobridge.provider.active` | `atrans` | `transformers` を選択 |
| `lingobridge.transformers.modelMap` | `{}` | 言語ペアごとのモデル ID 上書き |
| `lingobridge.transformers.cacheDir` | `""` | モデルキャッシュ保存先 |
| `lingobridge.transformers.timeoutMs` | `60000` | 呼び出しタイムアウト (ミリ秒) |

## 既定モデル

| Pair | Model |
| --- | --- |
| `ja-en` | `Xenova/opus-mt-ja-en` |
| `en-ja` | `Xenova/opus-mt-en-jap` |
| `en-zh` | `Xenova/opus-mt-en-zh` |
| `zh-en` | `Xenova/opus-mt-zh-en` |
| `en-ko` | `Xenova/opus-mt-en-ko` |
| `ko-en` | `Xenova/opus-mt-ko-en` |
| `en-fr` | `Xenova/opus-mt-en-fr` |
| `fr-en` | `Xenova/opus-mt-fr-en` |
| `en-de` | `Xenova/opus-mt-en-de` |
| `de-en` | `Xenova/opus-mt-de-en` |

例:

```jsonc
"lingobridge.transformers.modelMap": {
  "ja-en": "Xenova/opus-mt-ja-en"
}
```

そのまま貼り付けられる `settings.json` サンプル: [examples/settings/transformers.settings.jsonc](../../../examples/settings/transformers.settings.jsonc)