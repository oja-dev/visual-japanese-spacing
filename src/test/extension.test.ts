import * as assert from 'assert/strict';
import { after, afterEach, beforeEach, describe, it } from 'mocha';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { activate } from '../extension';
import { provideSpacingHints } from '../spacingHints';

const section = 'visualJapaneseSpacing';
const positions = (hints: vscode.InlayHint[]) =>
  hints.map((hint) => [hint.position.line, hint.position.character]);

// Stub only the settings seam. Positions, ranges, hints, events, and documents
// come from the real VS Code extension host rather than a replacement module.
function stubSettings(sandbox: sinon.SinonSandbox) {
  const values = new Map<string, unknown>([
    ['enabled', true],
    ['languages', ['markdown', 'plaintext']],
    ['includeNumbers', true],
  ]);
  const configuration: vscode.WorkspaceConfiguration = {
    ...vscode.workspace.getConfiguration(section),
  };
  sandbox.stub(configuration, 'get').callsFake((key, fallback) => values.get(key) ?? fallback);
  const inspect = sandbox.stub(configuration, 'inspect').returns({ key: `${section}.enabled` });
  const update = sandbox.stub(configuration, 'update').callsFake(async (key, value: unknown) => {
    values.set(key, value);
  });
  const getConfiguration = sandbox
    .stub(vscode.workspace, 'getConfiguration')
    .returns(configuration);
  return { values, inspect, update, getConfiguration, configuration };
}

const uncancelled = new vscode.CancellationTokenSource();
after(() => uncancelled.dispose());

