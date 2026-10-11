const fs = require('node:fs');
const path = require('node:path');

// Remove only this project's generated output before compiling renamed modules.
fs.rmSync(path.resolve(__dirname, '..', 'out'), { recursive: true, force: true });
fs.rmSync(path.resolve(__dirname, '..', 'out-test'), { recursive: true, force: true });
