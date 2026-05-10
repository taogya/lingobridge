/**
 * Translation provider abstraction.
 * Add new providers by implementing this interface
 * and registering in `providerRegistry.ts`.
 */

/**
 * ISO 639-1 language code (e.g. `ja`, `en`, `zh`). Lower-case 2 letters,
 * optionally with a `-XX` region (e.g. `zh-CN`).
 */
export type LanguageCode = string;

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
  /** Pairs the provider believes it can translate. Empty/undefined = unknown. */
  supportedPairs?: TranslationDirection[];
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
