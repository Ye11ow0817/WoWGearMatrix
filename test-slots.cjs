const assert=require('node:assert/strict'),M=require('./model.js');const s=M.newState(),c=s.characters[0];M.validateState(s);assert.equal(M.getSlots(c).length,18);
const slot=M.addSlot(c,'临时增益');assert.equal(M.getSlots(c).length,19);assert.throws(()=>M.addSlot(c,'食物'));assert.throws(()=>M.addSlot(c,' 临时增益 '));M.renameSlot(c,slot.id,'其他增益');
const duplicate=structuredClone(s);duplicate.characters[0].customSlots.push({id:'custom_duplicate',name:'食物'});assert.throws(()=>M.validateState(duplicate));
M.applyImport(c,{items:[],mainType:'strength',skipped:0,failed:0},'');assert.equal(c.customSlots[0].name,'其他增益');const bad=structuredClone(s);bad.characters[0].items[0].slot='unknown';assert.throws(()=>M.validateState(bad));
console.log('PASS: custom slots, duplicate names, validation and import preservation.');
