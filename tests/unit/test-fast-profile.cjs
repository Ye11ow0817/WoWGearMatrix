const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),vm=require('node:vm');
const M=require('../../src/shared/model.js'),catalog=require('../../src/shared/data/profile-catalog.js');
const names={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../src/shared/data/talent-zh.js'),'utf8'),names);
for(const [key,entry] of Object.entries(catalog.profiles))for(const t of entry.traits){
 assert(/[\u3400-\u9fff]/.test(names.window.TalentZh[t.spellId]),`${key}/${t.name}: missing Chinese name`);
 const description=M.traitDescription(t,M.mainTypeFor(...key.split('/')),key.split('/')[1]);
 assert(!/当前状态|个百分点|undefined|NaN/.test(description),`${key}/${t.name}: ${description}`);
 assert.equal(typeof t.passive,'boolean');
}
function run(input,profile){const start=performance.now();const r=cp.spawnSync(process.execPath,[path.join(__dirname,'../../engine/run.cjs'),'-'],{input:M.prepareProfileInput(input,profile),encoding:'utf8',timeout:60000,maxBuffer:16e6});assert.equal(r.status,0,r.stderr.slice(-1000));return {result:M.parseReport(r.stdout,profile.fast),ms:Math.round(performance.now()-start)};}
const fixtures=[
 {class:'warrior',spec:'arms',race:'goblin',enabledTraits:[112224],characterState:'none'},
 {class:'warrior',spec:'protection',race:'human',enabledTraits:[112233,112235,112160,132883],characterState:'none'},
 {class:'druid',spec:'guardian',race:'night_elf',enabledTraits:[103311,103297],characterState:'bear_form'},
 {class:'druid',spec:'guardian',race:'night_elf',enabledTraits:[103311],characterState:'cat_form'},
 {class:'priest',spec:'holy',race:'human',enabledTraits:[103744],characterState:'none'},
 {class:'warlock',spec:'destruction',race:'gnome',enabledTraits:[91489],characterState:'none'},
 {class:'demon_hunter',spec:'vengeance',race:'orc',enabledTraits:[112845],characterState:'none'},
 {class:'mage',spec:'fire',race:'human',enabledTraits:[124795,124765],characterState:'none'}
];
const timings=[];
for(const fixture of fixtures){const profile={level:90,disabledTraits:[],...fixture};const full=run('',profile),fast=run('',{...profile,fast:true});
 for(const key of ['baseStats','basePercents','attributeFactors','attributeResponse','rawStats','activeCharacterState','availableCharacterStates'])assert.deepEqual(fast.result[key],full.result[key],`${fixture.class}/${fixture.spec}: ${key}`);
 for(const id of fixture.enabledTraits){const f=full.result.traits.find(t=>t.id===id),q=fast.result.traits.find(t=>t.id===id);assert(q?.enabled,`fast enabled ${id}`);assert.deepEqual(q.spellEffects,f.spellEffects,`resolved rank ${id}`);}
 timings.push({profile:fixture.class+'/'+fixture.spec,full:full.ms,fast:fast.ms});
}
const sample=fs.readFileSync(path.join(__dirname,'../fixtures/sample.simc'),'utf8');
const imported={class:'warrior',spec:'arms',race:'night_elf',level:90,enabledTraits:[],disabledTraits:[112224,112235],characterState:'battle_stance'};
const full=run(sample,imported),fast=run(sample,{...imported,fast:true});
assert.deepEqual(fast.result.baseStats,full.result.baseStats);assert.deepEqual(fast.result.basePercents,full.result.basePercents);
assert.equal(fast.result.traits.find(t=>t.id===112224).enabled,false);
assert.equal(M.traitDescription(catalog.profiles['warrior/arms'].traits.find(t=>t.id===112224),'strength','arms'),'+2%急速');
console.log('PASS: fast/full SimC parity, imported disabled talents, raw spell values, Chinese coverage and passive types.');
console.log(JSON.stringify(timings));
