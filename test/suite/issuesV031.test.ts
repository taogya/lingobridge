import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

function repoPath(...parts: string[]): string {
  return path.join(__dirname, '..', '..', '..', ...parts);
}

function readRepoText(...parts: string[]): string {
  return fs.readFileSync(repoPath(...parts), 'utf8');
}

suite('Issue #5: Onboarding の導線が弱く、セットアップ情報が分散している', () => {
  test('shared provider setup docs include transformers and a dedicated guide', () => {
    const readme = readRepoText('docs', 'setup', 'providers', 'README.md');
    const transformersGuide = repoPath('docs', 'setup', 'providers', 'transformers.md');

    assert.ok(fs.existsSync(transformersGuide), `missing guide: ${transformersGuide}`);
    assert.match(readme, /transformers/i, 'provider setup index should list transformers');
    assert.match(readme, /transformers\.md/i, 'provider setup index should link to transformers.md');
  });
});

suite('Issue #6: provider availability becomes stale in the translate view', () => {
  test('provider availability is refreshed when the view becomes visible again', async function () {
    this.timeout(5000);

    const providerRegistry = await import('../../src/providers/providerRegistry');
    const originalGetActiveProvider = providerRegistry.getActiveProvider;
    let available = false;

    try {
      (providerRegistry as any).getActiveProvider = () => ({
        id: 'libretranslate',
        displayName: 'LibreTranslate (local)',
        checkAvailability: async () => ({
          available,
          detail: available ? 'ready' : 'not ready'
        }),
        translate: async () => ({ status: 'ok', translatedText: 'ok' })
      });

      const { TranslateViewProvider } = await import('../../src/translateView');
      const receiveEmitter = new vscode.EventEmitter<any>();
      const disposeEmitter = new vscode.EventEmitter<void>();
      const visibilityEmitter = new vscode.EventEmitter<void>();
      const messages: any[] = [];

      const fakeView: any = {
        visible: true,
        webview: {
          options: {},
          html: '',
          onDidReceiveMessage: receiveEmitter.event,
          postMessage: async (msg: unknown) => {
            messages.push(msg);
            return true;
          }
        },
        onDidDispose: disposeEmitter.event,
        onDidChangeVisibility: visibilityEmitter.event,
        show: () => {
          fakeView.visible = true;
        }
      };

      const historyStub: any = {
        onDidChange: () => new vscode.Disposable(() => undefined),
        isEnabled: () => false,
        list: () => []
      };

      const provider = new TranslateViewProvider({} as vscode.ExtensionContext, historyStub);
      provider.resolveWebviewView(fakeView);

      receiveEmitter.fire({ type: 'ready' });
      await new Promise((resolve) => setTimeout(resolve, 25));

      const initialState = messages.filter((msg) => msg?.type === 'state').at(-1);
      assert.ok(initialState, 'expected an initial state message after ready');
      assert.strictEqual(initialState.state.providerAvailable, false);

      available = true;
      fakeView.visible = false;
      fakeView.visible = true;
      visibilityEmitter.fire();
      await new Promise((resolve) => setTimeout(resolve, 25));

      const states = messages.filter((msg) => msg?.type === 'state');
      assert.ok(
        states.length >= 2,
        'expected a fresh state message when the view becomes visible again'
      );
      assert.strictEqual(states.at(-1).state.providerAvailable, true);

      disposeEmitter.fire();
      receiveEmitter.dispose();
      disposeEmitter.dispose();
      visibilityEmitter.dispose();
    } finally {
      (providerRegistry as any).getActiveProvider = originalGetActiveProvider;
    }
  });
});