const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const directory = path.join(root, 'tests/electron');
const available = fs.readdirSync(directory).filter(name => name.endsWith('.cjs')).sort();
const selected = process.argv.slice(2);
const names = selected.length ? selected : available;
for (const name of names) {
  if (!available.includes(name)) throw new Error(`Unknown Electron test: ${name}. Available: ${available.join(', ')}`);
}
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'wowgearmatrix-electron-'));
console.log(`Electron test evidence: ${output}`);
const failures = [];
for (const name of names) {
  const testOutput = path.join(output, path.basename(name, '.cjs'));
  fs.mkdirSync(testOutput);
  const script = path.join(directory, name);
  const restores = fs.readFileSync(script, 'utf8').includes('SIMC_TEST_RESTORE') ? ['0', '1'] : ['0'];
  for (const restore of restores) {
    console.log(`Running ${name} (restore=${restore})`);
    const env = { ...process.env, SIMC_TEST_SCRIPT: script, SIMC_TEST_OUTPUT: testOutput, SIMC_TEST_RESTORE: restore };
    delete env.ELECTRON_RUN_AS_NODE;
    const result = spawnSync(require('electron'), [root, '--smoke-test'], {
      cwd: root, env, encoding: 'utf8', timeout: 180000, windowsHide: true,
    });
    fs.writeFileSync(path.join(testOutput, `stdout-${restore}.txt`), result.stdout || '');
    fs.writeFileSync(path.join(testOutput, `stderr-${restore}.txt`), result.stderr || '');
    if (result.stdout) process.stdout.write(result.stdout);
    // Chromium diagnostics may appear on stderr even on successful runs.
    // Require evidence from the test as well as an exit code: some Windows
    // launcher failures return zero before Electron can execute the script.
    const artifacts = fs.readdirSync(testOutput).filter(file => !/^(stdout|stderr)-/.test(file) && file !== 'test-user-data');
    const restorePassed = restore !== '1' || artifacts.some(file => file.includes('restart-test'));
    if (result.error || result.status !== 0 || !artifacts.length || !restorePassed) {
      process.stderr.write(result.stderr || '');
      console.error(result.error || `Electron test failed: ${name} (exit=${result.status}, restore=${restore}). Logs: ${testOutput}`);
      failures.push(`${name} (restore=${restore})`);
      break;
    }
    console.log(`PASS ${name} (restore=${restore})`);
  }
}
if (failures.length) {
  console.error(`Failed ${failures.length} Electron test(s): ${failures.join(', ')}`);
  process.exitCode = 1;
}
