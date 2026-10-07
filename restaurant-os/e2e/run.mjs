import { spawn } from 'node:child_process';
const p = spawn(process.execPath, ['--test', '--test-concurrency=1', '--test-timeout=1500000', 'e2e/app.e2e.mjs'], {
  stdio: 'inherit',
});
p.on('close', (c) => process.exit(c ?? 1));
