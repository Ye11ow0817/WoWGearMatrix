const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const M=require('./model.js');

const sample=fs.readFileSync(path.join(__dirname,'engine/sample.simc'),'utf8');
function parse(input){
  const run=spawnSync(process.execPath,[path.join(__dirname,'engine/run.cjs'),'-'],{input,encoding:'utf8',timeout:30000,maxBuffer:16*1024*1024});
  if(run.error)throw run.error;
  assert.equal(run.status,0,run.stderr+'\n'+run.stdout);
  return M.parseReport(run.stdout);
}

const initial=parse(sample);
const elemental=parse('shaman="Elemental"\nlevel=90\nrace=human\nspec=elemental\n# wgm_discover_traits=1\n');
assert.deepEqual(Object.keys(elemental.basePercents),['crit','haste','mastery','versatility','avoidance','leech','speed']);
for(const [key,value] of Object.entries(elemental.basePercents))assert(Number.isFinite(value)&&value>=0,`SimC base percentage ${key}`);
assert.equal(elemental.basePercents.versatility,0,'Naked import must not include the default Mark of the Wild raid buff');
const seer=elemental.traits.find(t=>t.id===136561);
assert.equal(seer.multiplier.main,1.03);
assert.equal(seer.enabled,false);
assert.deepEqual(initial.attributeContext,{class:'warrior',spec:'arms',level:90,race:'night_elf',talents:sample.match(/^talents=(.*)$/m)[1],dataVersion:require('./engine/manifest.json').gameData});
assert.equal(initial.rawStats.main,618);
assert.equal(initial.rawStats.stamina,4600);
assert.equal(initial.baseStats.stamina,5060);
assert.equal(initial.attributeFactors.stamina,1.1);
const reinforced=initial.traits.find(t=>t.name==='Reinforced Plates');
assert.equal(reinforced.effect.stamina,460);
assert.equal(M.traitDescription(reinforced,'strength','arms'),'+10%耐力、+10%护甲');
for(const spec of ['arms','fury','protection']){
  const profile=require('./profile-catalog.js').profiles[`warrior/${spec}`];
  const armed=profile.traits.find(t=>t.id===112233),plates=profile.traits.find(t=>t.id===112235);
  assert(armed,`${spec} must expose Armored to the Teeth even with zero naked armor`);
  assert.equal(armed.rank,2);
  assert.equal(M.traitDescription(armed,'strength',spec),`获得相当于护甲${spec==='protection'?4:10}%的力量`);
  assert.equal(M.traitDescription(plates,'strength',spec),spec==='protection'?'+10%耐力、+16%护甲':'+10%耐力、+10%护甲');
}
const catalog=require('./profile-catalog.js');
assert.equal(Object.keys(catalog.profiles).length,40);
for(const [key,profile] of Object.entries(catalog.profiles))for(const trait of profile.traits){
  const [cls,spec]=key.split('/');
  const description=M.traitDescription(trait,M.mainTypeFor(cls,spec),spec);
  assert(description&&!description.includes('undefined'),`${key}/${trait.name} has no source-effect description`);
}
const legacy=M.newState(),oldArms=legacy.characters[0];
oldArms.traits=oldArms.traits.filter(t=>t.id!==112233).map(t=>{const {spellEffects,probe,response,...old}=t;return old;});
oldArms.report='trait: id=112233 | spell=384124 | name=Armored to the Teeth | rank=2 | enabled=1 | origin=import\n';
M.validateState(legacy);
assert.equal(oldArms.traits.find(t=>t.id===112233).enabled,true);
assert.equal(M.traitDescription(oldArms.traits.find(t=>t.id===112235),'strength','arms'),'+10%耐力、+10%护甲');

const state=M.newState(),character=state.characters[0];
const manualChoice=M.newCharacter('Manual choice');
assert.equal(manualChoice.baseStats.main,null);
assert(manualChoice.traits.some(t=>t.id===112235));
M.selectProfile(manualChoice,{class:'shaman',spec:'elemental'});
M.editDisplayedStat(manualChoice,'main',700);
assert.equal(manualChoice.rawBaseStats.main,700);
M.toggleTrait(manualChoice,136561,true);
assert.equal(manualChoice.baseStats.main,700);
assert.equal(manualChoice.attributeFactors.main,1.03);
M.editDisplayedStat(manualChoice,'main',638);
assert.equal(manualChoice.rawBaseStats.main,620);
M.editDisplayedStat(manualChoice,'main',721);
assert(Math.abs(manualChoice.rawBaseStats.main-700)<0.001);
M.selectProfile(manualChoice,{race:'orc'});
assert.equal(manualChoice.baseStats.main,721);
assert.equal(manualChoice.attributeContext.race,'orc');
assert.equal(manualChoice.attributeFactors.crit,1);
M.selectProfile(manualChoice,{class:'mage',spec:'fire'});
assert.equal(manualChoice.baseStats.main,721);
assert.equal(manualChoice.mainType,'intellect');
M.applyImport(character,initial,'');
assert.equal(M.scaledStat(character,'stamina',100),5170);
assert.equal(character.rawBaseStats.stamina,4600);
assert.equal(character.baseStats.stamina,5060);

