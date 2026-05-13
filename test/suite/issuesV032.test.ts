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

suite('Issue #5 (v0.3.2): Onboarding redesign — checklist + concise links', () => {
  test('welcome step is a real introduction and no longer depends on opening the translate panel', () => {
    const nls = JSON.parse(readRepoText('package.nls.ja.json')) as Record<string, string>;
    const md = readRepoText('media', 'walkthrough', 'welcome.md');
    const ext = vscode.extensions.getExtension('taogya.lingobridge')!;
    const walkthroughs = (ext.packageJSON.contributes as Record<string, unknown>)
      .walkthroughs as Array<{ steps: Array<{ id: string; completionEvents?: string[] }> }>;
    const welcome = walkthroughs[0].steps[0];

    assert.strictEqual(nls['walkthrough.step.welcome.title'], 'lingobridge へようこそ');
    assert.match(
      nls['walkthrough.step.welcome.description'] ?? '',
      /3 ステップ/,
      'welcome description should introduce the walkthrough flow, not a single action'
    );
    assert.doesNotMatch(
      nls['walkthrough.step.welcome.description'] ?? '',
      /サイドパネル|翻訳パネルを開く/,
      'welcome step should no longer claim that its purpose is opening the translate panel'
    );
    assert.match(md, /プロバイダの状態を確認する/);
    assert.match(md, /最初の翻訳を試す/);
    assert.ok(
      !welcome.completionEvents,
      'welcome step should complete as a plain intro step instead of waiting for focusTranslateView'
    );
  });

  test('pickProvider step keeps a short explanation and exposes setup/settings actions', () => {
    const md = readRepoText('media', 'walkthrough', 'pickProvider.md');
    const nls = JSON.parse(readRepoText('package.nls.ja.json')) as Record<string, string>;
    const lines = md.split(/\r?\n/);
    // First non-heading, non-blank line should reference the shared setup doc.
    const firstBody = lines.find(
      (l, i) => i > 0 && l.trim() !== '' && !l.trim().startsWith('#')
    );
    assert.ok(firstBody, 'expected a body paragraph below the heading');
    assert.match(
      firstBody!,
      /\[.*\]\(https:\/\/github\.com\/taogya\/lingobridge\/blob\/main\/docs\/setup\/providers\/README\.md\)/,
      'pickProvider must link to docs/setup/providers/README.md from the very first body line'
    );

    assert.doesNotMatch(
      md,
      /ウォークスルー内で重複管理せず/,
      'remove the developer-oriented "重複管理" wording per Issue #5 feedback'
    );

    assert.match(
      nls['walkthrough.step.pickProvider.description'] ?? '',
      /使いたい翻訳プロバイダを選びます/,
      'pickProvider should still explain what this step is for'
    );

    assert.match(
      nls['walkthrough.step.pickProvider.description'] ?? '',
      /https:\/\/github\.com\/taogya\/lingobridge\/blob\/main\/docs\/setup\/providers\/README\.md/,
      'pickProvider should expose a button that opens the shared setup guide'
    );

    assert.match(
      nls['walkthrough.step.pickProvider.description'] ?? '',
      /command:lingobridge\.openSettings/,
      'pickProvider should expose a button that opens the extension settings'
    );

    assert.doesNotMatch(
      nls['walkthrough.step.pickProvider.description'] ?? '',
      /プロバイダ セットアップから atrans|install one of `atrans`/,
      'pickProvider description should avoid the older long-form wording'
    );
  });

  test('install per-provider walkthrough pages are removed in favour of a single check step', () => {
    for (const name of ['installAtrans.md', 'installLibre.md', 'installTransformers.md']) {
      assert.ok(
        !fs.existsSync(repoPath('media', 'walkthrough', name)),
        `${name} should be removed; install steps live under docs/setup/providers/*`
      );
    }
    assert.ok(
      fs.existsSync(repoPath('media', 'walkthrough', 'checkProviders.md')),
      'checkProviders.md must exist as the unified status step'
    );
  });

  test('package.json walkthrough has welcome / pickProvider / checkProviders / firstTranslation only', () => {
    const ext = vscode.extensions.getExtension('taogya.lingobridge')!;
    const walkthroughs = (ext.packageJSON.contributes as Record<string, unknown>)
      .walkthroughs as Array<{ steps: { id: string }[] }>;
    const ids = walkthroughs[0].steps.map((s) => s.id);
    assert.deepStrictEqual(ids, [
      'welcome',
      'pickProvider',
      'checkProviders',
      'firstTranslation'
    ]);
  });

  test('checkProviders step exposes its command link from the localized step description', () => {
    const nls = JSON.parse(readRepoText('package.nls.ja.json')) as Record<string, string>;
    const md = readRepoText('media', 'walkthrough', 'checkProviders.md');
    assert.match(
      nls['walkthrough.step.checkProviders.description'] ?? '',
      /command:lingobridge\.checkProviders/,
      'the walkthrough description must include a command link that runs Check Providers'
    );
    assert.doesNotMatch(md, /command:/, 'media markdown should avoid dead command links');
  });

  test('firstTranslation step exposes its command link from the localized step description', () => {
    const nls = JSON.parse(readRepoText('package.nls.ja.json')) as Record<string, string>;
    const md = readRepoText('media', 'walkthrough', 'firstTranslation.md');
    assert.match(
      nls['walkthrough.step.firstTranslation.description'] ?? '',
      /command:lingobridge\.focusTranslateView/,
      'the walkthrough description must include a command link to focus the translate view'
    );
    assert.doesNotMatch(md, /command:/, 'media markdown should avoid dead command links');
  });

  test('lingobridge.checkProviders command is registered and runnable', async () => {
    const all = await vscode.commands.getCommands(true);
    assert.ok(
      all.includes('lingobridge.checkProviders'),
      'lingobridge.checkProviders must be registered'
    );
  });
});

suite('Issue #7 (v0.3.2): markdown structure preserved when the model strips markers', () => {
  // Direct unit-level reproducer lives in incremental.test.ts. This suite
  // only checks that the public splitter exposes the new part-based shape
  // so future regressions surface clearly.
  test('splitMarkdownStructuralLine isolates markup prefix from translatable content', async () => {
    const mod = await import('../../src/incremental');
    const heading = mod.splitMarkdownStructuralLine('## Hello');
    assert.deepStrictEqual(heading, [
      { text: '## ', translatable: false },
      { text: 'Hello', translatable: true }
    ]);

    const list = mod.splitMarkdownStructuralLine('- item');
    assert.deepStrictEqual(list, [
      { text: '- ', translatable: false },
      { text: 'item', translatable: true }
    ]);

    const quote = mod.splitMarkdownStructuralLine('> quoted');
    assert.deepStrictEqual(quote, [
      { text: '> ', translatable: false },
      { text: 'quoted', translatable: true }
    ]);

    const sep = mod.splitMarkdownStructuralLine('| --- | --- |');
    assert.deepStrictEqual(sep, [{ text: '| --- | --- |', translatable: false }]);
  });
});
