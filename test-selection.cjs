const assert=require('node:assert/strict'),M=require('./model.js');
const s=M.newState(),c=s.characters[0];c.baseStats={main:100,crit:0,haste:0,mastery:0,versatility:0};const gem=c.items.find(i=>i.slot==='gem');gem.selected=true;
const second=M.newCharacter('第二个');s.characters.push(second);s.activeId=second.id;M.closeCharacter(s,c.id);assert(M.reopenCharacter(s));assert.equal(s.activeId,c.id);assert.equal(c.baseStats.main,100);assert.equal(c.items.find(i=>i.id===gem.id).selected,true);
M.closeCharacter(s,c.id);M.closeCharacter(s,second.id);assert.equal(s.characters.length,1);assert.equal(M.baseline(s.characters[0]),null);assert.doesNotThrow(()=>M.validateState(s));
console.log('PASS: candidate selection, base stats and character close/reopen isolation.');
