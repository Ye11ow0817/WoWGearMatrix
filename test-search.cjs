const assert=require('node:assert/strict'),M=require('./model.js'),S=require('./search.js');
const zeros=()=>Object.fromEntries(M.itemStats.map(([k])=>[k,0]));
const item=(slot,stats={},extra={})=>({id:M.id(),slot,name:slot,origin:'custom',selected:true,ilevel:300,mainType:'strength',stats:{...zeros(),...stats},socket:false,embellishment:false,set:false,...extra});
const character=items=>({id:M.id(),items,mainType:'strength',baseStats:{...zeros(),main:10},filters:{},sort:{},customSlots:[]});
function run(c){const task=S.createSearch(c);let n=0;while(!task.step(1000)){assert(++n<1000);}return task.snapshot();}
let c=character(Array.from({length:125},(_,n)=>item('head',{main:n,haste:125-n})));c.sort={rules:[{type:'stat',stat:'main',direction:'desc'}],limit:50};let r=run(c);assert.equal(r.visited,125n);assert.equal(r.matched,125n);assert.equal(r.rows.length,50);assert.equal(r.rows[0].stats.main,134);assert.equal(r.rows.at(-1).stats.main,85);
c.sort.rules[0].direction='asc';r=run(c);assert.equal(r.rows[0].stats.main,10);assert.equal(r.rows.at(-1).stats.main,59);
c.filters={ranges:{main:{min:20,max:30}}};r=run(c);assert.equal(r.matched,11n);assert.equal(r.rows[0].stats.main,20);assert.equal(r.rows.at(-1).stats.main,30);
c.filters={ranges:{main:{min:30,max:20}}};assert.throws(()=>run(c),/最低值/);c.filters={ranges:{crit:{max:0}}};assert.equal(run(c).matched,125n);delete c.baseStats.stamina;assert.throws(()=>run(c),/基础属性/);
const a=item('finger',{crit:1},{locked:true}),b=item('finger',{crit:2}),d=item('finger',{crit:3});c=character([a,b,d,item('head',{main:100},{socket:true,socketCount:2}),item('gem',{haste:7}),item('gem',{crit:5}),item('gem',{main:9},{uniqueGroup:'diamond'}),item('food',{main:50},{adaptiveMain:true}),item('food',{haste:58}),item('enchant',{mastery:20},{enchantSlot:'finger'}),item('enchant',{versatility:20},{enchantSlot:'finger'})]);
r=run(c);assert.equal(r.visited,M.combinationCount(c).total);assert.equal(r.visited,32n);assert.equal(r.matched,32n);for(const row of r.rows){assert(row.gear.includes(a.id));assert.equal(row.gems.reduce((n,g)=>n+g.count,0),2);assert(row.gems.some(g=>g.id===c.items[6].id));assert.equal(row.enchants.length,2);assert.equal(row.stats.mastery+row.stats.versatility,40);}
const pieces=['head','shoulders','chest','legs'].map((slot,n)=>item(slot,{main:10},{set:true,setId:n<2?100:200}));c=character(pieces);c.filters={tier:4};assert.equal(run(c).matched,0n);c.filters.tier=2;assert.equal(run(c).matched,1n);pieces.forEach(i=>i.setId=100);c.filters.tier=4;assert.equal(run(c).rows[0].tier,4);pieces[0].embellishment=true;c.filters.embellishment='0';assert.equal(run(c).matched,0n);c.filters.embellishment='1';assert.equal(run(c).matched,1n);pieces[0].setId=0;assert.throws(()=>run(c),/分组/);pieces.forEach(i=>i.setGroup='A');assert.equal(run(c).matched,1n);
c.filters={counts:{tier:{min:'4',max:'4'},embellishment:{min:'1',max:'1'},boe:{min:'0',max:'0'}}};assert.equal(run(c).matched,1n);pieces[0].boe=true;assert.equal(run(c).matched,0n);c.filters.counts.boe={min:'1',max:'2'};assert.equal(run(c).rows[0].boe,1);c.filters.counts.tier={max:'3'};assert.equal(run(c).matched,0n);c.filters.counts.tier={min:'5'};assert.equal(run(c).matched,0n);c.filters.counts.tier={min:'4',max:'2'};assert.throws(()=>run(c),/最少件数/);c.filters.counts.tier={min:'4.5'};assert.throws(()=>run(c),/整数/);
c=character([item('head'),item('gem',{main:3},{uniqueGroup:'diamond'})]);assert.equal(run(c).visited,0n);c.items[0].socketCount=4;assert.equal(run(c).visited,0n);c.items.pop();assert.equal(run(c).visited,1n);c.items.push(item('gem',{haste:5}));assert.equal(run(c).rows[0].stats.haste,20);
const selectedDiamond=item('gem',{main:9},{uniqueGroup:'diamond'});
c=character([item('head',{}, {socketCount:2}),selectedDiamond,item('gem',{haste:5}),item('gem',{crit:7},{uniqueGroup:'diamond',selected:false})]);
assert.equal(M.combinationCount(c).total,1n);assert.equal(run(c).visited,1n);assert.deepEqual(run(c).rows[0].gems.map(g=>g.id).sort(),[selectedDiamond.id,c.items[2].id].sort());
c.items[3].selected=true;assert.equal(M.combinationCount(c).total,2n);assert.equal(run(c).visited,2n);assert(run(c).rows.every(row=>row.gems.filter(g=>g.id===selectedDiamond.id||g.id===c.items[3].id).length===1));
assert.deepEqual(S.defaultRanges(c).main,{min:run(c).rows.at(-1).stats.main,max:run(c).rows[0].stats.main});
c.alwaysUseDiamond=false;assert.equal(M.combinationCount(c).total,3n);assert.equal(run(c).visited,3n);assert(run(c).rows.some(row=>row.gems.every(g=>g.id!==selectedDiamond.id&&g.id!==c.items[3].id)));assert.deepEqual(S.defaultRanges(c).main,{min:10,max:19});
assert.equal(S.statsFor(c,item('enchant',{main:50},{supportedMainTypes:['intellect']})).main,0);assert.equal(S.statsFor(c,item('food',{main:50},{adaptiveMain:true,mainType:'intellect'})).main,50);
const twoHand=item('main_hand',{main:30},{weaponType:'sword2h_3.60speed'}),oneHand=item('main_hand',{main:10},{weaponType:'sword_2.60speed'}),offHand=item('off_hand',{main:5},{weaponType:'shield'});
c=character([twoHand,oneHand,offHand]);r=run(c);assert.equal(r.visited,2n);assert.equal(r.total,2n);assert.deepEqual(r.rows.map(row=>row.gear),[[twoHand.id],[oneHand.id,offHand.id]]);assert.deepEqual(S.defaultRanges(c).main,{min:25,max:40});
// Independent pair enumeration with range filters and stable ordering across ties.
for(let seed=0;seed<30;seed++){const rings=Array.from({length:5},(_,n)=>item('finger',{haste:(seed+n*3)%11}));c=character(rings);c.filters={ranges:{haste:{min:5,max:15}}};c.sort={rules:[{type:'stat',stat:'haste',direction:seed%2?'asc':'desc'}],limit:50};const expected=[];for(let x=0;x<5;x++)for(let y=x+1;y<5;y++){const haste=rings[x].stats.haste+rings[y].stats.haste;if(haste>=5&&haste<=15)expected.push(haste);}expected.sort((a,b)=>seed%2?a-b:b-a);assert.deepEqual(run(c).rows.map(r=>r.stats.haste),expected);}
const huge=character(Array.from({length:200},()=>item('head')));const task=S.createSearch(huge);assert.equal(task.step(1),false);assert.equal(task.snapshot().done,false);assert.equal(task.snapshot().rows.length,0);
const countSort=character([item('shoulders',{}, {set:true,setGroup:'A'}),item('head',{}, {id:'head-a',set:true,setGroup:'A',embellishment:true}),item('head',{}, {id:'head-b',set:true,setGroup:'B',boe:true}),item('head',{}, {id:'head-c'}),item('head',{}, {id:'head-d',embellishment:true,boe:true})]);
countSort.sort={rules:[{type:'stat',stat:'tier',direction:'desc'},{type:'stat',stat:'embellishments',direction:'asc'},{type:'stat',stat:'boe',direction:'desc'}],limit:50};
assert.deepEqual(run(countSort).rows.map(row=>row.gear.find(id=>id.startsWith('head-'))),['head-a','head-b','head-c','head-d']);
assert.deepEqual(run(countSort).rows[0].sortValues,[2,1,0]);
for(const [key,values]of [['tier',[2,1,1,1]],['embellishments',[1,1,0,0]],['boe',[1,1,0,0]]]){countSort.sort.rules=[{type:'stat',stat:key,direction:'desc'}];assert.deepEqual(run(countSort).rows.map(row=>row[key]),values);countSort.sort.rules[0].direction='asc';assert.deepEqual(run(countSort).rows.map(row=>row[key]),[...values].reverse());}
console.log('PASS: exact enumeration/count parity, top-K both directions, inclusive ranges, zero, locks, repeated gems, unique diamonds, per-item enchants, same-set grouping, embellishments, primary types and 30 independent pair fixtures.');

