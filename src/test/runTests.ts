import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'visual-japanese-spacing-test-'));
  try {
    const folders = ['first', 'second'].map((name) => path.join(root, name));
    for (const folder of folders) {
      await fs.mkdir(folder);
      await fs.writeFile(path.join(folder, 'sample.txt'), '日A日B');
    }
    const workspace = path.join(root, 'test.code-workspace');
    await fs.writeFile(
      workspace,
      JSON.stringify({ folders: folders.map((folder) => ({ path: folder })) }),
    );
    await runTests({
      extensionDevelopmentPath: path.resolve(__dirname, '../..'),
      extensionTestsPath: path.resolve(__dirname, 'index'),
      vscodeExecutablePath: process.env.VSCODE_EXECUTABLE_PATH,
      version: '1.100.0',
      launchArgs: [
        workspace,
        '--disable-extensions',
        '--skip-welcome',
        '--skip-release-notes',
        '--user-data-dir',
        path.join(root, 'profile'),
        '--extensions-dir',
        path.join(root, 'extensions'),
      ],
    });
  } finally {
    await fs.rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