describe('spacing hints', () => {
  let sandbox: sinon.SinonSandbox;
  let settings: ReturnType<typeof stubSettings>;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    settings = stubSettings(sandbox);
  });
  afterEach(() => sandbox.restore());

  async function document(content = '日A日B\n𠮷C\n隠D', language = 'plaintext') {
    return vscode.workspace.openTextDocument({ content, language });
  }

  it('provides display-only native hints within the requested range', async () => {
    const doc = await document();
    const read = sandbox.spy(doc.getText.bind(doc));
    const observed: vscode.TextDocument = { ...doc, getText: read };
    const hints = provideSpacingHints(observed, new vscode.Range(0, 1, 0, 3), uncancelled.token);
    assert.deepEqual(positions(hints), [
      [0, 1],
      [0, 2],
      [0, 3],
    ]);
    assert.ok(read.called);
    assert.ok(read.args.every(([range]) => range?.start.line === 0 && range.end.line === 0));
    for (const hint of hints) {
      assert.ok(hint instanceof vscode.InlayHint);
      assert.equal(hint.label, '\u200b');
      assert.equal(hint.paddingLeft, true);
      assert.equal(hint.paddingRight, true);
      assert.equal(hint.kind, undefined);
      assert.equal(hint.textEdits, undefined);
      assert.equal(hint.tooltip, undefined);
    }
    assert.equal(doc.getText(), '日A日B\n𠮷C\n隠D');
  });

  it('clips a partial range and preserves supplementary UTF-16 positions', async () => {
    const doc = await document('A𠮷B日C');
    assert.deepEqual(
      positions(provideSpacingHints(doc, new vscode.Range(0, 2, 0, 4), uncancelled.token)),
      [
        [0, 3],
        [0, 4],
      ],
    );
  });

  it('lookbehind includes the base of a variation sequence', async () => {
    const doc = await document('𠮷\u{E0100}C');
    assert.deepEqual(
      positions(provideSpacingHints(doc, new vscode.Range(0, 4, 0, 5), uncancelled.token)),
      [[0, 4]],
    );
  });

  it('re-requests read the current document after an edit', async () => {
    const doc = await document('日A日B');
    const range = new vscode.Range(0, 0, 0, 4);
    assert.equal(provideSpacingHints(doc, range, uncancelled.token).length, 3);
    const edit = new vscode.WorkspaceEdit();
    edit.replace(doc.uri, range, '日 A');
    assert.equal(await vscode.workspace.applyEdit(edit), true);
    assert.deepEqual(provideSpacingHints(doc, range, uncancelled.token), []);
  });

  it('already-cancelled requests do not read the document', async () => {
    const doc = await document();
    const read = sandbox.spy(doc.getText.bind(doc));
    const observed: vscode.TextDocument = { ...doc, getText: read };
    const cancellation = new vscode.CancellationTokenSource();
    cancellation.cancel();
    try {
      assert.deepEqual(
        provideSpacingHints(observed, new vscode.Range(0, 0, 0, 3), cancellation.token),
        [],
      );
      assert.equal(read.called, false);
    } finally {
      cancellation.dispose();
    }
  });

  it('cancellation during a multi-line request returns no partial hints', async () => {
    const doc = await document('日A\n日B');
    const getText = doc.getText.bind(doc);
    const cancellation = new vscode.CancellationTokenSource();
    const observed: vscode.TextDocument = {
      ...doc,
      getText(range) {
        cancellation.cancel();
        return getText(range);
      },
    };
    try {
      assert.deepEqual(
        provideSpacingHints(observed, new vscode.Range(0, 0, 1, 2), cancellation.token),
        [],
      );
    } finally {
      cancellation.dispose();
    }
  });

  it('language mode, wildcard and empty language lists determine eligibility', async () => {
    let doc = await document('日本Python', 'python');
    const range = new vscode.Range(0, 0, 0, 8);
    assert.deepEqual(provideSpacingHints(doc, range, uncancelled.token), []);
    settings.values.set('languages', ['markdown', 'plaintext', 'python']);
    assert.deepEqual(positions(provideSpacingHints(doc, range, uncancelled.token)), [[0, 2]]);
    doc = await vscode.languages.setTextDocumentLanguage(doc, 'javascript');
    assert.deepEqual(provideSpacingHints(doc, range, uncancelled.token), []);
    settings.values.set('languages', ['*']);
    assert.equal(provideSpacingHints(doc, range, uncancelled.token).length, 1);
    settings.values.set('languages', []);
    assert.deepEqual(provideSpacingHints(doc, range, uncancelled.token), []);
  });

  it('number settings use the requested document without hiding letters', async () => {
    const doc = await document('日1日A');
    const range = new vscode.Range(0, 0, 0, 4);
    assert.equal(provideSpacingHints(doc, range, uncancelled.token).length, 3);
    settings.values.set('includeNumbers', false);
    assert.deepEqual(positions(provideSpacingHints(doc, range, uncancelled.token)), [[0, 3]]);
    sinon.assert.alwaysCalledWithExactly(settings.getConfiguration, section, doc);
  });
});

