const assert=require('node:assert/strict'),M=require('./model.js');const s=M.newState(),c=s.characters[0];
assert.equal(c.items.filter(i=>i.slot==='food').length,5);
assert.deepEqual(c.items.filter(i=>i.slot==='food').map(i=>[i.name,i.stats.stamina,i.stats.main,i.stats.haste,i.stats.crit,i.stats.versatility,i.stats.mastery]),[['哈赖恩达尔庆典大餐',98,50,0,0,0,0],['虚无空盘餐',0,0,58,0,0,0],['阳灼光鳍鱼',0,0,0,58,0,0],['虚吻鱼肉卷',0,0,0,0,58,0],['迁跃睿心鱼翅',0,0,0,0,0,58]]);
const expected={head:[7991,7961,8017],shoulders:[7973,8001,8031],legs:[8163,8159,7935],finger:[7967,7997,8025,8027,7969]};for(const [key,ids]of Object.entries(expected))assert.deepEqual(c.items.filter(i=>i.slot==='enchant'&&i.enchantSlot===key).map(i=>i.enchantId).sort(),ids.sort());
const item=slot=>({id:M.id(),slot,name:'test',origin:'custom',selected:true,ilevel:300,mainType:'strength',stats:Object.fromEntries(M.itemStats.map(([k])=>[k,0])),socket:false,embellishment:false,set:true,setId:123});
for(const [slot]of M.slots){const i=item(slot);if(slot==='enchant')i.enchantSlot='head';M.upsert(c,i);assert.equal(i.set,M.tierSlots.includes(slot));}
M.validateState(s);const before=JSON.stringify(s);M.validateState(s);assert.equal(JSON.stringify(s),before);
console.log('PASS: exact food stats, enchant allowlists, tier slots, validation idempotence.');
