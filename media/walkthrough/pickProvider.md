# 翻訳プロバイダを選ぶ

`lingobridge` は **完全オフライン** で動作する 3 つのプロバイダを選べます。

- **atrans** — macOS 専用。Apple Translation framework を呼び出すラッパー。
  高速で外部に一切データを送りません。
- **LibreTranslate** — クロスプラットフォーム (Windows / macOS / Linux)。
  `libretranslate --host 127.0.0.1 --port 5000` で起動するローカル HTTP サーバ。
- **transformers** — クロスプラットフォーム (Windows / macOS / Linux)。
  拡張プロセス内でモデルを動かすサーバ不要バックエンドです。

設定 (`lingobridge.provider.active`) で使いたいプロバイダを指定してください。
既定は `atrans` です。**Windows / Linux ユーザーは `libretranslate` または
`transformers` を選んでください。**

セットアップの本文はウォークスルー内で重複管理せず、
[プロバイダ セットアップ](https://github.com/taogya/lingobridge/blob/main/docs/setup/providers/README.md)
に一本化しています。ここから使いたいプロバイダの手順を開いてください。

> ヒント: 翻訳パネル上部のバッジは、選択中のプロバイダに到達できると
> 赤 (*未検出*) から緑 (*利用可能*) に変わります。
