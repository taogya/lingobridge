/**
 * Translation provider abstraction.
 * MVP supports `atrans` only. Add new providers by implementing this interface
 * and registering in `providerRegistry.ts`.
 */

export type LanguageCode = 'ja' | 'en';

export interface TranslationDirection {
  from: LanguageCode;
  to: LanguageCode;
}

export interface TranslateOptions {
  direction: TranslationDirection;
  /** Hard timeout in milliseconds. Provider may ignore if unsupported. */
  timeoutMs?: number;
}

export type TranslateStatus = 'ok' | 'notInstalled' | 'failed' | 'timeout';

export interface TranslateResult {
  status: TranslateStatus;
  translatedText?: string;
  errorMessage?: string;
}

export interface ProviderAvailability {
  available: boolean;
  detail?: string;
}

export interface TranslationProvider {
  /** Stable id used in settings. */
  readonly id: string;
  /** Human-readable name. */
  readonly displayName: string;
  /** Lightweight availability check (no translation invoked). */
  checkAvailability(): Promise<ProviderAvailability>;
  /** Translate a single text payload. */
  translate(text: string, options: TranslateOptions): Promise<TranslateResult>;
}
