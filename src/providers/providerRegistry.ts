import * as vscode from 'vscode';
import { AtransProvider } from './atransProvider';
import { LibreTranslateProvider } from './libreTranslateProvider';
import { TranslationProvider } from './translationProvider';

export type ProviderId = 'atrans' | 'libretranslate';

/**
 * Resolve the active provider instance from current settings.
 * New providers should be added to the switch below.
 */
export function getActiveProvider(): TranslationProvider {
  const cfg = vscode.workspace.getConfiguration('lingobridge');
  const id = cfg.get<ProviderId>('provider.active', 'atrans');
  switch (id) {
    case 'libretranslate':
      return new LibreTranslateProvider({
        endpoint: cfg.get<string>('libretranslate.endpoint', 'http://127.0.0.1:5000'),
        apiKey: cfg.get<string>('libretranslate.apiKey', '') || undefined
      });
    case 'atrans':
    default:
      return new AtransProvider({
        explicitPath: cfg.get<string>('atrans.path', '') || undefined
      });
  }
}

export function getActiveTimeoutMs(): number {
  const cfg = vscode.workspace.getConfiguration('lingobridge');
  const id = cfg.get<ProviderId>('provider.active', 'atrans');
  if (id === 'libretranslate') {
    return cfg.get<number>('libretranslate.timeoutMs', 30000);
  }
  return cfg.get<number>('atrans.timeoutMs', 30000);
}