describe('spacing controller', () => {
  let sandbox: sinon.SinonSandbox;
  let settings: ReturnType<typeof stubSettings>;
  let commands: Map<string, () => unknown>;
  let subscriptions: vscode.Disposable[];
  let changes: vscode.EventEmitter<vscode.ConfigurationChangeEvent>;
  let provider: vscode.InlayHintsProvider;
  let providerDispose: sinon.SinonSpy;
  let emitterDispose: sinon.SinonSpy;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    commands = new Map();
    subscriptions = [];
    changes = new vscode.EventEmitter<vscode.ConfigurationChangeEvent>();
    settings = stubSettings(sandbox);
    sandbox.stub(vscode.workspace, 'onDidChangeConfiguration').callsFake(changes.event);
    providerDispose = sandbox.spy();
    emitterDispose = sandbox.spy(vscode.EventEmitter.prototype, 'dispose');
    sandbox.stub(vscode.languages, 'registerInlayHintsProvider').callsFake((selector, value) => {
      assert.equal(selector, '*');
      provider = value;
      return { dispose: providerDispose };
    });
    sandbox.stub(vscode.commands, 'registerCommand').callsFake((name, callback) => {
      commands.set(name, callback);
      return new vscode.Disposable(() => {
        commands.delete(name);
      });
    });
    // Activation only consumes subscriptions; all registered APIs remain typed.
    activate({ subscriptions } as vscode.ExtensionContext);
  });
  afterEach(() => {
    for (const subscription of subscriptions) subscription.dispose();
    changes.dispose();
    sandbox.restore();
  });

  function command(name: string): Promise<unknown> {
    const callback = commands.get(`${section}.${name}`);
    assert.ok(callback);
    return Promise.resolve(callback());
  }

  it('repeated enable and disable commands keep their requested state', async () => {
    await command('enable');
    assert.equal(settings.update.callCount, 0);
    await command('disable');
    await command('disable');
    assert.equal(settings.values.get('enabled'), false);
    assert.equal(settings.update.callCount, 1);
    await command('enable');
    await command('enable');
    assert.equal(settings.values.get('enabled'), true);
    assert.equal(settings.update.callCount, 2);
  });

  it('a later Enable waits for a pending Disable and reads a fresh snapshot', async () => {
    let releaseWrite!: () => void;
    const pending = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    settings.update.callsFake(async (key, value: unknown) => {
      await pending;
      settings.values.set(key, value);
    });
    // Give each configuration read a snapshot, as the real API does.
    settings.getConfiguration.callsFake(() => {
      const snapshot = new Map(settings.values);
      return {
        ...settings.configuration,
        get: (key: string, fallback?: unknown) => snapshot.get(key) ?? fallback,
        inspect: settings.inspect,
        update: settings.update,
      } as vscode.WorkspaceConfiguration;
    });
    const disable = command('disable');
    const enable = command('enable');
    releaseWrite();
    await Promise.all([disable, enable]);
    assert.deepEqual(
      settings.update.args.map(([, value]) => value),
      [false, true],
    );
    assert.equal(settings.values.get('enabled'), true);
  });

  it('a failed settings write is reported without blocking a later command', async () => {
    settings.update.onFirstCall().rejects(new Error('settings write failed'));
    await assert.rejects(command('disable'), /settings write failed/);
    await command('disable');
    assert.equal(settings.values.get('enabled'), false);
  });

  it('Open Settings navigates without changing preferences', async () => {
    const execute = sandbox.stub(vscode.commands, 'executeCommand').resolves();
    await command('openSettings');
    sinon.assert.calledOnceWithExactly(execute, 'workbench.action.openSettings', section);
    sinon.assert.notCalled(settings.update);
  });

  it('own settings changes invalidate hints, unrelated configuration does not', () => {
    let invalidations = 0;
    assert.ok(provider.onDidChangeInlayHints);
    subscriptions.push(
      provider.onDidChangeInlayHints(() => {
        invalidations++;
      }),
    );
    changes.fire({ affectsConfiguration: () => false });
    assert.equal(invalidations, 0);
    changes.fire({ affectsConfiguration: (name) => name === section });
    assert.equal(invalidations, 1);
  });

  it('disposal unregisters the provider, emitter and commands exactly once', () => {
    subscriptions[0].dispose();
    subscriptions[0].dispose();
    assert.equal(commands.size, 0);
    sinon.assert.calledOnce(providerDispose);
    sinon.assert.calledOnce(emitterDispose);
  });
});

