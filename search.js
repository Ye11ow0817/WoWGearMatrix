(function(root){
'use strict';
const M=typeof module!=='undefined'?require('./model.js'):root.GearModel;
const keys=M.itemStats.map(([k])=>k),zero=()=>Object.fromEntries(keys.map(k=>[k,0]));
const operators=['+','-','*','/'];
function sortRules(c){return c.sort?.rules??[{type:'stat',stat:'main',direction:'desc'}];}
function validateRules(rules){
 if(!Array.isArray(rules))throw Error('排序规则格式无效');
 return rules.map((r,n)=>{
  if(!r||!['asc','desc'].includes(r.direction))throw Error(`第 ${n+1} 条排序方向无效`);
  if(r.type==='stat'&&keys.includes(r.stat))return {type:r.type,stat:r.stat,direction:r.direction};
  if(r.type==='formula'&&keys.includes(r.left)&&keys.includes(r.right)&&operators.includes(r.operator))return {type:r.type,left:r.left,operator:r.operator,right:r.right,direction:r.direction};
  throw Error(`第 ${n+1} 条排序属性或公式无效`);
 });
}
function ruleValue(rule,stats){
 if(rule.type==='stat')return stats[rule.stat];
 const a=stats[rule.left],b=stats[rule.right];
 const value=rule.operator==='+'?a+b:rule.operator==='-'?a-b:rule.operator==='*'?a*b:b===0?NaN:a/b;
 return Number.isFinite(value)?value:null;
}
// Canonical IDs do not depend on enumeration order, including ring pairs and gem allocations.
function combinationId(combo){
 const ordered=values=>values.map(v=>JSON.stringify(v)).sort();
 return JSON.stringify([ordered(combo.gear),ordered(combo.gems.map(g=>[g.id,g.count])),ordered(combo.consumables),ordered(combo.enchants.map(e=>[e.target,e.id]))]);
}
function compareRows(rules,a,b){
 for(let n=0;n<rules.length;n++){
  const x=a.sortValues[n],y=b.sortValues[n];
  if(x===null&&y!==null)return 1;if(y===null&&x!==null)return -1;
  if(x!==y)return (x<y?-1:1)*(rules[n].direction==='asc'?1:-1);
 }
 return a.combinationId<b.combinationId?-1:a.combinationId>b.combinationId?1:0;
}
function settings(c,defaults=defaultRanges(c)){
 const ranges={};for(const [k,label]of M.itemStats){const r=c.filters?.ranges?.[k]||{};ranges[k]={};for(const bound of ['min','max']){let v=r[bound];if(v===undefined||v===null||v==='')v=defaults[k]?.[bound];if(v===undefined)continue;const n=Number(v);if(!Number.isFinite(n)||n<0||n>1e9)throw Error(label+'范围须为 0–10亿 的数值');ranges[k][bound]=n;}if(ranges[k].min>ranges[k].max)throw Error(label+'最低值不能大于最高值');}
 const tier=Number(c.filters?.tier||0),embellishment=c.filters?.embellishment??'';
 if(![0,2,4].includes(tier))throw Error('套装条件无效');
 if(embellishment!==''&&(!Number.isInteger(Number(embellishment))||Number(embellishment)<0||Number(embellishment)>16))throw Error('美化数量须为 0–16 的整数');
 const rules=validateRules(sortRules(c)),limit=Number(c.sort?.limit||100);
 if(![50,100,500].includes(limit))throw Error('展示数量无效');
 return {ranges,tier,embellishment:embellishment===''?null:Number(embellishment),rules,limit};
}
const tierGroup=i=>i.setGroup?.trim()||(i.setId>0?String(i.setId):'');
function validate(c){
 const config=settings(c);
 const missing=M.itemStats.filter(([k])=>!Number.isFinite(c.baseStats?.[k]));if(missing.length)throw Error('请先填写基础属性：'+missing.map(([,n])=>n).join('、')+'（为零也请填 0）');
 const bad=c.items.find(i=>i.selected&&i.unresolved);if(bad)throw Error('请先补全属性：'+bad.name);
 if(config.tier&&c.items.some(i=>i.selected&&i.set&&M.tierSlots.includes(i.slot)&&!tierGroup(i)))throw Error('请为套装项目填写套装编号或分组，再使用套装筛选');
 return config;
}
function statsFor(c,i){const out={...zero(),...i.stats};if(i.supportedMainTypes?.length?!i.supportedMainTypes.includes(c.mainType):!i.adaptiveMain&&i.mainType!==c.mainType)out.main=0;return out;}
// Exact attainable bounds for each individual attribute, including mandatory picks and socket counts.
function defaultRanges(c){
 const result={};if(!M.combinationCount(c).total)return result;
 const groups=M.getSlots(c).filter(([k])=>!M.usageSlot(k)).map(([slot,,cap])=>{const all=c.items.filter(i=>i.slot===slot);return {slot,items:all.filter(i=>i.selected),take:Math.min(cap,all.length)};}).filter(g=>g.take&&!(g.slot==='off_hand'&&!g.items.length));
 const gems=c.items.filter(i=>i.slot==='gem'&&i.selected),fixed=new Map(c.items.map(i=>[i.id,statsFor(c,i)]));
 const enchants=new Map(c.items.filter(i=>!M.usageSlot(i.slot)).map(i=>[i.id,M.enchantPool(c,i)]));
 const merge=(out,key,lo,hi)=>{const old=out.get(key);out.set(key,old?[Math.min(old[0],lo),Math.max(old[1],hi)]:[lo,hi]);};
 const combine=(a,b)=>{const out=new Map();for(const [x,[lo,hi]]of a)for(const [y,[low,high]]of b)merge(out,x+y,lo+low,hi+high);return out;};
 for(const k of keys){
  if(!Number.isFinite(c.baseStats?.[k]))continue;
  let gear=new Map([[0,[0,0]]]);
  for(const g of groups){
   const locks=g.items.filter(i=>i.locked),others=g.items.filter(i=>!i.locked),remaining=g.take-locks.length;
   const itemBound=i=>{const values=(enchants.get(i.id)||[]).map(e=>fixed.get(e.id)[k]);return new Map([[i.socketCount??(i.socket?1:0),[fixed.get(i.id)[k]+(values.length?Math.min(...values):0),fixed.get(i.id)[k]+(values.length?Math.max(...values):0)]]]);};
   let mandatory=new Map([[0,[0,0]]]);for(const i of locks)mandatory=combine(mandatory,itemBound(i));
   const dp=Array.from({length:remaining+1},()=>new Map());dp[0].set(0,[0,0]);
   for(const i of others)for(let n=remaining;n>=1;n--){for(const [s,[lo,hi]]of combine(dp[n-1],itemBound(i)))merge(dp[n],s,lo,hi);}
   gear=combine(gear,combine(mandatory,dp[remaining]));
  }
  const ordinary=gems.filter(i=>!i.uniqueGroup).map(i=>fixed.get(i.id)[k]),unique=new Map();
  for(const i of gems.filter(i=>i.uniqueGroup)){const a=unique.get(i.uniqueGroup)||[];a.push(fixed.get(i.id)[k]);unique.set(i.uniqueGroup,a);}
  let uniques=new Map([[0,[0,0]]]);for(const values of unique.values())uniques=combine(uniques,new Map([[0,[0,0]],[1,[Math.min(...values),Math.max(...values)]]]));
  let min=Infinity,max=-Infinity;
  for(const [s,[lo,hi]]of gear){
   if(!gems.length){min=Math.min(min,lo);max=Math.max(max,hi);continue;}
   for(const [used,[low,high]]of uniques){const left=s-used;if(left<0||left&&!ordinary.length)continue;min=Math.min(min,lo+low+(left?left*Math.min(...ordinary):0));max=Math.max(max,hi+high+(left?left*Math.max(...ordinary):0));}
  }
  let lower=c.baseStats[k],upper=lower;
  for(const [slot]of M.getSlots(c).filter(([slot])=>M.usageSlot(slot)&&!['gem','enchant'].includes(slot))){const values=c.items.filter(i=>i.slot===slot&&i.selected).map(i=>fixed.get(i.id)[k]);if(values.length){lower+=Math.min(...values);upper+=Math.max(...values);}}
  if(Number.isFinite(min))result[k]={min:min+lower,max:max+upper};
 }
 return result;
}

function* choose(items,take,start=0,picked=[]){if(!take){yield picked;return;}for(let n=start;n<=items.length-take;n++)yield* choose(items,take-1,n+1,[...picked,items[n]]);}
function* physical(c,groups,index=0,chosen=[]){if(index===groups.length){yield chosen;return;}const {items,take}=groups[index],locks=items.filter(i=>i.locked);for(const rest of choose(items.filter(i=>!i.locked),take-locks.length))yield* physical(c,groups,index+1,[...chosen,...locks,...rest]);}
function* gemOptions(gems,left,index=0,used=new Set(),chosen=[]){
 if(!gems.length){yield [];return;}
 if(index===gems.length){if(left===0)yield chosen;return;}
 const g=gems[index],max=g.uniqueGroup?(used.has(g.uniqueGroup)?0:Math.min(1,left)):left;
 for(let n=0;n<=max;n++){const next=new Set(used);if(n&&g.uniqueGroup)next.add(g.uniqueGroup);yield* gemOptions(gems,left-n,index+1,next,n?[...chosen,{id:g.id,count:n}]:chosen);}
}
function* products(groups,index=0,chosen=[]){if(index===groups.length){yield chosen;return;}for(const value of groups[index])yield* products(groups,index+1,[...chosen,value]);}
function* combinations(c){
 const groups=[];for(const [slot,,cap]of M.getSlots(c).filter(([k])=>!M.usageSlot(k))){const all=c.items.filter(i=>i.slot===slot);if(!all.length)continue;const items=all.filter(i=>i.selected);if(slot==='off_hand'&&!items.length)continue;const take=Math.min(cap,all.length);if(items.length<take||items.filter(i=>i.locked).length>take)return;groups.push({items,take});}
 if(!groups.length)return;
 const gems=c.items.filter(i=>i.slot==='gem'&&i.selected),usage=M.getSlots(c).filter(([k])=>M.usageSlot(k)&&!['gem','enchant'].includes(k)).map(([k])=>c.items.filter(i=>i.slot===k&&i.selected)).filter(a=>a.length);
 for(const gear of physical(c,groups)){
  yield null; // Yield work even when a gear set has no feasible gem allocation.
  const socketCount=gear.reduce((n,i)=>n+(i.socketCount??(i.socket?1:0)),0);
  const enchantGroups=gear.map(i=>{const pool=M.enchantPool(c,i);return pool.length?pool.map(e=>({id:e.id,target:i.id})):[];}).filter(a=>a.length);
  for(const gem of gemOptions(gems,socketCount))for(const consumables of products(usage))for(const enchants of products(enchantGroups))yield {gear:gear.map(i=>i.id),gems:gem,consumables:consumables.map(i=>i.id),enchants,sockets:socketCount};
 }
}
class TopRows{
 constructor(limit,compare){this.rows=[];this.limit=limit;this.compare=compare;}
 add(row){const a=this.rows,cmp=this.compare;if(a.length<this.limit){a.push(row);let i=a.length-1;while(i){const p=(i-1)>>1;if(cmp(a[i],a[p])<=0)break;[a[i],a[p]]=[a[p],a[i]];i=p;}return;}
 if(cmp(row,a[0])>=0)return;a[0]=row;let i=0;while(true){let j=i*2+1;if(j>=a.length)break;if(j+1<a.length&&cmp(a[j+1],a[j])>0)j++;if(cmp(a[i],a[j])>=0)break;[a[i],a[j]]=[a[j],a[i]];i=j;}}
 sorted(){return [...this.rows].sort(this.compare);}
}
function createSearch(c){
 const config=validate(c),count=M.combinationCount(c),byId=new Map(c.items.map(i=>[i.id,i])),fixed=new Map(c.items.map(i=>[i.id,statsFor(c,i)]));
 const compare=(a,b)=>compareRows(config.rules,a,b);
 const top=new TopRows(config.limit,compare),iterator=count.total?combinations(c):[][Symbol.iterator]();let visited=0n,matched=0n,done=false;
 function evaluate(combo){const total={...c.baseStats},sets=new Map();let embellishments=0;
  const add=(id,n=1)=>{for(const k of keys)total[k]+=fixed.get(id)[k]*n;};
  for(const id of combo.gear){const i=byId.get(id);add(id);if(i.embellishment)embellishments++;if(i.set&&M.tierSlots.includes(i.slot)){const group=tierGroup(i)||'unknown:'+id;sets.set(group,(sets.get(group)||0)+1);}}
  for(const id of combo.consumables)add(id);for(const g of combo.gems)add(g.id,g.count);for(const e of combo.enchants)add(e.id);
  const tier=Math.max(0,...sets.values());if(tier<config.tier||(config.embellishment!==null&&embellishments!==config.embellishment))return;
  for(const k of keys){const r=config.ranges[k];if(r.min!==undefined&&total[k]<r.min||r.max!==undefined&&total[k]>r.max)return;}
  matched++;top.add({...combo,stats:total,tier,sets:[...sets],embellishments,index:visited,sortValues:config.rules.map(r=>ruleValue(r,total)),combinationId:combinationId(combo)});
 }
 return {step(budget=1000){for(let n=0;n<budget&&!done;n++){const next=iterator.next();if(next.done){done=true;break;}if(next.value){visited++;evaluate(next.value);}}return done;},snapshot(){return {done,visited,matched,total:count.total,missing:count.missing,rows:top.sorted()};}};
}
const api={sortRules,validateRules,ruleValue,combinationId,compareRows,defaultRanges,settings,validate,statsFor,tierGroup,combinations,createSearch};if(typeof module!=='undefined')module.exports=api;else root.GearSearch=api;
})(globalThis);
