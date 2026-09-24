const fs = require('node:fs');
const path = require('node:path');
process.parentPort.once('message', async ({ data: message }) => {
  try {
    const {data,profile}=typeof message==='string'?{data:message}:message;
    let code = 0;
    const logs = [];
    const engine = await require('./engine/gear-resolver.js')({
      noInitialRun: true,
      wasmBinary: fs.readFileSync(path.join(__dirname, 'engine/gear-resolver.wasm')),
      print: s => logs.push(s), printErr: s => logs.push(s),
      quit: (status, error) => { code = status; throw error; }
    });
    // Keep equipment body stats separate; gem IDs identify initial candidate types below.
    let bodyOnly = data.replace(/,(?:enchant_id|addon_id|gem_id|gem_bonus_id)=[0-9/]+(?=,|\s|$)/g, '');
    bodyOnly=require('./model.js').prepareProfileInput(bodyOnly,profile);
    if(!profile)bodyOnly+='\n# wgm_discover_traits=1\n';
    engine.FS.writeFile('/input.simc', Buffer.from(bodyOnly, 'utf8'));
    try { const result = engine.callMain(['/input.simc', '/output.txt']); if (typeof result === 'number') code = result; }
    catch (e) { if (typeof e.status !== 'number') throw e; code = e.status; }
    const report = engine.FS.analyzePath('/output.txt').exists ? engine.FS.readFile('/output.txt', { encoding: 'utf8' }) : '';
    const messages=logs.filter(s=>!s.startsWith('Trivial:'));
    const fullReport = report + (messages.length ? '\n' + messages.join('\n') : '');
    process.parentPort.postMessage({ code, report: fullReport, gear: require('./model.js').attachEquippedGems(require('./model.js').parseReport(fullReport), data) });
  } catch (e) { process.parentPort.postMessage({ code: 1, report: 'ERROR: ' + e.message }); }
});
