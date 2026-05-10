import * as assert from 'assert';
import * as vscode from 'vscode';
import { HistoryEntry, HistoryStore } from '../../src/history';

// TASK-00002 翻訳履歴 — globalState 永続化と上限制御。
// vscode.Memento を満たす最小モックを使い、ExtensionContext を仕立てる。
class FakeMemento implements vscode.Memento {
  private store = new Map<string, unknown>();
  keys(): readonly string[] {
    return [...this.store.keys()];
  }
  get<T>(key: string, defaultValue?: T): T {
    return (this.store.has(key) ? (this.store.get(key) as T) : (defaultValue as T));
  }
  async update(key: string, value: unknown): Promise<void> {
    if (value === undefined) this.store.delete(key);
    else this.store.set(key, value);
  }
  setKeysForSync(): void {
    // no-op for tests
  }
}

function makeContext(): vscode.ExtensionContext {
  const memento = new FakeMemento();
  return { globalState: memento } as unknown as vscode.ExtensionContext;
}

suite('HistoryStore', () => {
  const KEY_ENABLED = 'history.enabled';
  const KEY_MAX = 'history.maxEntries';
  const cfg = () => vscode.workspace.getConfiguration('lingobridge');

  teardown(async () => {
    await cfg().update(KEY_ENABLED, undefined, vscode.ConfigurationTarget.Global);
    await cfg().update(KEY_MAX, undefined, vscode.ConfigurationTarget.Global);
  });

  test('add() persists and assigns id/ts', async () => {
    const store = new HistoryStore(makeContext());
    const entry = await store.add({ from: 'ja', to: 'en', input: 'こんにちは', output: 'hello' });
    assert.ok(entry, 'entry returned');
    assert.ok(entry!.id.length > 0);
    assert.ok(entry!.ts > 0);
    assert.strictEqual(store.list().length, 1);
  });

  test('list() returns newest-first', async () => {
    const store = new HistoryStore(makeContext());
    await store.add({ from: 'ja', to: 'en', input: 'a', output: 'A' });
    await store.add({ from: 'ja', to: 'en', input: 'b', output: 'B' });
    const list = store.list();
    assert.strictEqual(list[0].input, 'b');
    assert.strictEqual(list[1].input, 'a');
  });

  test('respects maxEntries (truncation)', async () => {
    await cfg().update(KEY_MAX, 2, vscode.ConfigurationTarget.Global);
    const store = new HistoryStore(makeContext());
    for (const t of ['a', 'b', 'c']) {
      await store.add({ from: 'ja', to: 'en', input: t, output: t });
    }
    assert.strictEqual(store.list().length, 2);
    assert.strictEqual(store.list()[0].input, 'c');
  });

  test('maxEntries=0 disables persistence', async () => {
    await cfg().update(KEY_MAX, 0, vscode.ConfigurationTarget.Global);
    const store = new HistoryStore(makeContext());
    const e = await store.add({ from: 'ja', to: 'en', input: 'a', output: 'A' });
    assert.strictEqual(e, undefined);
    assert.strictEqual(store.list().length, 0);
  });

  test('history.enabled=false skips add', async () => {
    await cfg().update(KEY_ENABLED, false, vscode.ConfigurationTarget.Global);
    const store = new HistoryStore(makeContext());
    const e = await store.add({ from: 'ja', to: 'en', input: 'a', output: 'A' });
    assert.strictEqual(e, undefined);
    assert.strictEqual(store.isEnabled(), false);
  });

  test('remove() and clear()', async () => {
    const store = new HistoryStore(makeContext());
    const e1 = (await store.add({ from: 'ja', to: 'en', input: 'a', output: 'A' }))!;
    await store.add({ from: 'ja', to: 'en', input: 'b', output: 'B' });
    await store.remove(e1.id);
    assert.strictEqual(store.list().length, 1);
    await store.clear();
    assert.strictEqual(store.list().length, 0);
  });

  test('onDidChange fires for add/remove/clear', async () => {
    const store = new HistoryStore(makeContext());
    const calls: number[] = [];
    const sub = store.onDidChange((e: HistoryEntry[]) => calls.push(e.length));
    await store.add({ from: 'ja', to: 'en', input: 'a', output: 'A' });
    const e = (await store.add({ from: 'ja', to: 'en', input: 'b', output: 'B' }))!;
    await store.remove(e.id);
    await store.clear();
    sub.dispose();
    assert.deepStrictEqual(calls, [1, 2, 1, 0]);
  });

  test('maxEntries clamps to [0, 500]', async () => {
    await cfg().update(KEY_MAX, 9999, vscode.ConfigurationTarget.Global);
    const store = new HistoryStore(makeContext());
    assert.strictEqual(store.maxEntries(), 500);
    await cfg().update(KEY_MAX, -3, vscode.ConfigurationTarget.Global);
    assert.strictEqual(store.maxEntries(), 0);
  });
});
