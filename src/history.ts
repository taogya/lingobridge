import * as vscode from 'vscode';
import { LanguageCode } from './providers/translationProvider';

export interface HistoryEntry {
  id: string;
  ts: number;
  from: LanguageCode;
  to: LanguageCode;
  input: string;
  output: string;
  inputTokens?: number;
  outputTokens?: number;
  provider?: string;
}

const STORAGE_KEY = 'lingobridge.history.v1';

/**
 * Translation history backed by the extension's globalState.
 * Stays local to the machine (not synced) and is cheap to read for the
 * Activity Bar Webview.
 */
export class HistoryStore {
  private readonly memento: vscode.Memento;
  private readonly listeners = new Set<(entries: HistoryEntry[]) => void>();

  constructor(context: vscode.ExtensionContext) {
    this.memento = context.globalState;
  }

  isEnabled(): boolean {
    return vscode.workspace
      .getConfiguration('lingobridge')
      .get<boolean>('history.enabled', true);
  }

  maxEntries(): number {
    const n = vscode.workspace
      .getConfiguration('lingobridge')
      .get<number>('history.maxEntries', 50);
    return Math.max(0, Math.min(500, Math.trunc(n)));
  }

  list(): HistoryEntry[] {
    const raw = this.memento.get<HistoryEntry[]>(STORAGE_KEY, []);
    return Array.isArray(raw) ? raw : [];
  }

  async add(entry: Omit<HistoryEntry, 'id' | 'ts'>): Promise<HistoryEntry | undefined> {
    if (!this.isEnabled()) return undefined;
    const max = this.maxEntries();
    if (max <= 0) return undefined;
    const newEntry: HistoryEntry = { id: makeId(), ts: Date.now(), ...entry };
    const next = [newEntry, ...this.list()].slice(0, max);
    await this.memento.update(STORAGE_KEY, next);
    this.emit(next);
    return newEntry;
  }

  async remove(id: string): Promise<void> {
    const next = this.list().filter((e) => e.id !== id);
    await this.memento.update(STORAGE_KEY, next);
    this.emit(next);
  }

  async clear(): Promise<void> {
    await this.memento.update(STORAGE_KEY, []);
    this.emit([]);
  }

  onDidChange(listener: (entries: HistoryEntry[]) => void): vscode.Disposable {
    this.listeners.add(listener);
    return new vscode.Disposable(() => this.listeners.delete(listener));
  }

  private emit(entries: HistoryEntry[]): void {
    for (const l of this.listeners) {
      try {
        l(entries);
      } catch {
        // ignore listener errors
      }
    }
  }
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
