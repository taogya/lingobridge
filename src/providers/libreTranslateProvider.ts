import * as vscode from 'vscode';
import { tr } from '../i18n';
import {
  ProviderAvailability,
  TranslateOptions,
  TranslateResult,
  TranslationProvider
} from './translationProvider';

const DEFAULT_TIMEOUT = 30000;

export interface LibreTranslateProviderOptions {
  endpoint: string;
  apiKey?: string;
}

interface LtTranslateResponse {
  translatedText?: string;
  error?: string;
}

interface LtLanguage {
  code: string;
  targets?: string[];
}

/**
 * LibreTranslate provider. Requires the user to run a local server, e.g.:
 *
 *   pip install libretranslate
 *   libretranslate --host 127.0.0.1 --port 5000 --load-only ja,en
 *
 * Uses the global `fetch` available on Node 18+.
 */
export class LibreTranslateProvider implements TranslationProvider {
  readonly id = 'libretranslate';
  readonly displayName = 'LibreTranslate (local)';

  constructor(private readonly options: LibreTranslateProviderOptions) {}

  async checkAvailability(): Promise<ProviderAvailability> {
    const url = this.url('/languages');
    try {
      const res = await this.fetchWithTimeout(url, { method: 'GET' }, 3000);
      if (!res.ok) {
        return {
          available: false,
          detail: `LibreTranslate ${url} -> HTTP ${res.status}`
        };
      }
      const langs = (await res.json()) as LtLanguage[];
      const pairs: { from: string; to: string }[] = [];
      for (const l of langs) {
        for (const t of l.targets ?? []) pairs.push({ from: l.code, to: t });
      }
      if (pairs.length === 0) {
        return {
          available: false,
          detail: tr('provider.libre.noLanguages')
        };
      }
      return {
        available: true,
        detail: `${this.options.endpoint} (${pairs.length} pairs)`,
        supportedPairs: pairs
      };
    } catch (e) {
      return {
        available: false,
        detail: tr('provider.libre.cannotConnect')
      };
    }
  }

  async translate(text: string, options: TranslateOptions): Promise<TranslateResult> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
    const url = this.url('/translate');
    const body: Record<string, string> = {
      q: text,
      source: options.direction.from,
      target: options.direction.to,
      format: 'text'
    };
    if (this.options.apiKey) body.api_key = this.options.apiKey;

    // Issue #3: keep-alive sockets to a long-idle LibreTranslate instance
    // (typical when the user comes back from sleep / lunch) get RST'd by the
    // server and surface as `socket hang up` / `UND_ERR_SOCKET`. We retry
    // the request once on these transient socket errors before giving up.
    const init: RequestInit = {
      method: 'POST',
      headers: { 'content-type': 'application/json', connection: 'close' },
      body: JSON.stringify(body)
    };

    try {
      const res = await this.fetchWithRetry(url, init, timeoutMs);
      if (!res.ok) {
        const detail = await safeText(res);
        return {
          status: 'failed',
          errorMessage: `LibreTranslate HTTP ${res.status}: ${detail}`
        };
      }
      const data = (await res.json()) as LtTranslateResponse;
      if (data.error) {
        return { status: 'failed', errorMessage: `LibreTranslate: ${data.error}` };
      }
      if (!data.translatedText) {
        return { status: 'failed', errorMessage: tr('provider.libre.empty') };
      }
      return { status: 'ok', translatedText: data.translatedText };
    } catch (e) {
      const err = e as { name?: string; message?: string };
      if (err?.name === 'AbortError') {
        return {
          status: 'timeout',
          errorMessage: tr('provider.libre.timeout', String(timeoutMs))
        };
      }
      const msg = err?.message ?? tr('provider.libre.unknown');
      // Map "fetch failed" / ECONNREFUSED to notInstalled hint.
      if (/ECONNREFUSED|fetch failed|ENOTFOUND/i.test(msg)) {
        return {
          status: 'notInstalled',
          errorMessage: tr('provider.libre.cannotConnectShort')
        };
      }
      return { status: 'failed', errorMessage: msg };
    }
  }

  private url(pathname: string): string {
    const base = this.options.endpoint.replace(/\/+$/, '');
    return `${base}${pathname}`;
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Retry once on transient socket-level errors (Issue #3). The most common
   * cause is that an HTTP keep-alive connection idle since the previous call
   * was reset by the server / a sleeping macOS / Docker bridge.
   */
  private async fetchWithRetry(
    url: string,
    init: RequestInit,
    timeoutMs: number
  ): Promise<Response> {
    try {
      return await this.fetchWithTimeout(url, init, timeoutMs);
    } catch (e) {
      if (!isTransientSocketError(e)) throw e;
      return await this.fetchWithTimeout(url, init, timeoutMs);
    }
  }
}

function isTransientSocketError(e: unknown): boolean {
  const err = e as { name?: string; code?: string; message?: string; cause?: { code?: string } };
  if (!err) return false;
  // Don't retry on AbortError — that's our own timeout.
  if (err.name === 'AbortError') return false;
  const code = err.code ?? err.cause?.code ?? '';
  if (/^(ECONNRESET|EPIPE|UND_ERR_SOCKET|ETIMEDOUT)$/i.test(code)) return true;
  const msg = err.message ?? '';
  return /socket hang up|other side closed|ECONNRESET|UND_ERR_SOCKET/i.test(msg);
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 200);
  } catch {
    return '';
  }
}
