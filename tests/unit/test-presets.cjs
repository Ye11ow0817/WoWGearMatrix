const assert=require('node:assert/strict'),M=require('../../src/shared/model.js');const c=M.newCharacter();
assert.equal(c.items.length,58);assert.equal(M.candidates(c).length,0);assert.deepEqual(M.gemGroups,['钻石','榴石','榄石','紫晶','青金石']);
assert(!c.items.some(i=>['enchant-8009','enchant-8007'].includes(i.presetId)));
for(const group of M.gemGroups)assert.equal(c.items.filter(i=>M.gemGroup(i)===group).length,4);
const renamed=c.items.find(i=>i.presetId==='240983');renamed.name='Edited';assert.equal(M.gemGroup(renamed),'钻石');assert.equal(renamed.stats.main,32);
assert(c.items.every(i=>!('position'in i)&&!('equippedCount'in i)));assert.equal(c.items.find(i=>i.presetId==='241322').stats.mastery,165);
console.log('PASS: 58 presets, five gem groups, stable grouping after edits, no usage controls.');
