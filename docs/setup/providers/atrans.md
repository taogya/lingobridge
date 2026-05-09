# atrans (macOS)

macOS の Apple Translation framework を呼ぶ CLI。完全オフラインで高速。

## インストール

```bash
brew tap taogya/atrans
brew install atrans
```

詳細: <https://github.com/taogya/homebrew-atrans>

## 起動

常駐サーバ不要。lingobridge が翻訳のたびに `atrans` を起動します。

## 動作確認

```bash
echo "Hello, world." | atrans --from en --to ja
```

`こんにちは、世界。` のような出力が得られれば OK。

## 設定

| 設定キー | 既定値 | 用途 |
| --- | --- | --- |
| `lingobridge.provider.active` | `atrans` | `atrans` を選択 |
| `lingobridge.atrans.path` | `""` | 自動検出。任意で絶対パスを指定可 |
| `lingobridge.atrans.timeoutMs` | `30000` | タイムアウト (ミリ秒) |

そのまま貼り付けられる `settings.json` サンプル: [examples/settings/atrans.settings.jsonc](../../../examples/settings/atrans.settings.jsonc)
