const assert=require('node:assert/strict'),M=require('./model.js'),S=require('./search.js');
const zeros=()=>Object.fromEntries(M.itemStats.map(([k])=>[k,0]));
const item=(slot,stats={},extra={})=>({id:M.id(),slot,name:slot,origin:'custom',selected:true,ilevel:300,mainType:'strength',stats:{...zeros(),...stats},socket:false,embellishment:false,set:false,...extra});
const character=items=>({items,baseStats:{...zeros(),main:100},mainType:'strength',customSlots:[],filters:{},sort:{limit:500}});
function all(c){const task=S.createSearch(c);while(!task.step(1000)){}return task.snapshot().rows;}
for(let seed=0;seed<20;seed++){
 const c=character([item('head',{main:10+seed,haste:3},{socketCount:1}),item('head',{main:30,crit:4},{socketCount:2}),item('finger',{haste:seed},{locked:seed%2===0}),item('finger',{haste:2}),item('finger',{crit:8}),item('gem',{haste:7}),item('gem',{crit:5}),item('gem',{main:3},{uniqueGroup:'diamond'}),item('enchant',{crit:6},{enchantSlot:'head'}),item('enchant',{haste:8},{enchantSlot:'head'}),item('food',{main:50},{adaptiveMain:true}),item('food',{haste:58})]);
 const bounds=S.defaultRanges(c);c.filters={ranges:Object.fromEntries(M.itemStats.map(([k])=>[k,{min:0,max:1e9}]))};const rows=all(c);assert.equal(BigInt(rows.length),M.combinationCount(c).total);assert(rows.length&&rows.length<=500);for(const [k]of M.itemStats){assert.equal(bounds[k].min,Math.min(...rows.map(r=>r.stats[k])),k+' min '+seed);assert.equal(bounds[k].max,Math.max(...rows.map(r=>r.stats[k])),k+' max '+seed);}
}
const c=character([item('head',{haste:20}),item('head',{haste:40})]);assert.deepEqual(S.defaultRanges(c).haste,{min:20,max:40});c.filters={ranges:{haste:{min:41}}};assert.throws(()=>S.settings(c),/最低值/);c.filters={ranges:{haste:{max:19}}};assert.throws(()=>S.settings(c),/最低值/);c.filters={ranges:{haste:{min:30,max:35}}};assert.deepEqual(S.settings(c).ranges.haste,{min:30,max:35});c.filters={};assert.deepEqual(S.settings(c).ranges.haste,{min:20,max:40});c.items[1].selected=false;assert.deepEqual(S.defaultRanges(c).haste,{min:20,max:20});
const empty=character([]);assert.deepEqual(S.defaultRanges(empty),{});
assert.deepEqual(S.defaultCountRanges(empty),{sockets:{min:0,max:0},tier:{min:0,max:0},embellishment:{min:0,max:0},boe:{min:0,max:0}});
const counts=character([item('head',{}, {set:true,setGroup:'A',embellishment:true,boe:true}),item('head'),item('shoulders',{}, {set:true,setGroup:'A',boe:true}),item('finger',{}, {boe:true,locked:true}),item('finger',{}, {boe:true}),item('finger')]);
assert.deepEqual(S.defaultCountRanges(counts),{sockets:{min:0,max:0},tier:{min:1,max:2},embellishment:{min:0,max:1},boe:{min:2,max:4}});assert.deepEqual(S.settings(counts).counts,S.defaultCountRanges(counts));
counts.items[0].selected=false;assert.deepEqual(S.defaultCountRanges(counts),{sockets:{min:0,max:0},tier:{min:1,max:1},embellishment:{min:0,max:0},boe:{min:2,max:3}});
counts.filters={counts:{boe:{min:'4'}}};assert.equal(all(counts).length,0);
const weaponCounts=character([item('main_hand',{}, {weaponType:'sword2h_3.60speed',boe:true}),item('main_hand',{}, {weaponType:'sword_2.60speed'}),item('off_hand',{}, {boe:true})]);assert.equal(S.defaultCountRanges(weaponCounts).boe.max,1);weaponCounts.items[0].selected=false;assert.equal(S.defaultCountRanges(weaponCounts).boe.max,1);
const socketCounts=character([item('head',{}, {boe:true,socketCount:2}),item('head'),item('gem',{}, {uniqueGroup:'diamond'})]);assert.equal(S.defaultCountRanges(socketCounts).boe.max,0);
const splitSets=character([item('head',{}, {set:true,setGroup:'A'}),item('head',{}, {set:true,setGroup:'B'}),item('shoulders',{}, {set:true,setGroup:'A'}),item('shoulders',{}, {set:true,setGroup:'B'})]);assert.deepEqual(S.defaultCountRanges(splitSets).tier,{min:1,max:2});
const requiredSet=character([item('head',{}, {set:true,setGroup:'A',socketCount:1}),item('head'),item('shoulders',{}, {set:true,setGroup:'A'}),item('gem',{}, {uniqueGroup:'diamond'})]);assert.deepEqual(S.defaultCountRanges(requiredSet).tier,{min:2,max:2});
console.log('PASS: exact default bounds versus 20 full enumerations, locks, sockets, gems, enchants, consumables, implicit range validation, reset and changed selection.');

// Socket bounds and sorting use total holes, including multiple holes per item.
const holes=character([item('head'),item('head',{}, {socket:true}),item('head',{}, {socket:true,socketCount:3}),item('finger',{}, {socketCount:10,locked:true}),item('finger',{}, {socketCount:10}),item('finger')]);
assert.deepEqual(S.defaultCountRanges(holes).sockets,{min:10,max:23});
for(const direction of ['asc','desc']){holes.sort.rules=[{type:'stat',stat:'sockets',direction}];const rows=all(holes);assert.equal(rows.length,6);const values=rows.map(r=>r.sockets);assert.deepEqual(values,[...values].sort((a,b)=>direction==='asc'?a-b:b-a));for(const row of rows)assert.equal(row.sortValues[0],row.sockets);}
holes.filters={counts:{sockets:{min:21,max:23}}};assert.deepEqual(all(holes).map(r=>r.sockets),[23,21]);
holes.filters={counts:{sockets:{min:20,max:20}}};assert.deepEqual(all(holes).map(r=>r.sockets),[20]);
holes.filters={counts:{sockets:{min:24}}};assert.equal(all(holes).length,0);
holes.filters={counts:{sockets:{min:2.5}}};assert.throws(()=>S.settings(holes),/整数/);
holes.filters={counts:{sockets:{min:4,max:3}}};assert.throws(()=>S.settings(holes),/最少孔数/);
holes.filters={};assert.deepEqual(S.settings(holes).counts.sockets,{min:10,max:23});
assert.deepEqual(S.defaultCountRanges(socketCounts).sockets,{min:0,max:0});
assert.deepEqual(S.defaultCountRanges(requiredSet).sockets,{min:1,max:1});
for(let seed=0;seed<10;seed++){const c=character([item('main_hand',{}, {weaponType:'sword2h_3.60speed',socketCount:seed%3}),item('main_hand',{}, {weaponType:'sword_2.60speed',socketCount:1}),item('off_hand',{}, {socketCount:2}),item('head',{}, {socketCount:1}),item('head',{}, {socketCount:3}),item('gem')]);const rows=all(c);assert.deepEqual(S.defaultCountRanges(c).sockets,{min:Math.min(...rows.map(r=>r.sockets)),max:Math.max(...rows.map(r=>r.sockets))});}
console.log('PASS: socket range defaults, exact filtering, asc/desc sorting, multi-hole gear, locks, weapons and gem constraints.');
