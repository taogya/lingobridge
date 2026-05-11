# LibreTranslate をインストールする (クロスプラットフォーム)

`pip install libretranslate` でインストールし、ループバック上でサーバを起動します。

```bash
pip install libretranslate
libretranslate --host 127.0.0.1 --port 5000 --load-only ja,en
```

初回起動時に JA↔EN モデル (約 150 MB) がダウンロードされます。
VS Code を使っている間はターミナルを開いたままにしておいてください。
サーバが応答すると、翻訳パネルのバッジが緑に変わります。

仮想環境の使い方やサーバの常駐化など詳しいオプションは
[docs/setup/providers/libretranslate.md](https://github.com/taogya/lingobridge/blob/main/docs/setup/providers/libretranslate.md) を参照してください。
