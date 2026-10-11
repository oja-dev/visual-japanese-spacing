import * as path from 'path';
import Mocha from 'mocha';
import * as vscode from 'vscode';

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension('local.visual-japanese-spacing');
  if (!extension) throw new Error('Development extension is not available');
  await extension.activate();
  const mocha = new Mocha({ ui: 'bdd', color: true, timeout: 10000 });
  for (const file of ['boundaries.test.js', 'extension.test.js']) {
    mocha.addFile(path.resolve(__dirname, file));
  }
  await new Promise<void>((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) reject(new Error(`${failures} tests failed`));
      else resolve();
    });
  });
}
