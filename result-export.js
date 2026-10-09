(function(root){
'use strict';
const M=typeof module!=='undefined'?require('./model.js'):root.GearModel;
const Rating=typeof module!=='undefined'?require('./rating.js'):root.RatingConversion;
// Quote text cells and prevent user-provided names from becoming Excel formulas.
function csv(table){
 const cell=value=>{
  if(typeof value==='number')return Number.isFinite(value)?String(value):'';
  let text=String(value??'');
  if(text!=='-'&&(/^[\s\uFEFF]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text)))text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
 };
 return '\uFEFF'+table.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
function slotGroups(c){
 const expand=([key,label,capacity])=>Array.from({length:capacity},(_,n)=>[`slot:${key}:${n+1}`,capacity>1?label+(n+1):label]);
 const slots=M.getSlots(c),equipment=slots.filter(([key])=>!M.usageSlot(key)).flatMap(expand);
 const enchantTargets=new Set(M.enchantSlots.flatMap(([key])=>key==='weapon'?['main_hand','off_hand']:[key]));
 const enchants=slots.filter(([key])=>enchantTargets.has(key)).flatMap(([key,label,capacity])=>Array.from({length:capacity},(_,n)=>[`slot:enchant:${key}:${n+1}`,(capacity>1?label+(n+1):label)+'附魔']));
 const usage=slots.filter(([key])=>M.usageSlot(key)&&key!=='enchant').flatMap(expand);
 return {equipment,enchants,usage};
}
function slotColumns(c){const groups=slotGroups(c);return [...groups.equipment,...groups.enchants,...groups.usage];}
function defaultSlotColumns(c){
 const counts=new Map();for(const i of c.items)if(i.selected)counts.set(i.slot,(counts.get(i.slot)||0)+1);
 const capacities=new Map(M.getSlots(c).map(([key,,capacity])=>[key,capacity]));
 return slotGroups(c).equipment.filter(([key])=>{const slot=key.split(':')[1];return (counts.get(slot)||0)>capacities.get(slot);}).map(([key])=>key);
}
function orderedGems(c,row){
 const byId=new Map(c.items.map(i=>[i.id,i]));
 const diamond=g=>!!byId.get(g.id)?.uniqueGroup;
 return [...row.gems].sort((a,b)=>Number(diamond(b))-Number(diamond(a)));
}
function slotValues(c,row){
 const byId=new Map(c.items.map(i=>[i.id,i])),values={};
 const name=id=>byId.get(id)?.name||'未知项目';
 for(const [slot,,capacity]of M.getSlots(c)){
  const items=[...row.gear,...row.consumables].filter(id=>byId.get(id)?.slot===slot);
  for(let n=0;n<capacity;n++){values[`slot:${slot}:${n+1}`]=items[n]?name(items[n]):'';const enchant=row.enchants.find(e=>e.target===items[n]);values[`slot:enchant:${slot}:${n+1}`]=enchant?name(enchant.id):'';}
 }
 values['slot:gem:1']=orderedGems(c,row).map(g=>`${name(g.id)} × ${g.count}`).join('\n');
 return values;
}
function table(c,rows,columns,{all=true,percent=true}={}){
 // Export rating attributes and loadout details even when hidden in the UI.
 const selected=new Set(columns.map(([key])=>key));
 const ratingColumns=M.itemStats.filter(([key])=>Rating.keys.includes(key));
 const exportColumns=all?[...columns,...ratingColumns.filter(([key])=>!selected.has(key)),...slotColumns(c).filter(([key])=>!selected.has(key))]:columns;
 let defs=exportColumns.flatMap(([key,label,index])=>[[key,label,index],...(percent&&index===undefined&&Rating.keys.includes(key)?[[key,label+' (%)','percent']]:[])]);
 const secondary=['crit','haste','mastery','versatility'],tertiary=['avoidance','leech','speed'];
 const statOrder=[...secondary,...secondary.map(key=>key+':percent'),...tertiary,...tertiary.map(key=>key+':percent')];
 const rank=([key,,index])=>index===undefined||index==='percent'?statOrder.indexOf(key+(index==='percent'?':percent':'')):-1;
 const orderedStats=defs.filter(def=>rank(def)>=0).sort((a,b)=>rank(a)-rank(b));
 const firstStat=defs.findIndex(def=>rank(def)>=0);
 if(firstStat>=0){defs=defs.filter(def=>rank(def)<0);defs.splice(firstStat,0,...orderedStats);}
 return [['序号',...defs.map(([,label])=>label)],...rows.map((row,n)=>{
  const parts=slotValues(c,row);
  return [n+1,...defs.map(([key,,index])=>{
   if(key.startsWith('slot:'))return parts[key]||'-';
   if(index==='percent'){const value=Rating.toSheetPercent(c,key,row.stats[key]);return value===null?'':value.toFixed(2)+'%';}
   if(index!==undefined)return row.sortValues?.[index]??'';
   return key.startsWith('tag:')?row.tagCounts?.[key]??0:row.stats[key]??row[key]??0;
  })];
 })];
}
const api={csv,table,slotColumns,slotValues,slotGroups,defaultSlotColumns,orderedGems};if(typeof module!=='undefined')module.exports=api;else root.ResultExport=api;
})(typeof globalThis!=='undefined'?globalThis:this);