// Multi-level ordering is applied before top-K truncation, with an independent expected order.
const tiered=character(Array.from({length:160},(_,n)=>item('head',{main:n%4,haste:n%7,crit:(n*13)%29,mastery:n%11},{id:'gear-'+String(n).padStart(3,'0')})));
tiered.sort={rules:[{type:'stat',stat:'main',direction:'desc'},{type:'stat',stat:'haste',direction:'asc'},{type:'formula',left:'crit',operator:'-',right:'mastery',direction:'desc'}],limit:50};
const expectedTiered=[...tiered.items].sort((a,b)=>b.stats.main-a.stats.main||a.stats.haste-b.stats.haste||(b.stats.crit-b.stats.mastery)-(a.stats.crit-a.stats.mastery)||(a.id<b.id?-1:1)).slice(0,50).map(i=>i.id);
assert.deepEqual(run(tiered).rows.map(r=>r.gear[0]),expectedTiered);
tiered.items.reverse();assert.deepEqual(run(tiered).rows.map(r=>r.gear[0]),expectedTiered);
const ties=character(Array.from({length:100},(_,n)=>item('head',{}, {id:'tie-'+String(n).padStart(3,'0')})));ties.sort={rules:[],limit:50};
const stable=run(ties).rows.map(r=>r.combinationId);ties.items.reverse();assert.deepEqual(run(ties).rows.map(r=>r.combinationId),stable);
const composite={gear:['b','a'],gems:[{id:'g2',count:2},{id:'g1',count:1}],consumables:['f','c'],enchants:[{target:'b',id:'e2'},{target:'a',id:'e1'}]};
const shuffled={gear:[...composite.gear].reverse(),gems:[...composite.gems].reverse(),consumables:[...composite.consumables].reverse(),enchants:[...composite.enchants].reverse()};
assert.equal(S.combinationId(composite),S.combinationId(shuffled));
shuffled.enchants[0]={target:'b',id:'e1'};assert.notEqual(S.combinationId(composite),S.combinationId(shuffled));
for(const [operator,expected]of [['+',10],['-',6],['*',16],['/',4]])assert.equal(S.ruleValue({type:'formula',left:'crit',operator,right:'mastery'},{crit:8,mastery:2}),expected);
const ratios=character([item('head',{crit:8,mastery:0},{id:'invalid'}),item('head',{crit:8,mastery:2},{id:'four'}),item('head',{crit:6,mastery:3},{id:'two'})]);
for(const direction of ['asc','desc']){ratios.sort={rules:[{type:'formula',left:'crit',operator:'/',right:'mastery',direction}],limit:50};const ids=run(ratios).rows.map(r=>r.gear[0]);assert.deepEqual(ids,direction==='asc'?['two','four','invalid']:['four','two','invalid']);}
for(const rules of [null,{},[{type:'stat',stat:'unknown',direction:'desc'}],[{type:'formula',left:'crit',operator:'eval',right:'mastery',direction:'desc'}]])assert.throws(()=>S.validateRules(rules));
console.log('PASS: multi-rule top-K, mixed directions, four formula operators, zero divisor, canonical ties across input order and invalid rules.');
