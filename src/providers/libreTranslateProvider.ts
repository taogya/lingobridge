import * as vscode from 'vscode';
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
          detail: vscode.l10n.t('provider.libre.noLanguages')
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
        detail: vscode.l10n.t('provider.libre.cannotConnect')
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

    try {
      const res = await this.fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body)
        },
        timeoutMs
      );
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
        return { status: 'failed', errorMessage: vscode.l10n.t('provider.libre.empty') };
      }
      return { status: 'ok', translatedText: data.translatedText };
    } catch (e) {
      const err = e as { name?: string; message?: string };
      if (err?.name === 'AbortError') {
        return {
          status: 'timeout',
          errorMessage: vscode.l10n.t('provider.libre.timeout', String(timeoutMs))
        };
      }
      const msg = err?.message ?? vscode.l10n.t('provider.libre.unknown');
      // Map "fetch failed" / ECONNREFUSED to notInstalled hint.
      if (/ECONNREFUSED|fetch failed|ENOTFOUND/i.test(msg)) {
        return {
          status: 'notInstalled',
          errorMessage: vscode.l10n.t('provider.libre.cannotConnectShort')
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
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 200);
  } catch {
    return '';
  }
}
