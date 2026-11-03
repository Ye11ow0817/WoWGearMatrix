const assert=require('node:assert/strict'),M=require('../../src/shared/model.js');
const item=(slot,socketCount=0,selected=true,extra={})=>({id:M.id(),slot,socketCount,selected,...extra});
const character=items=>({items,customSlots:[]});const count=items=>M.combinationCount(character(items)).total;
assert.equal(count([]),0n);assert.equal(count([item('head'),item('head'),item('neck'),item('neck'),item('neck')]),6n);
assert.equal(count([item('head',0,false)]),0n);
assert.equal(count([item('finger'),item('finger'),item('finger')]),3n);assert.equal(count([item('finger')]),1n);assert.equal(count([item('finger'),item('finger',0,false)]),0n);
assert.equal(count([item('head',2),item('gem'),item('gem')]),3n); // AA, AB, BB
assert.equal(count([item('head',2),item('gem'),item('gem'),item('gem',0,true,{uniqueGroup:'diamond'})]),2n);
assert.equal(count([item('head',2),item('gem',0,true,{uniqueGroup:'diamond'}),item('gem',0,true,{uniqueGroup:'diamond'})]),0n);
assert.equal(count([item('head',1),item('gem',0,true,{uniqueGroup:'diamond'}),item('gem',0,true,{uniqueGroup:'diamond'})]),2n);
assert.equal(count([item('head',0),item('head',2),item('gem'),item('gem')]),4n);
assert.equal(count([item('head'),item('food'),item('food'),item('flask'),item('flask'),item('flask')]),6n);
assert.equal(count([item('main_hand',0,true,{weaponType:'sword2h_3.60speed'}),item('off_hand',0,true,{weaponType:'shield'})]),1n);
assert.equal(count([item('main_hand',0,true,{weaponType:'staff_3.50speed'}),item('off_hand',0,true,{weaponType:'none'})]),1n);
assert.equal(count([item('main_hand',0,true,{weaponType:'sword2h_3.60speed'}),item('main_hand',0,true,{weaponType:'sword_2.60speed'}),item('off_hand'),item('off_hand')]),3n);
const large=[];for(const slot of ['head','neck','shoulders','back','chest','wrists','hands','waist','legs','feet'])for(let n=0;n<100;n++)large.push(item(slot));assert.equal(count(large),100000000000000000000n);
// Independent exhaustive enumeration of small fixtures, including pair slots and varying sockets.
function brute(c){
 const slots=M.getSlots(c).filter(([s])=>!M.usageSlot(s)),choices=[];
 for(const [s,,cap]of slots){const all=c.items.filter(i=>i.slot===s);if(!all.length)continue;const selected=all.filter(i=>i.selected),take=Math.min(cap,all.length),options=[];
  function pick(start,chosen){if(chosen.length===take){options.push(chosen.reduce((n,i)=>n+i.socketCount,0));return;}for(let i=start;i<selected.length;i++)pick(i+1,[...chosen,selected[i]]);}pick(0,[]);choices.push(options);
 }
 if(!choices.length)return 0n;
 const gems=c.items.filter(i=>i.slot==='gem'&&i.selected);
 function gemWays(index,left,used){if(!gems.length)return 1n;if(index===gems.length)return left===0&&(!gems.some(g=>g.uniqueGroup)||c.alwaysUseDiamond===false||used.size)?1n:0n;const g=gems[index];let ways=0n;for(let n=0;n<=left;n++){if(g.uniqueGroup&&(n>1||n&&used.size))continue;const next=new Set(used);if(n&&g.uniqueGroup)next.add(g.uniqueGroup);ways+=gemWays(index+1,left-n,next);}return ways;}
 function equipment(index,sockets){if(index===choices.length)return gemWays(0,sockets,new Set());let n=0n;for(const s of choices[index])n+=equipment(index+1,sockets+s);return n;}
 return equipment(0,0);
}
for(let seed=0;seed<40;seed++){
 const items=[item('head',seed%3),item('head',(seed+1)%3,seed%2===0),item('finger',1),item('finger',seed%2),item('finger',0,seed%3===0),item('gem'),item('gem',0,seed%2===0),item('gem',0,true,{uniqueGroup:'diamond'}),item('gem',0,seed%3===0,{uniqueGroup:'diamond'})];
 const c=character(items);assert.equal(M.combinationCount(c).total,brute(c),'fixture '+seed);
}
console.log('PASS: slot product, unordered pairs, empty/missing selections, variable sockets, fully filled gems, unique diamonds, food/flask factors, exact BigInt and 40 brute-force comparisons.');
// Maximum colors: compare against unrestricted allocations independently filtered by color count.
{
 const S=require('../../src/shared/search.js');
 const presets=M.gemGroups.slice(1).map(color=>M.presets.items.filter(p=>p.slot==='gem'&&p.name.includes(color)).slice(0,2));
 for(const colors of [0,1,2,4])for(const sockets of [0,1,2,3,5,6])for(const diamonds of [0,1,2])for(const required of [false,true]){
  const selected=presets.slice(0,colors).flat().map(p=>item('gem',0,true,{...p}));selected.push(item('gem'));
  for(let d=0;d<diamonds;d++)selected.push(item('gem',0,true,{uniqueGroup:'diamond'}));
  const c={...character([item('head',sockets),...selected]),alwaysUseDiamond:required};
  const all=[...S.combinations(c)].filter(Boolean),byId=new Map(selected.map(g=>[g.id,g]));
  const colorCount=row=>new Set(row.gems.map(g=>{const i=byId.get(g.id);return i.uniqueGroup?null:M.gemGroup(i);}).filter(Boolean)).size;
  const max=Math.max(0,...all.map(colorCount));
  const expected=all.filter(row=>!diamonds||!required||colorCount(row)===max).map(S.combinationId).sort();
  c.onlyMaxGemColors=true;const actual=[...S.combinations(c)].filter(Boolean);
  assert.deepEqual(actual.map(S.combinationId).sort(),expected,JSON.stringify({colors,sockets,diamonds,required}));
  assert.equal(M.combinationCount(c).total,BigInt(expected.length));
 }
 const c=character([item('head',0),item('head',2)]);c.onlyMaxGemColors=true;
 assert.equal(M.combinationCount(c).total,2n);assert.equal([...S.combinations(c)].filter(Boolean).length,2);
 assert.equal(M.newCharacter().onlyMaxGemColors,false);
 console.log('PASS: maximum colors, unknown colors, optional/required diamonds, varying sockets and 144 exhaustive fixtures.');
}
