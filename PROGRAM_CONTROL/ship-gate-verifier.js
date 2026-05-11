const { spawnSync } = require('child_process');
const path = require('path');

const entry = path.join(__dirname, 'ship-gate-verifier.ts');
const result = spawnSync(
  process.execPath,
  ['-r', 'ts-node/register/transpile-only', entry, ...process.argv.slice(2)],
  { stdio: 'inherit' },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
