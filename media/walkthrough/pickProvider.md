# 翻訳プロバイダを選ぶ

`lingobridge` は **完全オフライン** で動作する 2 つのプロバイダを同梱しています。

- **atrans** — macOS 専用。Apple Translation framework を呼び出すラッパー。
  高速で外部に一切データを送りません。
- **LibreTranslate** — クロスプラットフォーム (Windows / macOS / Linux)。
  `libretranslate --host 127.0.0.1 --port 5000` で起動するローカル HTTP サーバ。

設定 (`lingobridge.provider.active`) で使いたいプロバイダを指定してください。
既定は `atrans` です。**Windows / Linux ユーザーは `libretranslate` に変更してください。**

> ヒント: 翻訳パネル上部のバッジは、選択中のプロバイダに到達できると
> 赤 (*未検出*) から緑 (*利用可能*) に変わります。
