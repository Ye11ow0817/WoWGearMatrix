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
console.log('PASS: exact default bounds versus 20 full enumerations, locks, sockets, gems, enchants, consumables, implicit range validation, reset and changed selection.');
