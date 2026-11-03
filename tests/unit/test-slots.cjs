const assert=require('node:assert/strict'),M=require('../../src/shared/model.js');const s=M.newState(),c=s.characters[0];M.validateState(s);assert.equal(M.getSlots(c).length,18);
const slot=M.addSlot(c,'临时增益');assert.equal(M.getSlots(c).length,19);assert.throws(()=>M.addSlot(c,'食物'));assert.throws(()=>M.addSlot(c,' 临时增益 '));M.renameSlot(c,slot.id,'其他增益');
const duplicate=structuredClone(s);duplicate.characters[0].customSlots.push({id:'custom_duplicate',name:'食物'});assert.throws(()=>M.validateState(duplicate));
M.applyImport(c,{items:[],mainType:'strength',skipped:0,failed:0},'');assert.equal(c.customSlots[0].name,'其他增益');const bad=structuredClone(s);bad.characters[0].items[0].slot='unknown';assert.throws(()=>M.validateState(bad));
const other=M.addSlot(c,'保留栏位'),otherItem={id:M.id(),slot:other.id,name:'保留项目'};c.items.push({id:M.id(),slot:slot.id,name:'待删除项目'},otherItem);
const before=c.items.length;assert.throws(()=>M.removeSlot(c,'food'));assert.equal(c.items.length,before);M.removeSlot(c,slot.id);assert(!M.getSlots(c).some(([key])=>key===slot.id));assert(!c.items.some(i=>i.slot===slot.id));assert(c.items.includes(otherItem));assert(c.customSlots.some(s=>s.id===other.id));assert.throws(()=>M.removeSlot(c,slot.id));
console.log('PASS: custom slots, duplicate names, validation and import preservation.');
