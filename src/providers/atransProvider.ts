import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  ProviderAvailability,
  TranslateOptions,
  TranslateResult,
  TranslationProvider
} from './translationProvider';

const ATRANS = 'atrans';
const HOMEBREW_PATHS = ['/opt/homebrew/bin/atrans', '/usr/local/bin/atrans'];
const ACCESS_MODE = fs.constants.F_OK | fs.constants.X_OK;
const DEFAULT_TIMEOUT = 30000;

export interface AtransProviderOptions {
  /** Explicit absolute path to the atrans CLI. Empty = auto-detect. */
  explicitPath?: string;
}

export class AtransProvider implements TranslationProvider {
  readonly id = 'atrans';
  readonly displayName = 'atrans (macOS)';

  constructor(private readonly options: AtransProviderOptions = {}) {}

  async checkAvailability(): Promise<ProviderAvailability> {
    const resolved = await this.resolveCommand();
    if (resolved) {
      return { available: true, detail: resolved };
    }
    return {
      available: false,
      detail:
        'atrans CLI が見つかりません。settings の `lingobridge.atrans.path` で絶対パスを指定するか、Homebrew (taogya/atrans) で導入してください。'
    };
  }

  async translate(text: string, options: TranslateOptions): Promise<TranslateResult> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
    const cmd = await this.resolveCommand();
    if (!cmd) {
      return {
        status: 'notInstalled',
        errorMessage:
          'atrans CLI が見つかりません。settings の `lingobridge.atrans.path` で絶対パスを指定するか、Homebrew で導入してください。'
      };
    }

    const args = ['--from', options.direction.from, '--to', options.direction.to];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await new Promise<TranslateResult>((resolve) => {
        const proc = child_process.spawn(cmd, args, { signal: controller.signal });
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (d) => (stdout += d.toString()));
        proc.stderr.on('data', (d) => (stderr += d.toString()));
        proc.on('error', (err) => {
          if ((err as NodeJS.ErrnoException).name === 'AbortError') {
            resolve({
              status: 'timeout',
              errorMessage: `atrans が ${timeoutMs}ms でタイムアウトしました。`
            });
          } else {
            resolve({ status: 'failed', errorMessage: err.message });
          }
        });
        proc.on('close', (code) => {
          if (code === 0 && stdout.trim().length > 0) {
            resolve({ status: 'ok', translatedText: stdout.trim() });
          } else {
            resolve({
              status: 'failed',
              errorMessage: stderr.trim() || `atrans が終了コード ${code} で失敗しました。`
            });
          }
        });
        proc.stdin.write(text);
        proc.stdin.end();
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async resolveCommand(): Promise<string | undefined> {
    const candidates: string[] = [];
    const seen = new Set<string>();
    const add = (p: string | undefined) => {
      const t = p?.trim();
      if (t && !seen.has(t)) {
        candidates.push(t);
        seen.add(t);
      }
    };

    add(this.options.explicitPath);
    add(process.env.ATRANS_PATH);
    for (const entry of (process.env.PATH ?? '').split(path.delimiter)) {
      const e = entry.trim();
      if (e) add(path.join(e, ATRANS));
    }
    for (const fallback of HOMEBREW_PATHS) add(fallback);

    for (const c of candidates) {
      try {
        await fs.promises.access(c, ACCESS_MODE);
        return c;
      } catch {
        // try next
      }
    }
    return undefined;
  }
}
