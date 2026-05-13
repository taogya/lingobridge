# プロバイダ セットアップ

lingobridge の各翻訳プロバイダの導入手順です。
利用するものだけ導入してください。1 つだけで動作します。

| プロバイダ | OS | 詳細 |
| --- | --- | --- |
| `atrans` (既定) | macOS | [atrans.md](atrans.md) |
| `libretranslate` | macOS / Linux / Windows | [libretranslate.md](libretranslate.md) |
| `transformers` | macOS / Linux / Windows | [transformers.md](transformers.md) |

設定で切替: `lingobridge.provider.active` を `atrans` / `libretranslate` /
`transformers` のいずれかに設定します。

導入後は `lingobridge: Check Providers (availability)…` を実行すると、
3 つのプロバイダの状態をまとめて確認できます。
