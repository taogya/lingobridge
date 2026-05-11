# Install transformers.js (server-less)

`transformers.js` runs translation models entirely **inside the VS Code extension process** — no Python, no LibreTranslate server, no external API.

> Trade-off: the backend pulls in `onnxruntime-node` (~260 MB unpacked) and downloads ~50–200 MB of model weights on first use. That is why it is **not** bundled with lingobridge.

## Install

Run the command:

```
lingobridge: Install transformers.js Backend (server-less)
```

The extension opens a terminal and executes:

```
npm install @huggingface/transformers
```

inside its own folder. After it finishes, **reload the window** (`Developer: Reload Window`) and select `transformers` in `lingobridge.provider.active`.

## Default model map

| Pair  | Model |
| ----- | ----- |
| ja-en | `Xenova/opus-mt-ja-en` |
| en-ja | `Xenova/opus-mt-en-jap` |
| en-zh | `Xenova/opus-mt-en-zh` |
| zh-en | `Xenova/opus-mt-zh-en` |
| en-fr | `Xenova/opus-mt-en-fr` |
| en-de | `Xenova/opus-mt-en-de` |

Override per-pair in settings:

```jsonc
"lingobridge.transformers.modelMap": {
  "ja-en": "Xenova/opus-mt-ja-en"
}
```
