# LibreTranslate (マルチOS)

ローカルで Python サーバを起動し、HTTP で翻訳します。完全オフライン。
macOS / Linux / Windows で利用可。

## インストール

Python 3.10+ が必要です。

```bash
pip install libretranslate
```

汚染を避けたい場合は仮想環境を推奨:

```bash
python3 -m venv ~/.venv/libretranslate
~/.venv/libretranslate/bin/pip install libretranslate
```

## 起動

```bash
libretranslate --host 127.0.0.1 --port 5000 --load-only ja,en
```

初回起動時に ja↔en モデル (~150MB) が自動ダウンロードされます。
別ターミナルで常駐させたまま VS Code を使ってください。

## 動作確認

```bash
curl http://127.0.0.1:5000/languages
```

以下のような JSON が返れば OK:

```json
[
  {"code":"en","name":"English","targets":["en","ja"]},
  {"code":"ja","name":"Japanese","targets":["en","ja"]}
]
```

翻訳テスト:

```bash
curl -s -X POST http://127.0.0.1:5000/translate \
  -H 'content-type: application/json' \
  -d '{"q":"Hello","source":"en","target":"ja","format":"text"}'
```

## 設定

| 設定キー | 既定値 | 用途 |
| --- | --- | --- |
| `lingobridge.provider.active` | `atrans` | `libretranslate` を選択 |
| `lingobridge.libretranslate.endpoint` | `http://127.0.0.1:5000` | サーバ URL |
| `lingobridge.libretranslate.apiKey` | `""` | API キー (任意) |
| `lingobridge.libretranslate.timeoutMs` | `30000` | タイムアウト (ミリ秒) |

そのまま貼り付けられる `settings.json` サンプル: [examples/settings/libretranslate.settings.jsonc](../../../examples/settings/libretranslate.settings.jsonc)
