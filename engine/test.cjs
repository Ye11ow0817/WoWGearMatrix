const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'simc-gear-test-'));
const sample = fs.readFileSync(path.join(__dirname, 'sample.simc'), 'utf8');
let passed = 0;
function run(text) {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'run.cjs'), '-'],
    { input: text, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 30000 });
  if (r.error) throw r.error;
  return r;
}
function test(name, f) { f(); passed++; console.log('PASS ' + name); }
try {
  test('sample: all 26 items, correct slots and all item levels match', () => {
    const r = run(sample); assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /total=26 resolved=26 failed=0 ilevel_mismatches=0/);
    assert.equal((r.stdout.match(/^\[\d+\] equipped /gm) || []).length, 16);
    assert.equal((r.stdout.match(/^\[\d+\] Gear from Bags /gm) || []).length, 10);
    assert.match(r.stdout, /equipped \/ wrist/); assert.match(r.stdout, /equipped \/ shoulder/);
    assert.match(r.stdout, /critical_damage_bonus=2%/);
    assert.match(r.stdout, /strength=\d+/);
    assert.doesNotMatch(r.stdout, /[\x00-\x08\x0b\x0c\x0e-\x1f]/);
  });
  const header = 'warrior="Test"\nlevel=90\nrace=night_elf\nspec=arms\n';
  const ring = sample.split(/\r?\n/).find(x => x.startsWith('finger1='));
  test('same item ID with different bonuses remains two separate candidates', () => {
    const r = run(header + '### Gear from Bags\n# ' + ring + '\n# ' + ring.replace('12846', '12843'));
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /total=2 resolved=2/);
    const levels = [...r.stdout.matchAll(/\| ilevel=(\d+)/g)].map(x => x[1]);
    assert.equal(levels.length, 2); assert.notEqual(levels[0], levels[1]);
  });
  test('removing gem and enchant leaves base stats unchanged', () => {
    const a = run(header + ring), b = run(header + ring.replace(/,gem_id=[\d/]+/, '').replace(/,enchant_id=\d+/, ''));
    assert.equal(a.status, 0); assert.equal(b.status, 0);
    assert.equal(a.stdout.match(/^base:.*$/m)[0], b.stdout.match(/^base:.*$/m)[0]);
    assert.match(b.stdout, /gems: \(none\)/); assert.doesNotMatch(b.stdout, /critical_damage_bonus/);
  });
  test('unknown item fails explicitly and does not prevent valid items', () => {
    const r = run(header + 'head=,id=999999999\n' + ring);
    assert.equal(r.status, 2); assert.match(r.stdout, /Item missing/); assert.match(r.stdout, /resolved=1 failed=1/);
  });
  test('unknown bonus cannot silently become base item', () => {
    const r = run(header + 'head=,id=271456,bonus_id=999999999');
    assert.equal(r.status, 2); assert.match(r.stdout, /Bonus missing/);
  });
  test('unsupported item option is rejected', () => {
    const r = run(header + 'head=,id=271456,source=wowhead');
    assert.equal(r.status, 2); assert.match(r.stdout, /Unsupported item option/);
  });
  test('bad input returns a nonzero status', () => {
    const r = run('not a profile'); assert.equal(r.status, 1); assert.match(r.stderr, /No equipment/);
  });
  test('different export version produces an explicit warning', () => {
    const r = run('# WoW 12.0.0.1, TOC 120000\n' + header + ring);
    assert.equal(r.status, 0); assert.match(r.stdout, /export version differs/);
  });
  test('UTF-8 BOM, CRLF and Unicode file paths', () => {
    const input = path.join(dir, '中文装备.simc'), output = path.join(dir, '属性结果.txt');
    fs.writeFileSync(input, '\ufeff' + sample.replace(/\r?\n/g, '\r\n'));
    const r = spawnSync(process.execPath, [path.join(__dirname, 'run.cjs'), input, output], { encoding: 'utf8', timeout: 30000 });
    assert.equal(r.status, 0, r.stderr); assert.match(fs.readFileSync(output, 'utf8'), /total=26 resolved=26/);
  });
  console.log(`\n${passed} tests passed.`);
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
