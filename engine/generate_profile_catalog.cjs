const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const M=require('../src/shared/model.js');
const runner=path.join(__dirname,'./run.cjs');
function parse(cls,spec,race='human'){
  const input=`${cls}="Catalog"\nlevel=90\nrace=${race}\nspec=${spec}\n# wgm_discover_traits=1\n`;
  const run=spawnSync(process.execPath,[runner,'-'],{input,encoding:'utf8',timeout:60000,maxBuffer:16*1024*1024});
  if(run.error||run.status!==0)throw Error(`${cls}/${spec}/${race}: ${run.error||run.stderr||run.stdout}`);
  const result=M.parseReport(run.stdout);
  if(!result.baseStats||!result.rawStats||!result.attributeFactors)throw Error(`${cls}/${spec}/${race}: missing stats`);
  result.allRaw=Object.fromEntries([...(run.stdout.match(/^raw_character: (.*)$/m)?.[1]||'').matchAll(/(\w+)=(-?[\d.]+)/g)].map(m=>[m[1],Number(m[2])]));
  const mastery=run.stdout.match(/^mastery_reference: spell=(\d+) \| name=(.*?) \| coefficient=([\d.]+)$/m);
  if(!mastery)throw Error(`${cls}/${spec}: missing mastery reference`);
  result.masteryReference=[Number(mastery[1]),mastery[2],Number(mastery[3])];
  return result;
}
const profiles={},masteries={};
for(const [cls,specs] of Object.entries(M.classes))for(const spec of specs){
  const result=parse(cls,spec);
  profiles[`${cls}/${spec}`]={baseStats:result.baseStats,rawStats:result.rawStats,attributeFactors:result.attributeFactors,attributeResponse:result.attributeResponse,traits:result.traits,dataVersion:result.attributeContext.dataVersion};
  masteries[`${cls}_${spec}`]=result.masteryReference;
  process.stdout.write(`${cls}/${spec} ${result.traits.length}\n`);
}
const races={};
for(const race of Object.values(M.raceGroups).flatMap(group=>Object.keys(group))){
  const result=parse('warrior','arms',race);
  races[race]={strength:result.allRaw.strength,agility:result.allRaw.agility,intellect:result.allRaw.intellect,stamina:result.allRaw.stamina,attributeFactors:result.attributeFactors};
}
const catalog={profiles,races};
const source=`(function(root){'use strict';const catalog=${JSON.stringify(catalog)};if(typeof module!=='undefined')module.exports=catalog;else root.ProfileCatalog=catalog;})(globalThis);\n`;
fs.writeFileSync(path.join(__dirname,'../src/shared/data/profile-catalog.js'),source);
const version=Object.values(profiles)[0].dataVersion;
fs.writeFileSync(path.join(__dirname,'../src/shared/data/mastery-data.js'),`// Mastery spell and first-effect coefficient by class/spec from bundled SimC ${version}.\n(function(root){const data=${JSON.stringify(masteries)};if(typeof module!=='undefined')module.exports=data;else root.MasteryData=data;})(globalThis);\n`);
console.log(`Saved ${Object.keys(profiles).length} profiles and ${Object.keys(races).length} races.`);
