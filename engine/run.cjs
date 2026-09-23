// All host file I/O stays in Node. The C++ engine uses only virtual files.
const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const [input, output, extra] = process.argv.slice(2);
  if (!input || extra) { console.error('Usage: node run.cjs <input.simc|-> [output.txt]'); process.exitCode = 1; return; }
  const data = fs.readFileSync(input === '-' ? 0 : input);
  if (data.length > 4 * 1024 * 1024) throw new Error('Input exceeds 4 MiB');
  let exitCode = 0;
  const engine = await require('./gear-resolver.js')({
    noInitialRun: true,
    wasmBinary: fs.readFileSync(path.join(__dirname, 'gear-resolver.wasm')),
    print: console.log, printErr: console.error,
    quit: (status, error) => { exitCode = status; throw error; }
  });
  engine.FS.writeFile('/input.simc', data);
  try {
    const result = engine.callMain(['/input.simc', '/output.txt']);
    if (typeof result === 'number') exitCode = result;
  } catch (e) {
    if (typeof e.status !== 'number') throw e;
    exitCode = e.status;
  }
  if (engine.FS.analyzePath('/output.txt').exists) {
    const result = engine.FS.readFile('/output.txt');
    if (output) fs.writeFileSync(output, result);
    else process.stdout.write(Buffer.from(result));
  }
  process.exitCode = exitCode;
}
main().catch(e => { console.error('ERROR: ' + e.message); process.exitCode = 1; });