describe('real configuration scopes', () => {
  let first: vscode.TextDocument;
  let second: vscode.TextDocument;
  let restore: (() => Thenable<void>)[];

  beforeEach(async () => {
    restore = [];
    const extension = vscode.extensions.getExtension('local.visual-japanese-spacing');
    assert.ok(extension);
    await extension.activate();
    const folders = vscode.workspace.workspaceFolders;
    assert.equal(folders?.length, 2);
    first = await vscode.workspace.openTextDocument(
      vscode.Uri.joinPath(folders![0].uri, 'sample.txt'),
    );
    second = await vscode.workspace.openTextDocument(
      vscode.Uri.joinPath(folders![1].uri, 'sample.txt'),
    );
    const configuration = vscode.workspace.getConfiguration(section);
    const original = configuration.inspect<boolean>('enabled');
    restore.push(() =>
      configuration.update('enabled', original?.globalValue, vscode.ConfigurationTarget.Global),
    );
    restore.push(() =>
      configuration.update(
        'enabled',
        original?.workspaceValue,
        vscode.ConfigurationTarget.Workspace,
      ),
    );
    for (const doc of [first, second]) {
      const config = vscode.workspace.getConfiguration(section, doc);
      const previous = config.inspect<boolean>('enabled')?.workspaceFolderValue;
      restore.push(() =>
        config.update('enabled', previous, vscode.ConfigurationTarget.WorkspaceFolder),
      );
    }
    await vscode.workspace
      .getConfiguration(section)
      .update('enabled', true, vscode.ConfigurationTarget.Global);
    await vscode.workspace
      .getConfiguration(section)
      .update('enabled', undefined, vscode.ConfigurationTarget.Workspace);
    for (const doc of [first, second]) {
      await vscode.workspace
        .getConfiguration(section, doc)
        .update('enabled', undefined, vscode.ConfigurationTarget.WorkspaceFolder);
    }
    await vscode.window.showTextDocument(first);
  });
  afterEach(async () => {
    try {
      await Promise.all(restore.map((reset) => reset()));
    } finally {
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    }
  });

  for (const [name, target] of [
    ['global', vscode.ConfigurationTarget.Global],
    ['workspace', vscode.ConfigurationTarget.Workspace],
    ['workspace folder', vscode.ConfigurationTarget.WorkspaceFolder],
  ] as const) {
    it(`enable and disable update the effective ${name} scope`, async () => {
      await vscode.workspace.getConfiguration(section, first).update('enabled', true, target);
      await vscode.commands.executeCommand(`${section}.disable`);
      const inspected = vscode.workspace
        .getConfiguration(section, first)
        .inspect<boolean>('enabled');
      assert.ok(inspected);
      assert.equal(
        target === vscode.ConfigurationTarget.Global
          ? inspected.globalValue
          : target === vscode.ConfigurationTarget.Workspace
            ? inspected.workspaceValue
            : inspected.workspaceFolderValue,
        false,
      );
      assert.deepEqual(
        provideSpacingHints(first, new vscode.Range(0, 0, 0, 4), uncancelled.token),
        [],
      );
      await vscode.commands.executeCommand(`${section}.enable`);
      assert.equal(
        provideSpacingHints(first, new vscode.Range(0, 0, 0, 4), uncancelled.token).length,
        3,
      );
    });
  }

  it('disable with no active editor and no override updates the global preference', async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    assert.equal(vscode.window.activeTextEditor, undefined);
    await vscode.commands.executeCommand(`${section}.disable`);
    assert.equal(
      vscode.workspace.getConfiguration(section).inspect<boolean>('enabled')?.globalValue,
      false,
    );
  });

  it('with no active editor an existing workspace override is still effective', async () => {
    await vscode.workspace
      .getConfiguration(section)
      .update('enabled', false, vscode.ConfigurationTarget.Workspace);
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    assert.equal(vscode.window.activeTextEditor, undefined);
    await vscode.commands.executeCommand(`${section}.enable`);
    const config = vscode.workspace.getConfiguration(section).inspect<boolean>('enabled');
    assert.equal(config?.workspaceValue, true);
    assert.equal(config?.globalValue, true);
  });

  it('commands use the active editor and providers use each requested document', async () => {
    await vscode.workspace
      .getConfiguration(section, second)
      .update('enabled', true, vscode.ConfigurationTarget.WorkspaceFolder);
    await vscode.window.showTextDocument(second);
    await vscode.commands.executeCommand(`${section}.disable`);
    assert.equal(
      vscode.workspace.getConfiguration(section, second).inspect<boolean>('enabled')
        ?.workspaceFolderValue,
      false,
    );
    assert.equal(
      provideSpacingHints(first, new vscode.Range(0, 0, 0, 4), uncancelled.token).length,
      3,
    );
    assert.deepEqual(
      provideSpacingHints(second, new vscode.Range(0, 0, 0, 4), uncancelled.token),
      [],
    );
  });
});
