(function(root){
'use strict';
const M=typeof module!=='undefined'?require('./model.js'):root.GearModel;
const Rating=typeof module!=='undefined'?require('./rating.js'):root.RatingConversion;
const comparisonOperators=['>','>=','<','<=','='];
const keys=M.itemStats.map(([k])=>k),sortKeys=[...keys,'sockets','tier','embellishments','boe'],zero=()=>Object.fromEntries(keys.map(k=>[k,0]));
const operators=['+','-','*','/'];
const names=Object.fromEntries(M.itemStats.map(([key,label])=>[label,key]));
Object.assign(names,{力量:'main',敏捷:'main',智力:'main',主属性:'main'});
function parseFormula(source){
 const value=String(source||'').trim();if(!value||value.length>500)throw Error('公式须为 1–500 个字符');
 const tokens=[];let rest=value.replace(/（/g,'(').replace(/）/g,')');
 while(rest){const space=rest.match(/^\s+/);if(space){rest=rest.slice(space[0].length);continue;}
  const number=rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
  if(number){const numeric=Number(number[0]);if(!Number.isFinite(numeric))throw Error('公式数字超出范围');tokens.push({type:'number',value:numeric});rest=rest.slice(number[0].length);continue;}
  const name=Object.keys(names).sort((a,b)=>b.length-a.length).find(n=>rest.startsWith(n))||keys.find(k=>rest.startsWith(k));
  if(name){tokens.push({type:'stat',value:names[name]||name});rest=rest.slice(name.length);continue;}
  const op=rest[0];if('+-*/()＋−×÷xX'.includes(op)){tokens.push({type:'op',value:op==='＋'?'+':op==='−'?'-':op==='×'||op==='x'||op==='X'?'*':op==='÷'?'/':op});rest=rest.slice(1);continue;}
  throw Error('公式包含不支持的内容：'+rest.slice(0,12));
 }
 let pos=0;const peek=()=>tokens[pos]?.value;
 function primary(){const t=tokens[pos++];if(!t)throw Error('公式缺少数值或属性');if(t.type==='number'||t.type==='stat')return t;if(t.value==='('){const node=add();if(peek()!==')')throw Error('公式缺少右括号');pos++;return node;}if(t.value==='+'||t.value==='-')return {type:'unary',op:t.value,node:primary()};throw Error('公式运算位置无效');}
 function mul(){let node=primary();while(peek()==='*'||peek()==='/'){const op=tokens[pos++].value;node={type:'binary',op,left:node,right:primary()};}return node;}
 function add(){let node=mul();while(peek()==='+'||peek()==='-'){const op=tokens[pos++].value;node={type:'binary',op,left:node,right:mul()};}return node;}
 const ast=add();if(pos!==tokens.length)throw Error('公式末尾有多余内容');if(!tokens.some(t=>t.type==='stat'))throw Error('公式至少包含一个属性');return ast;
}
function formulaValue(ast,stats){if(ast.type==='number')return ast.value;if(ast.type==='stat')return stats[ast.value];if(ast.type==='unary')return (ast.op==='-'?-1:1)*formulaValue(ast.node,stats);const a=formulaValue(ast.left,stats),b=formulaValue(ast.right,stats);return ast.op==='+'?a+b:ast.op==='-'?a-b:ast.op==='*'?a*b:a/b;}
function sortRules(c){return c.sort?.rules??[{type:'stat',stat:'main',direction:'desc'}];}
function validateRules(rules,tagKeys=[]){
 if(!Array.isArray(rules))throw Error('排序规则格式无效');
 return rules.map((r,n)=>{
  if(!r||!['asc','desc'].includes(r.direction))throw Error(`第 ${n+1} 条排序方向无效`);
  if(r.type==='stat'&&(sortKeys.includes(r.stat)||tagKeys.includes(r.stat)))return {type:r.type,stat:r.stat,direction:r.direction};
  if(r.type==='formula'&&typeof r.expression==='string')return {type:r.type,expression:r.expression,direction:r.direction,ast:parseFormula(r.expression)};
  if(r.type==='formula'&&keys.includes(r.left)&&keys.includes(r.right)&&operators.includes(r.operator))return {type:r.type,left:r.left,operator:r.operator,right:r.right,direction:r.direction,ast:parseFormula(`${r.left}${r.operator}${r.right}`)};
  throw Error(`第 ${n+1} 条排序属性或公式无效`);
 });
}
function ruleValue(rule,stats){
 if(rule.type==='stat')return stats[rule.stat];
 const value=formulaValue(rule.ast||parseFormula(rule.expression||`${rule.left}${rule.operator}${rule.right}`),stats);
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
function validateComparisons(c){
 const rules=c.filters?.comparisons??[];
 if(!Array.isArray(rules))throw Error('属性比较规则格式无效');
 return rules.map((r,n)=>{
  const prefix=`第 ${n+1} 条属性比较：`;
  if(!r||!keys.includes(r.left)||!keys.includes(r.right))throw Error(prefix+'请选择两侧属性');
  if(!comparisonOperators.includes(r.operator))throw Error(prefix+'比较符无效');
  if(!['value','percent'].includes(r.unit))throw Error(prefix+'比较单位无效');
  if(r.unit==='percent'&&[r.left,r.right].some(k=>!Rating.keys.includes(k)||!Number.isFinite(Rating.toSheetPercent(c,k,c.baseStats?.[k]))))throw Error(prefix+'两侧属性须支持百分比且已填写基础百分比');
  return {left:r.left,operator:r.operator,right:r.right,unit:r.unit};
 });
}
function matchesComparison(c,rule,stats){
 const value=k=>rule.unit==='percent'?Rating.toSheetPercent(c,k,stats[k]):stats[k];
 const a=value(rule.left),b=value(rule.right);
 if(!Number.isFinite(a)||!Number.isFinite(b))return false;
 const equal=Math.abs(a-b)<=1e-9;
 return rule.operator==='>'?a>b&&!equal:rule.operator==='>='?a>b||equal:rule.operator==='<'?a<b&&!equal:rule.operator==='<='?a<b||equal:equal;
}
function settings(c,defaults=defaultRanges(c)){
 const ranges={};for(const [k,label]of M.itemStats){const r=c.filters?.ranges?.[k]||{};ranges[k]={};for(const bound of ['min','max']){let v=r[bound];if(v===undefined||v===null||v==='')v=defaults[k]?.[bound];if(v===undefined)continue;const n=Number(v);if(!Number.isFinite(n)||n<0||n>1e9)throw Error(label+'范围须为 0–10亿 的数值');ranges[k][bound]=n;}if(ranges[k].min>ranges[k].max)throw Error(label+'最低值不能大于最高值');}
 const countDefaults=defaults.countRanges??defaultCountRanges(c);
 const counts={};for(const [key,label]of [['sockets','孔'],['tier','套装'],['embellishment','美化'],['boe','BOE'],...M.tagColumns(c)]){
  const old=c.filters?.[key];const legacy=key==='tier'?(old==null||old===''||Number(old)===0?{}:{min:old}):(old==null||old===''?{}:{min:old,max:old});
  const range=c.filters?.counts?.[key]??legacy;counts[key]={...countDefaults[key]};
  for(const bound of ['min','max']){const value=range[bound];if(value===undefined||value===null||value==='')continue;const n=Number(value),maximum=key==='sockets'?1e9:16;if(!Number.isInteger(n)||n<0||n>maximum)throw Error(label+`数量须为 0–${maximum} 的整数`);counts[key][bound]=n;}
  if(range.min!==undefined&&range.min!==null&&range.min!==''&&range.max!==undefined&&range.max!==null&&range.max!==''&&counts[key].min>counts[key].max)throw Error(label+(key==='sockets'?'最少孔数不能大于最多孔数':'最少件数不能大于最多件数'));
 }
 const rules=validateRules(sortRules(c),M.tagColumns(c).map(([key])=>key)),limit=c.sort?.limit==='all'?Infinity:Number(c.sort?.limit||100);
 if(![50,100,500,Infinity].includes(limit))throw Error('展示数量无效');
 return {ranges,counts,rules,limit,comparisons:validateComparisons(c)};
}
const tierGroup=i=>i.setGroup?.trim()||(i.setId>0?String(i.setId):'');
function defaultCountRanges(c){
 const empty={sockets:{min:0,max:0},tier:{min:0,max:0},embellishment:{min:0,max:0},boe:{min:0,max:0},...Object.fromEntries(M.tagColumns(c).map(([key])=>[key,{min:0,max:0}]))};
 if(!M.combinationCount(c).total)return empty;
 const hasMain=c.items.some(i=>i.slot==='main_hand'&&i.selected),groups=M.getSlots(c).filter(([slot])=>M.detailSlot(slot)&&!(hasMain&&slot==='off_hand'));
 const gems=c.items.filter(i=>i.slot==='gem'&&i.selected),ordinary=gems.some(i=>!i.uniqueGroup),unique=gems.some(i=>i.uniqueGroup),requireUnique=unique&&c.alwaysUseDiamond!==false;
 const feasible=s=>!gems.length||ordinary&&(!requireUnique||s>=1)||!ordinary&&unique&&(s===1||!requireUnique&&s===0);
 const sockets=i=>i.socketCount??(i.socket?1:0);
 const merge=(map,s,low,high)=>{const old=map.get(s);map.set(s,old?[Math.min(old[0],low),Math.max(old[1],high)]:[low,high]);};
 const statesFor=(matches,include=()=>true)=>{
  let states=new Map([[0,[0,0]]]);
  for(const [slot,,capacity]of groups){
   if(!include(slot))continue;
   const all=c.items.filter(i=>i.slot===slot);if(!all.length)continue;
   const selected=all.filter(i=>i.selected),take=Math.min(capacity,all.length);if(!selected.length)continue;
   const options=new Map();
   if(slot==='main_hand'){
    const off=c.items.filter(i=>i.slot==='off_hand'&&i.selected);
    for(const main of selected)for(const extra of M.twoHanded(main)||!off.length?[null]:off){const score=Number(!!matches(main))+(extra?Number(!!matches(extra)):0);merge(options,sockets(main)+(extra?sockets(extra):0),score,score);}
   }else{
    const locks=selected.filter(i=>i.locked),remaining=take-locks.length;
    if(remaining<0)return 0;
    const dp=Array.from({length:remaining+1},()=>new Map());dp[0].set(0,[0,0]);
    for(const i of selected.filter(i=>!i.locked))for(let n=remaining;n>=1;n--)for(const [s,[low,high]]of dp[n-1]){const score=Number(!!matches(i));merge(dp[n],s+sockets(i),low+score,high+score);}
    const baseSockets=locks.reduce((n,i)=>n+sockets(i),0),baseValue=locks.reduce((n,i)=>n+Number(!!matches(i)),0);
    for(const [s,[low,high]]of dp[remaining])merge(options,s+baseSockets,low+baseValue,high+baseValue);
   }
   if(!options.size)return new Map();
   const next=new Map();for(const [a,[low,high]]of states)for(const [b,[lo,hi]]of options)merge(next,a+b,low+lo,high+hi);states=next;
  }
  return states;
 };
 const extremesFor=matches=>{const values=[...statesFor(matches)].filter(([s])=>feasible(s)).map(([,value])=>value);return values.length?{min:Math.min(...values.map(v=>v[0])),max:Math.max(...values.map(v=>v[1]))}:{min:0,max:0};};
 const tierGroups=groups.filter(([slot])=>c.items.some(i=>i.selected&&i.set&&(i.slot===slot||hasMain&&slot==='main_hand'&&i.slot==='off_hand')));
 const tierGroupSlots=new Set(tierGroups.map(([slot])=>slot));
 const otherSockets=[...statesFor(()=>false,slot=>!tierGroupSlots.has(slot)).keys()];
 const choices=tierGroups.map(([slot,,capacity])=>{
  const all=c.items.filter(i=>i.slot===slot),items=all.filter(i=>i.selected),take=Math.min(capacity,all.length),unique=new Map();
  for(const picked of physical(c,[{items,take}])){
   const counts=new Map();for(const i of picked)if(i.set){const key=tierGroup(i)||'unknown:'+i.id;counts.set(key,(counts.get(key)||0)+1);}
   const groups=[...counts].sort(([a],[b])=>a.localeCompare(b)),s=picked.reduce((n,i)=>n+sockets(i),0);unique.set(JSON.stringify([groups,s]),{groups,s});
  }
  return [...unique.values()];
 }).sort((a,b)=>a.length-b.length);
 let tierMin=Infinity;const used=new Map();
 const visit=(index,s,currentMax)=>{if(currentMax>=tierMin)return;if(index===choices.length){if(otherSockets.some(other=>feasible(s+other)))tierMin=currentMax;return;}for(const choice of choices[index]){const previous=choice.groups.map(([key,count])=>[key,used.get(key)||0,count]);let nextMax=currentMax;for(const [key,old,count]of previous){used.set(key,old+count);nextMax=Math.max(nextMax,old+count);}visit(index+1,s+choice.s,nextMax);for(const [key,old]of previous){if(old)used.set(key,old);else used.delete(key);}if(tierMin===0)return;}};
 visit(0,0,0);
 const setGroups=new Set(c.items.filter(i=>i.selected&&i.set&&M.detailSlot(i.slot)).map(i=>tierGroup(i)||'unknown:'+i.id));
 const attainableSockets=[...statesFor(()=>false).keys()].filter(feasible);
 return {sockets:attainableSockets.length?{min:Math.min(...attainableSockets),max:Math.max(...attainableSockets)}:empty.sockets,tier:{min:Number.isFinite(tierMin)?tierMin:0,max:Math.max(0,...[...setGroups].map(group=>extremesFor(i=>i.set&&M.detailSlot(i.slot)&&(tierGroup(i)||'unknown:'+i.id)===group).max))},embellishment:extremesFor(i=>i.embellishment),boe:extremesFor(i=>i.boe),...Object.fromEntries(M.tagColumns(c).map(([key,name])=>[key,extremesFor(i=>i.customTags?.includes(name))]))};
}
function validate(c){
 const config=settings(c);
 const missing=M.itemStats.filter(([k])=>!Number.isFinite(c.baseStats?.[k]));if(missing.length)throw Error('请先填写基础属性：'+missing.map(([,n])=>n).join('、')+'（为零也请填 0）');
 const bad=c.items.find(i=>i.selected&&i.unresolved);if(bad)throw Error('请先补全属性：'+bad.name);
 if((config.counts.tier.min!==undefined||config.counts.tier.max!==undefined)&&c.items.some(i=>i.selected&&i.set&&M.detailSlot(i.slot)&&!tierGroup(i)))throw Error('请为套装项目填写套装编号或分组，再使用套装筛选');
 return config;
}
function statsFor(c,i){const out={...zero(),...i.stats};if(i.supportedMainTypes?.length?!i.supportedMainTypes.includes(c.mainType):!i.adaptiveMain&&i.mainType!==c.mainType)out.main=0;return out;}
// Exact attainable bounds for each individual attribute, including mandatory picks and socket counts.
function defaultRanges(c){
 const result={},rawBounds={};if(!M.combinationCount(c).total)return result;
 const hasMain=c.items.some(i=>i.slot==='main_hand'&&i.selected);
 const groups=M.getSlots(c).filter(([k])=>M.detailSlot(k)&&!(hasMain&&k==='off_hand')).map(([slot,,cap])=>{const all=c.items.filter(i=>i.slot===slot);return {slot,items:all.filter(i=>i.selected),take:Math.min(cap,all.length)};}).filter(g=>g.take&&g.items.length);
 const gems=c.items.filter(i=>i.slot==='gem'&&i.selected),fixed=new Map(c.items.map(i=>[i.id,statsFor(c,i)]));
 const enchants=new Map(c.items.filter(i=>M.detailSlot(i.slot)).map(i=>[i.id,M.enchantPool(c,i)]));
 const merge=(out,key,lo,hi)=>{const old=out.get(key);out.set(key,old?[Math.min(old[0],lo),Math.max(old[1],hi)]:[lo,hi]);};
 const combine=(a,b)=>{const out=new Map();for(const [x,[lo,hi]]of a)for(const [y,[low,high]]of b)merge(out,x+y,lo+low,hi+high);return out;};
 for(const k of keys){
  if(!Number.isFinite(c.baseStats?.[k]))continue;
  let gear=new Map([[0,[0,0]]]);
  for(const g of groups){
   const locks=g.items.filter(i=>i.locked),others=g.items.filter(i=>!i.locked),remaining=g.take-locks.length;
   const singleBound=i=>{const values=(enchants.get(i.id)||[]).map(e=>fixed.get(e.id)[k]);return new Map([[i.socketCount??(i.socket?1:0),[fixed.get(i.id)[k]+(values.length?Math.min(...values):0),fixed.get(i.id)[k]+(values.length?Math.max(...values):0)]]]);};
   const itemBound=i=>{const bound=singleBound(i),off=i.slot==='main_hand'&&!M.twoHanded(i)?c.items.filter(x=>x.slot==='off_hand'&&x.selected):[];if(!off.length)return bound;const out=new Map();for(const x of off)for(const [s,[lo,hi]]of combine(bound,singleBound(x)))merge(out,s,lo,hi);return out;};
   let mandatory=new Map([[0,[0,0]]]);for(const i of locks)mandatory=combine(mandatory,itemBound(i));
   const dp=Array.from({length:remaining+1},()=>new Map());dp[0].set(0,[0,0]);
   for(const i of others)for(let n=remaining;n>=1;n--){for(const [s,[lo,hi]]of combine(dp[n-1],itemBound(i)))merge(dp[n],s,lo,hi);}
   gear=combine(gear,combine(mandatory,dp[remaining]));
  }
  const ordinary=gems.filter(i=>!i.uniqueGroup).map(i=>fixed.get(i.id)[k]),diamonds=gems.filter(i=>i.uniqueGroup).map(i=>fixed.get(i.id)[k]);
  const uniques=diamonds.length?new Map(c.alwaysUseDiamond===false?[[0,[0,0]],[1,[Math.min(...diamonds),Math.max(...diamonds)]]]:[[1,[Math.min(...diamonds),Math.max(...diamonds)]]]):new Map([[0,[0,0]]]);
  let min=Infinity,max=-Infinity;
  for(const [s,[lo,hi]]of gear){
   if(!gems.length){min=Math.min(min,lo);max=Math.max(max,hi);continue;}
   for(const [used,[low,high]]of uniques){const left=s-used;if(left<0||left&&!ordinary.length)continue;min=Math.min(min,lo+low+(left?left*Math.min(...ordinary):0));max=Math.max(max,hi+high+(left?left*Math.max(...ordinary):0));}
  }
  let lower=c.baseStats[k],upper=lower;
  for(const [slot]of M.getSlots(c).filter(([slot])=>M.usageSlot(slot)&&!M.detailSlot(slot)&&!['gem','enchant'].includes(slot))){const values=c.items.filter(i=>i.slot===slot&&i.selected).map(i=>fixed.get(i.id)[k]);if(values.length){lower+=Math.min(...values);upper+=Math.max(...values);}}
  if(Number.isFinite(min)){
   rawBounds[k]={min:min+lower-c.baseStats[k],max:max+upper-c.baseStats[k]};
   result[k]={min:M.scaledStat(c,k,rawBounds[k].min),max:M.scaledStat(c,k,rawBounds[k].max)};
  }
 }
 // Cross-attribute passives couple armor and Strength. Independent extrema
 // provide safe automatic bounds even when the minimizing gear differs.
 if(c.attributeContext?.class==='warrior'&&rawBounds.main&&rawBounds.armor){
  const low=M.scaledStats(c,{main:rawBounds.main.min,armor:rawBounds.armor.min});
  const high=M.scaledStats(c,{main:rawBounds.main.max,armor:rawBounds.armor.max});
  result.main={min:low.main,max:high.main};result.armor={min:low.armor,max:high.armor};
 }
 if(c.attributeContext?.class==='demon_hunter'&&c.attributeContext?.spec==='vengeance'&&rawBounds.main&&rawBounds.mastery&&rawBounds.armor){
  const low=M.scaledStats(c,{main:rawBounds.main.min,mastery:rawBounds.mastery.min,armor:rawBounds.armor.min});
  const high=M.scaledStats(c,{main:rawBounds.main.max,mastery:rawBounds.mastery.max,armor:rawBounds.armor.max});
  result.armor={min:Math.min(low.armor,high.armor),max:Math.max(low.armor,high.armor)};
 }
 if(c.attributeContext?.class==='hunter'&&c.attributeContext?.spec==='survival'&&rawBounds.main&&c.traits?.some(t=>t.id===126332&&t.enabled)){
  result.main.max=Math.max(result.main.max,M.scaledStats(c,{main:rawBounds.main.max},{dualWield:true}).main);
 }
 return result;
}

function* choose(items,take,start=0,picked=[]){if(!take){yield picked;return;}for(let n=start;n<=items.length-take;n++)yield* choose(items,take-1,n+1,[...picked,items[n]]);}
function* physical(c,groups,index=0,chosen=[]){if(index===groups.length){const main=chosen.find(i=>i.slot==='main_hand'),off=c.items.filter(i=>i.slot==='off_hand'&&i.selected);if(main&&!M.twoHanded(main)&&off.length){for(const item of off)yield [...chosen,item];}else yield chosen;return;}const {items,take}=groups[index],locks=items.filter(i=>i.locked);for(const rest of choose(items.filter(i=>!i.locked),take-locks.length))yield* physical(c,groups,index+1,[...chosen,...locks,...rest]);}
function* gemOptions(gems,left,requireDiamond,target=0,index=0,used=new Set(),chosen=[],colors=new Set()){
 if(!gems.length){yield [];return;}
 if(colors.size+left<target||new Set([...colors,...gems.slice(index).map(M.gemColor).filter(Boolean)]).size<target)return;
 if(index===gems.length){if(left===0&&(!requireDiamond||used.size)&&colors.size>=target)yield chosen;return;}
 const g=gems[index],max=g.uniqueGroup?(used.size?0:Math.min(1,left)):left;
 for(let n=0;n<=max;n++){const next=new Set(used);if(n&&g.uniqueGroup)next.add(g.uniqueGroup);const nextColors=new Set(colors);if(n&&M.gemColor(g))nextColors.add(M.gemColor(g));yield* gemOptions(gems,left-n,requireDiamond,target,index+1,next,n?[...chosen,{id:g.id,count:n}]:chosen,nextColors);}
}
function* products(groups,index=0,chosen=[]){if(index===groups.length){yield chosen;return;}for(const value of groups[index])yield* products(groups,index+1,[...chosen,value]);}
function* combinations(c){
 const hasMain=c.items.some(i=>i.slot==='main_hand'&&i.selected);
 const groups=[];for(const [slot,,cap]of M.getSlots(c).filter(([k])=>M.detailSlot(k)&&!(hasMain&&k==='off_hand'))){const all=c.items.filter(i=>i.slot===slot);if(!all.length)continue;const items=all.filter(i=>i.selected);if(!items.length)continue;const take=Math.min(cap,all.length);if(items.length<take||items.filter(i=>i.locked).length>take)return;groups.push({items,take});}
 if(!groups.length)return;
 const gems=c.items.filter(i=>i.slot==='gem'&&i.selected),usage=M.getSlots(c).filter(([k])=>M.usageSlot(k)&&!M.detailSlot(k)&&!['gem','enchant'].includes(k)).map(([k])=>c.items.filter(i=>i.slot===k&&i.selected)).filter(a=>a.length);
 for(const gear of physical(c,groups)){
  yield null; // Yield work even when a gear set has no feasible gem allocation.
  const socketCount=gear.reduce((n,i)=>n+(i.socketCount??(i.socket?1:0)),0);
  const enchantGroups=gear.map(i=>{const pool=M.enchantPool(c,i);return pool.length?pool.map(e=>({id:e.id,target:i.id})):[];}).filter(a=>a.length);
  const requireDiamond=c.alwaysUseDiamond!==false&&gems.some(i=>i.uniqueGroup);
  for(const gem of gemOptions(gems,socketCount,requireDiamond,c.onlyMaxGemColors&&M.maxGemColorsAvailable(c)?M.maxGemColors(gems,socketCount,requireDiamond):0))for(const consumables of products(usage))for(const enchants of products(enchantGroups))yield {gear:gear.filter(i=>!i.slot.startsWith('custom_')).map(i=>i.id),gems:gem,consumables:[...consumables,...gear.filter(i=>i.slot.startsWith('custom_'))].map(i=>i.id),enchants,sockets:socketCount};
 }
}
class TopRows{
 constructor(limit,compare){this.rows=[];this.limit=limit;this.compare=compare;}
 add(row){const a=this.rows,cmp=this.compare;if(this.limit===Infinity){a.push(row);return;}if(a.length<this.limit){a.push(row);let i=a.length-1;while(i){const p=(i-1)>>1;if(cmp(a[i],a[p])<=0)break;[a[i],a[p]]=[a[p],a[i]];i=p;}return;}
 if(cmp(row,a[0])>=0)return;a[0]=row;let i=0;while(true){let j=i*2+1;if(j>=a.length)break;if(j+1<a.length&&cmp(a[j+1],a[j])>0)j++;if(cmp(a[i],a[j])>=0)break;[a[i],a[j]]=[a[j],a[i]];i=j;}}
 sorted(){return [...this.rows].sort(this.compare);}
}
function createSearch(c){
 const tagColumns=M.tagColumns(c),config=validate(c),count=M.combinationCount(c),byId=new Map(c.items.map(i=>[i.id,i])),fixed=new Map(c.items.map(i=>[i.id,statsFor(c,i)]));
 const compare=(a,b)=>compareRows(config.rules,a,b);
 const top=new TopRows(config.limit,compare),iterator=count.total?combinations(c):[][Symbol.iterator]();let visited=0n,matched=0n,done=false;
 function evaluate(combo){const total={...c.baseStats},sets=new Map(),tagCounts=Object.fromEntries(tagColumns.map(([key])=>[key,0]));let embellishments=0,boe=0;
  const add=(id,n=1)=>{for(const k of keys)total[k]+=fixed.get(id)[k]*n;};
  for(const id of [...combo.gear,...combo.consumables.filter(id=>M.detailSlot(byId.get(id).slot))]){const i=byId.get(id);if(combo.gear.includes(id))add(id);if(i.embellishment)embellishments++;if(i.boe)boe++;if(i.set&&M.detailSlot(i.slot)){const group=tierGroup(i)||'unknown:'+id;sets.set(group,(sets.get(group)||0)+1);}}
  for(const id of [...combo.gear,...combo.consumables.filter(id=>M.detailSlot(byId.get(id).slot))])for(const name of new Set(byId.get(id).customTags||[])){const key=M.tagKey(name);if(key in tagCounts)tagCounts[key]++;}
  for(const id of combo.consumables)add(id);for(const g of combo.gems)add(g.id,g.count);for(const e of combo.enchants)add(e.id);
  const weapon=id=>{const item=byId.get(id);return item&&['main_hand','off_hand'].includes(item.slot)&&!/none|shield|2h/.test(item.weaponType||'');};
  const dualWield=combo.gear.filter(weapon).length===2;
  Object.assign(total,M.scaledStats(c,Object.fromEntries(keys.map(k=>[k,total[k]-c.baseStats[k]])),{dualWield}));
  const tier=Math.max(0,...sets.values()),counts={sockets:combo.sockets,tier,embellishment:embellishments,boe,...tagCounts};
  for(const [key,value]of Object.entries(counts)){const range=config.counts[key];if(range.min!==undefined&&value<range.min||range.max!==undefined&&value>range.max)return;}
  for(const k of keys){const r=config.ranges[k];if(r.min!==undefined&&total[k]<r.min||r.max!==undefined&&total[k]>r.max)return;}
  if(!config.comparisons.every(rule=>matchesComparison(c,rule,total)))return;
  const sortContext={...total,sockets:combo.sockets,tier,embellishments,boe,...tagCounts};
  matched++;top.add({...combo,stats:total,tier,sets:[...sets],embellishments,boe,tagCounts,index:visited,sortValues:config.rules.map(r=>ruleValue(r,sortContext)),combinationId:combinationId(combo)});
 }
 return {step(budget=1000){for(let n=0;n<budget&&!done;n++){const next=iterator.next();if(next.done){done=true;break;}if(next.value){visited++;evaluate(next.value);}}return done;},snapshot(){return {done,visited,matched,total:count.total,missing:count.missing,rows:top.sorted()};}};
}
const api={validateComparisons,sortRules,validateRules,parseFormula,ruleValue,combinationId,compareRows,defaultRanges,defaultCountRanges,settings,validate,statsFor,tierGroup,combinations,createSearch};if(typeof module!=='undefined')module.exports=api;else root.GearSearch=api;
})(globalThis);
