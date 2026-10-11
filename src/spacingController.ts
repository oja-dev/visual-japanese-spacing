import * as vscode from 'vscode';
import { provideSpacingHints } from './spacingHints';

const CONFIGURATION_SECTION = 'visualJapaneseSpacing';

/** Owns the hint provider, configuration refresh, and explicit state commands. */
export function createSpacingController(): vscode.Disposable {
  const hintChanges = new vscode.EventEmitter<void>();
  let disposed = false;
  let pendingSettingsUpdate = Promise.resolve();

  function setEnabled(enabled: boolean): Promise<void> {
    const document = vscode.window.activeTextEditor?.document;
    // Preserve command order when a previous settings write is still pending.
    const update = pendingSettingsUpdate.then(async () => {
      const config = vscode.workspace.getConfiguration(CONFIGURATION_SECTION, document);
      if (config.get<boolean>('enabled', true) === enabled) {
        return;
      }
      const inspected = config.inspect<boolean>('enabled');
      const target =
        inspected?.workspaceFolderValue !== undefined
          ? vscode.ConfigurationTarget.WorkspaceFolder
          : inspected?.workspaceValue !== undefined
            ? vscode.ConfigurationTarget.Workspace
            : vscode.ConfigurationTarget.Global;
      await config.update('enabled', enabled, target);
    });
    // Return failures to the caller without blocking later commands.
    pendingSettingsUpdate = update.catch(() => {});
    return update;
  }

  const subscriptions = [
    hintChanges,
    vscode.languages.registerInlayHintsProvider('*', {
      onDidChangeInlayHints: hintChanges.event,
      provideInlayHints: provideSpacingHints,
    }),
    // VS Code owns viewport, document-edit, and language-mode re-querying.
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(CONFIGURATION_SECTION)) {
        hintChanges.fire();
      }
    }),
    vscode.commands.registerCommand(`${CONFIGURATION_SECTION}.enable`, () => setEnabled(true)),
    vscode.commands.registerCommand(`${CONFIGURATION_SECTION}.disable`, () => setEnabled(false)),
    vscode.commands.registerCommand(`${CONFIGURATION_SECTION}.openSettings`, () =>
      vscode.commands.executeCommand('workbench.action.openSettings', CONFIGURATION_SECTION),
    ),
  ];

  return {
    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      for (const subscription of subscriptions) {
        subscription.dispose();
      }
    },
  };
}