const disabled=parse(M.prepareProfileInput(sample,{class:'warrior',spec:'arms',race:'night_elf',disabledTraits:[reinforced.id]}));
assert.equal(disabled.traits.find(t=>t.id===reinforced.id).effect.stamina,460);
character.disabledTraits=[reinforced.id];
M.applyProfile(character,disabled);
assert.equal(character.baseStats.stamina,4600);
assert.equal(M.scaledStat(character,'stamina',100),4700);
assert.equal(character.traits.find(t=>t.id===reinforced.id).enabled,false);

const orc=parse(M.prepareProfileInput(sample,{class:'warrior',spec:'arms',race:'orc',disabledTraits:[]}));
character.disabledTraits=[];M.applyProfile(character,orc);
assert.equal(character.rawBaseStats.main,623);
assert.equal(character.attributeContext.race,'orc');
assert.equal(character.traits.find(t=>t.id===reinforced.id).enabled,true);
const warrior=M.newCharacter('Warrior formulas');
warrior.baseStats={...catalog.profiles['warrior/protection'].baseStats};
M.selectProfile(warrior,{class:'warrior',spec:'protection'});
for(const id of [112235,112160,112233])M.toggleTrait(warrior,id,true);
const selectedWarrior=parse('warrior="Audit"\nlevel=90\nrace=human\nspec=protection\n# wgm_enable_traits=112235/112160/112233\n');
assert(Math.abs(warrior.attributeFactors.armor-selectedWarrior.attributeFactors.armor)<0.00001);
assert(M.scaledStats(warrior,{main:100,armor:100}).armor>M.scaledStat(warrior,'armor',100));
const arms=M.newCharacter('Armed arms');
arms.baseStats={...catalog.profiles['warrior/arms'].baseStats};
M.toggleTrait(arms,112233,true);
assert.equal(M.scaledStats(arms,{armor:1000}).main,arms.baseStats.main+100);
arms.items.push({id:M.id(),itemId:1,name:'护甲转力量测试',slot:'head',origin:'custom',ilevel:1,mainType:'strength',stats:{...Object.fromEntries(M.itemStats.map(([key])=>[key,0])),armor:1000},selected:true,socket:false,embellishment:false,set:false});
const armoredSearch=require('./search.js').createSearch(arms);armoredSearch.step(10);
assert.equal(armoredSearch.snapshot().rows[0].stats.main,arms.baseStats.main+100);
const vengeance=parse('demon_hunter="Vengeance"\nlevel=90\nrace=human\nspec=vengeance\n# wgm_discover_traits=1\n');
assert(vengeance.attributeResponse);
const dh=M.newCharacter('Vengeance armor');
M.selectProfile(dh,{class:'demon_hunter',spec:'vengeance'});
dh.baseStats={...vengeance.baseStats};
assert(Math.abs(M.scaledStats(dh,{main:1000,mastery:1000}).armor-dh.baseStats.armor-vengeance.attributeResponse.armor_joint)<1);
M.toggleTrait(dh,112845,true);
assert(Math.abs(dh.attributeResponse.armor_agility-vengeance.attributeResponse.armor_agility-56)<0.01);
const orcVengeance=parse('demon_hunter="Orc"\nlevel=90\nrace=orc\nspec=vengeance\n');
const dhRace=M.newCharacter('Vengeance race');M.selectProfile(dhRace,{class:'demon_hunter',spec:'vengeance'});
dhRace.baseStats={...orcVengeance.baseStats};M.selectProfile(dhRace,{race:'orc'});
assert(Math.abs(M.scaledStats(dhRace,{mastery:1000}).armor-dhRace.baseStats.armor-orcVengeance.attributeResponse.armor_mastery)<1);
const hunter=M.newCharacter('Survival dual wield');
M.selectProfile(hunter,{class:'hunter',spec:'survival'});
hunter.baseStats={...catalog.profiles['hunter/survival'].baseStats};
M.toggleTrait(hunter,126332,true);
for(const slot of ['main_hand','off_hand'])hunter.items.push({id:M.id(),itemId:1,name:slot,slot,weaponType:'sword_2.60speed_10min_20max',origin:'custom',ilevel:1,mainType:'agility',stats:{...Object.fromEntries(M.itemStats.map(([key])=>[key,0])),main:100},selected:true,socket:false,embellishment:false,set:false});
const hunterSearch=require('./search.js').createSearch(hunter);hunterSearch.step(10);
assert.equal(hunterSearch.snapshot().rows[0].stats.main,M.scaledStats(hunter,{main:200},{dualWield:true}).main);
assert(require('./search.js').defaultRanges(hunter).main.max>=hunterSearch.snapshot().rows[0].stats.main);

