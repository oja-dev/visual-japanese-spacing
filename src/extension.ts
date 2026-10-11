import * as vscode from 'vscode';
import { createSpacingController } from './spacingController';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(createSpacingController());
}
