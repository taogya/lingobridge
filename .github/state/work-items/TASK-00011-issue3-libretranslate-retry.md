# TASK-00011-issue3-libretranslate-retry

- Version: v0.2.1
- Status: done
- Owner: -
- Issue: taogya/lingobridge#3

## Goal

LibreTranslate プロバイダで、しばらく使わなかった後の最初の翻訳が
`socket hang up` / `ECONNRESET` 系で失敗する問題を解消する。

## Root cause

`fetch` の HTTP keep-alive ソケットがサーバ側で先に閉じられた直後に再利用されると RST が返る。

## Acceptance

- [x] 再現テスト: `global.fetch` をモックし、初回は `Error('socket hang up')` を投げ、2回目は 200 を返すケースで `calls === 2` かつ `status === 'ok'` になることを assert。
- [x] リクエストヘッダに `Connection: close` を追加。
- [x] `fetchWithRetry()` で transient なソケットエラー (ECONNRESET / EPIPE / UND_ERR_SOCKET / ETIMEDOUT / "socket hang up" / "other side closed") を1回だけリトライ。
- [x] テスト全件 GREEN。
