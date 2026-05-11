import * as vscode from 'vscode';
import { tr } from '../i18n';
import {
  ProviderAvailability,
  TranslateOptions,
  TranslateResult,
  TranslationProvider
} from './translationProvider';

const DEFAULT_TIMEOUT = 60000;

/**
 * Default model map keyed by `<from>-<to>`. These are Helsinki-NLP MarianMT
 * checkpoints converted to ONNX by the Xenova / transformers.js community.
 * Users can override per pair via `lingobridge.transformers.modelMap`.
 *
 * NOTE: lingobridge does not bundle `@huggingface/transformers` (the package
 * pulls in `onnxruntime-node` ~260MB unpacked). Users opt in by running
 * the `lingobridge.installTransformersBackend` command.
 */
const DEFAULT_MODEL_MAP: Record<string, string> = {
  'ja-en': 'Xenova/opus-mt-ja-en',
  'en-ja': 'Xenova/opus-mt-en-jap',
  'en-zh': 'Xenova/opus-mt-en-zh',
  'zh-en': 'Xenova/opus-mt-zh-en',
  'en-ko': 'Xenova/opus-mt-en-ko',
  'ko-en': 'Xenova/opus-mt-ko-en',
  'en-fr': 'Xenova/opus-mt-en-fr',
  'fr-en': 'Xenova/opus-mt-fr-en',
  'en-de': 'Xenova/opus-mt-en-de',
  'de-en': 'Xenova/opus-mt-de-en'
};

export interface TransformersProviderOptions {
  /** Override model map. Keys are `<from>-<to>` (lower-case). */
  modelMap?: Record<string, string>;
  /** Cache directory for downloaded ONNX models. */
  cacheDir?: string;
}

interface TransformersLib {
  pipeline(task: string, model: string, options?: Record<string, unknown>): Promise<TranslationPipeline>;
  env: { cacheDir?: string; allowLocalModels?: boolean; allowRemoteModels?: boolean };
}

interface TranslationPipeline {
  (text: string, options?: Record<string, unknown>): Promise<TranslationOutput | TranslationOutput[]>;
}

type TranslationOutput = { translation_text?: string };

let cachedLib: TransformersLib | null = null;
const pipelineCache = new Map<string, TranslationPipeline>();

/**
 * Translation provider backed by `@huggingface/transformers` (transformers.js
 * v3+). Runs MarianMT / NLLB ONNX models entirely in-process — no server,
 * no Python. The package itself is **not bundled** with the VSIX; users
 * install it on demand via the `lingobridge.installTransformersBackend`
 * command (see TASK-libretranslate-no-server-investigation).
 */
export class TransformersProvider implements TranslationProvider {
  readonly id = 'transformers';
  readonly displayName = 'transformers.js (in-process, server-less)';

  constructor(private readonly options: TransformersProviderOptions = {}) {}

  async checkAvailability(): Promise<ProviderAvailability> {
    const lib = tryRequireLib();
    if (!lib) {
      return {
        available: false,
        detail: tr('provider.transformers.notInstalled')
      };
    }
    const map = this.resolveModelMap();
    const pairs = Object.keys(map)
      .map((k) => k.split('-'))
      .filter((p) => p.length === 2)
      .map(([from, to]) => ({ from, to }));
    return {
      available: true,
      detail: tr('provider.transformers.ready', String(pairs.length)),
      supportedPairs: pairs
    };
  }

  async translate(text: string, options: TranslateOptions): Promise<TranslateResult> {
    const lib = tryRequireLib();
    if (!lib) {
      return {
        status: 'notInstalled',
        errorMessage: tr('provider.transformers.notInstalled')
      };
    }
    const map = this.resolveModelMap();
    const key = `${options.direction.from}-${options.direction.to}`.toLowerCase();
    const modelId = map[key];
    if (!modelId) {
      return {
        status: 'failed',
        errorMessage: tr('provider.transformers.noModel', key)
      };
    }

    if (this.options.cacheDir) {
      lib.env.cacheDir = this.options.cacheDir;
    }
    lib.env.allowRemoteModels = true;

    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
    try {
      const pipe = await withTimeout(
        loadPipeline(lib, modelId),
        timeoutMs,
        () => tr('provider.transformers.timeout', String(timeoutMs))
      );
      const out = await withTimeout(
        pipe(text, { src_lang: options.direction.from, tgt_lang: options.direction.to }),
        timeoutMs,
        () => tr('provider.transformers.timeout', String(timeoutMs))
      );
      const translated = extractText(out);
      if (!translated) {
        return { status: 'failed', errorMessage: tr('provider.transformers.empty') };
      }
      return { status: 'ok', translatedText: translated };
    } catch (e) {
      const err = e as { name?: string; message?: string };
      if (err?.name === 'TimeoutError') {
        return { status: 'timeout', errorMessage: err.message };
      }
      return {
        status: 'failed',
        errorMessage: err?.message ?? tr('provider.transformers.unknown')
      };
    }
  }

  resolveModelMap(): Record<string, string> {
    return { ...DEFAULT_MODEL_MAP, ...(this.options.modelMap ?? {}) };
  }
}

/** Test-only: reset the lazy-require cache. */
export function _resetTransformersCacheForTests(): void {
  cachedLib = null;
  pipelineCache.clear();
}

function tryRequireLib(): TransformersLib | null {
  if (cachedLib) return cachedLib;
  try {
    // Lazy require so the ~260MB onnxruntime-node binary is only resolved
    // when the user actually selects the transformers provider.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@huggingface/transformers') as TransformersLib;
    cachedLib = mod;
    return mod;
  } catch {
    return null;
  }
}

async function loadPipeline(lib: TransformersLib, modelId: string): Promise<TranslationPipeline> {
  const cached = pipelineCache.get(modelId);
  if (cached) return cached;
  const pipe = await lib.pipeline('translation', modelId);
  pipelineCache.set(modelId, pipe);
  return pipe;
}

function extractText(out: TranslationOutput | TranslationOutput[] | undefined): string {
  if (!out) return '';
  if (Array.isArray(out)) return out[0]?.translation_text ?? '';
  return out.translation_text ?? '';
}

class TimeoutError extends Error {
  override name = 'TimeoutError';
}

function withTimeout<T>(p: Promise<T>, ms: number, message: () => string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new TimeoutError(message())), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

/**
 * Run an interactive walkthrough that installs `@huggingface/transformers`
 * into the extension's own `node_modules`. We use a VS Code terminal so the
 * user retains control and can see download progress.
 */
export async function installTransformersBackend(
  context: vscode.ExtensionContext
): Promise<void> {
  const ok = await vscode.window.showWarningMessage(
    tr('provider.transformers.installPrompt'),
    { modal: true },
    tr('provider.transformers.installConfirm'),
    tr('msg.btn.cancel')
  );
  if (ok !== tr('provider.transformers.installConfirm')) return;

  const cwd = context.extensionUri.fsPath;
  const term = vscode.window.createTerminal({
    name: 'lingobridge: install transformers',
    cwd
  });
  term.show(true);
  // Pin to the version verified to work with this extension (transformers.js v4).
  term.sendText('npm install @huggingface/transformers@^4.2.0');
  vscode.window.showInformationMessage(tr('provider.transformers.installStarted'));
}
