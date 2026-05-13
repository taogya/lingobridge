# 翻訳プロバイダを選ぶ

[プロバイダ セットアップ](https://github.com/taogya/lingobridge/blob/main/docs/setup/providers/README.md) から、
使いたいプロバイダの手順を開いてインストールしてください。

`lingobridge` は **完全オフライン** で動作する 3 つのプロバイダを選べます。

- **atrans** — macOS 専用。Apple Translation framework を呼び出すラッパー。
- **LibreTranslate** — クロスプラットフォーム (Windows / macOS / Linux)。
  ローカル HTTP サーバ。
- **transformers** — クロスプラットフォーム (Windows / macOS / Linux)。
  拡張プロセス内でモデルを動かすサーバ不要バックエンド。

設定 (`lingobridge.provider.active`) で使いたいプロバイダを指定してください。
既定は `atrans` です。**Windows / Linux ユーザーは `libretranslate` または
`transformers` を選んでください。**

> ヒント: 翻訳パネル上部のバッジは、選択中のプロバイダに到達できると
> 赤 (*未検出*) から緑 (*利用可能*) に変わります。