const Search=require('./search.js'),searchState=M.newState(),searchCharacter=searchState.characters[0];
searchCharacter.baseStats={...initial.baseStats};searchCharacter.rawBaseStats={...initial.rawStats};searchCharacter.attributeFactors={...initial.attributeFactors};
searchCharacter.items.push({id:M.id(),itemId:1,name:'耐力测试装备',slot:'head',origin:'custom',ilevel:1,mainType:'strength',stats:{...Object.fromEntries(M.itemStats.map(([key])=>[key,0])),stamina:100},selected:true,socket:false,embellishment:false,set:false});
const search=Search.createSearch(searchCharacter);search.step(10);
assert.equal(search.snapshot().rows[0].stats.stamina,5170);
assert.deepEqual(Search.defaultRanges(searchCharacter).stamina,{min:5170,max:5170});

const mageInput=M.prepareProfileInput(sample,{class:'mage',spec:'arcane',race:'orc',disabledTraits:[]});
assert.match(mageInput,/^mage="Yellowwar"$/m);
assert.match(mageInput,/^talents=$/m);
const mage=parse(mageInput);
character.disabledTraits=[];M.applyProfile(character,mage);
assert.equal(character.mainType,'intellect');
assert.equal(character.attributeContext.class,'mage');

const bare=parse('warrior="Bare"\nlevel=90\nrace=night_elf\nspec=arms\n');
assert.equal(bare.items.length,0);
assert.equal(bare.rawStats.main,618);
const manual=parse(M.prepareProfileInput('',{class:'warrior',spec:'arms',race:'human',level:90,disabledTraits:[],enabledTraits:[]}));
assert.equal(manual.attributeContext.class,'warrior');
assert.equal(manual.attributeContext.race,'human');
assert.equal(manual.items.length,0);
assert.equal(manual.traits.find(t=>t.id===112235).enabled,false);
const selected=parse(M.prepareProfileInput('',{class:'warrior',spec:'arms',race:'human',level:90,disabledTraits:[],enabledTraits:[112235]}));
assert.equal(selected.traits.find(t=>t.id===112235).enabled,true);
assert.equal(selected.baseStats.stamina,manual.baseStats.stamina+460);
const manualState=M.newState(),manualCharacter=manualState.characters[0];
manualCharacter.enabledTraits=[112235];M.applyProfile(manualCharacter,selected);
M.validateState(manualState);
assert.equal(M.raceGroups.其他.haranir,'哈籁尼尔');
assert.equal(M.specLabels.demon_hunter.devourer,'噬灭');
for(const [cls,spec] of [['priest','holy'],['evoker','preservation'],['death_knight','blood'],['demon_hunter','devourer']]){
  const profile=parse(M.prepareProfileInput('',{class:cls,spec,race:'human',level:90,disabledTraits:[],enabledTraits:[]}));
  assert.equal(profile.attributeContext.class,cls);
  assert.equal(profile.attributeContext.spec,spec);
  assert(Number.isFinite(profile.rawStats.stamina));
}
const dkText=M.prepareProfileInput('deathknight="Test"\nlevel=90\nrace=human\nspec=blood\n',{class:'death_knight',spec:'blood',race:'human',level:90,disabledTraits:[],enabledTraits:[]});
assert.match(dkText,/^death_knight="Test"$/m);

M.validateState(state);
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'wgm-profile-'));
try{
  const storage=require('./storage.cjs')(folder);storage.save(state);
  assert.deepEqual(storage.load().characters[0].rawBaseStats,character.rawBaseStats);
  assert.deepEqual(storage.load().characters[0].attributeContext,character.attributeContext);
  storage.save(manualState);
  assert.deepEqual(storage.load().characters[0].enabledTraits,[112235]);
}finally{fs.rmSync(folder,{recursive:true,force:true});}
console.log('PASS: SimC raw/derived stats, talent toggle, race/class/spec recalculation, naked profile, multipliers and persistence.');
