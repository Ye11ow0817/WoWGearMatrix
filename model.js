(function (root) {
  'use strict';
  const slots = [['head','头',1],['neck','项链',1],['shoulders','肩',1],['back','背',1],['chest','胸',1],['wrists','手腕',1],['hands','手',1],['waist','腰',1],['legs','腿',1],['feet','脚',1],['finger','戒指',2],['trinket','饰品',2],['main_hand','主手',1],['off_hand','副手',1],['enchant','附魔',1],['gem','宝石',1],['food','食物',1],['flask','合剂',1]];
  const presets = typeof module !== 'undefined' ? require('./presets.js') : root.GearPresets;
  const usageSlot = key => ['enchant','gem','food','flask'].includes(key) || key.startsWith('custom_');
  const stats = [['main','主属性'],['crit','暴击'],['haste','急速'],['mastery','精通'],['versatility','全能']];
  const itemStats=[['armor','护甲'],['stamina','耐力'],...stats,['avoidance','闪避'],['leech','吸血'],['speed','加速']];
  const tierSlots=['head','shoulders','chest','legs','hands'];
  const enchantSlots=[['head','头'],['shoulders','肩'],['chest','胸'],['legs','腿'],['feet','脚'],['finger','戒指'],['weapon','武器']];
  function displayStats(i){
    const secondary=stats.slice(1).sort((a,b)=>(i.stats[b[0]]||0)-(i.stats[a[0]]||0));
    return [...itemStats.slice(0,3),...secondary,...itemStats.slice(-3)].filter(([k])=>i.stats[k]);
  }
  function toggleLock(c,i){
    if(!['finger','trinket'].includes(i.slot))throw Error('只有戒指和饰品可以锁定');
    if(!i.locked&&c.items.filter(x=>x.slot===i.slot&&x.locked).length>=2)throw Error('每个栏位最多锁定 2 件，请先解锁其他项目');
    i.locked=!i.locked;if(i.locked)i.selected=true;
  }
  function toggleSelected(i){if(i.locked)throw Error('请先解锁，再取消候选');i.selected=!i.selected;}
  const types = { strength:'力量', agility:'敏捷', intellect:'智力' };
  const id = () => globalThis.crypto.randomUUID();
  const emptyStats = () => Object.fromEntries(stats.map(([k]) => [k, null]));
  const newCharacter = (name = '新角色') => ensurePresets({id:id(),name,renamed:false,input:'',report:'',items:[],customSlots:[],baseStats:emptyStats(),mainType:'strength',filters:{},sort:{},importInfo:''});
  const newState = () => { const c = newCharacter('角色 1'); return {version:2,activeId:c.id,characters:[c]}; };
  const getSlots=c=>[...slots,...(c.customSlots||[]).map(s=>[s.id,s.name,1])];
  function checkSlotName(c,name,exceptId){
    const value=String(name).trim();
    if(!value||value.length>40)throw Error('栏位名称须为 1–40 个字符');
    if(getSlots(c).some(([key,label])=>key!==exceptId&&label.toLowerCase()===value.toLowerCase()))throw Error('已有同名栏位');
    return value;
  }
  function addSlot(c,name){
    c.customSlots??=[];
    if(c.customSlots.length>=30)throw Error('每个角色最多新增 30 个自定义栏位');
    const entry={id:'custom_'+id(),name:checkSlotName(c,name)};c.customSlots.push(entry);return entry;
  }
  function renameSlot(c,key,name){
    const entry=c.customSlots?.find(s=>s.id===key);if(!entry)throw Error('只能修改自定义栏位名称');
    entry.name=checkSlotName(c,name,key);
  }
  function validateState(s) {
    if (!s || s.version !== 2 || !Array.isArray(s.characters) || !s.characters.length || s.characters.length > 100) throw Error('角色数据格式无效');
    const ids = new Set();
    for (const c of s.characters) {
      if (!c || typeof c.id !== 'string' || ids.has(c.id) || typeof c.name !== 'string' || !c.name.trim() || c.name.length > 80 || !Array.isArray(c.items) || c.items.length > 3000 || typeof c.input !== 'string' || typeof c.report !== 'string' || !types[c.mainType]) throw Error('角色数据损坏');
      ids.add(c.id);
      if(!Array.isArray(c.customSlots)||c.customSlots.length>30)throw Error('自定义栏位格式无效');
      const slotIds=new Set(),slotNames=new Set(slots.map(s=>s[1].toLowerCase()));
      for(const slot of c.customSlots){
        if(!slot||typeof slot.id!=='string'||!/^custom_[a-zA-Z0-9-]+$/.test(slot.id)||slotIds.has(slot.id)||typeof slot.name!=='string'||!slot.name.trim()||slot.name.length>40||slotNames.has(slot.name.trim().toLowerCase()))throw Error('自定义栏位名称或编号无效');
        slotIds.add(slot.id);slotNames.add(slot.name.trim().toLowerCase());
      }
      for(const [k]of stats)if(c.baseStats?.[k]!==null&&(!Number.isFinite(c.baseStats?.[k])||c.baseStats[k]<0||c.baseStats[k]>10000000))throw Error('基础属性格式无效');
      for(const [k]of itemStats)if(c.baseStats[k]!==undefined&&c.baseStats[k]!==null&&(!Number.isFinite(c.baseStats[k])||c.baseStats[k]<0||c.baseStats[k]>10000000))throw Error('基础属性格式无效');
      ensurePresets(c);
      if(c.items.length>3000)throw Error('每个角色最多保存 3000 个项目（含预设）');
      const items = new Set();
      for (const i of c.items) {
        if(!tierSlots.includes(i.slot)){i.set=false;i.setId=0;}
        if(i.setGroup!==undefined&&(typeof i.setGroup!=='string'||i.setGroup.length>80))throw Error('套装分组须为 80 字以内文本');
        i.stats={...zeroStats(),...i.stats};
        if(i.locked!==undefined&&typeof i.locked!=='boolean')throw Error('锁定状态无效');
        if(i.locked){if(!['finger','trinket'].includes(i.slot))throw Error('该栏位不支持锁定');i.selected=true;}
        if(i.slot==='enchant'&&!enchantSlots.some(([k])=>k===i.enchantSlot))throw Error('附魔部位无效');
        if(i.socketCount!==undefined&&(!Number.isInteger(i.socketCount)||i.socketCount<0||i.socketCount>10))throw Error('装备孔位数量须为 0–10 的整数');
        if(i.adaptiveMain!==undefined&&typeof i.adaptiveMain!=='boolean')throw Error('主属性类型无效');
        if(typeof i.selected!=='boolean')throw Error('装备选择状态无效');
        const slot = getSlots(c).find(([k]) => k === i.slot);
        if (!slot || typeof i.id !== 'string' || items.has(i.id) || typeof i.name !== 'string' || !i.name.trim() || i.name.length > 200 || !Number.isInteger(i.ilevel) || i.ilevel < 0 || i.ilevel > 10000 || !types[i.mainType] || !['import','custom'].includes(i.origin)) throw Error('装备数据格式无效');
        for (const flag of ['socket','embellishment','set']) if (typeof i[flag] !== 'boolean') throw Error('装备标记格式无效');
        for (const [k] of itemStats) if (!Number.isFinite(i.stats?.[k]) || i.stats[k] < 0 || i.stats[k] > 10000000) throw Error('装备属性格式无效');
        items.add(i.id);
      }
      for(const key of ['finger','trinket'])if(c.items.filter(i=>i.slot===key&&i.locked).length>2)throw Error('每个栏位最多锁定 2 件');
    }
    if (!ids.has(s.activeId)) throw Error('当前角色不存在');
    return s;
  }
  const slotKey = s => ({shoulder:'shoulders',wrist:'wrists',finger1:'finger',finger2:'finger',trinket1:'trinket',trinket2:'trinket'})[s] || s;
  function parseReport(report) {
    const character = report.match(/^Character: (.*?) \| (.*?)\/(.*?) \| level=(\d+)/m);
    const cls=character?.[2], spec=character?.[3];
    const mainType = ({warrior:'strength',death_knight:'strength',hunter:'agility',rogue:'agility',demon_hunter:'agility',mage:'intellect',priest:'intellect',warlock:'intellect',evoker:'intellect'})[cls] || (cls==='paladin' ? (spec==='holy'?'intellect':'strength') : cls==='shaman' ? (spec==='enhancement'?'agility':'intellect') : cls==='druid' ? (['feral','guardian'].includes(spec)?'agility':'intellect') : cls==='monk' ? (spec==='mistweaver'?'intellect':'agility') : 'strength');
    const result = {name:character?.[1] || '',attributeContext:{class:cls||'',spec:spec||'',level:Number(character?.[4]||0)},items:[],skipped:0,failed:0,warnings:[]};
    const blocks = report.split(/\n(?=\[\d+\] )/).slice(1);
    for (const block of blocks) {
      const header = block.match(/^\[\d+\] (.*?) \/ (\w+) \/ (.*)/);
      if (!header) continue;
      const slot = slotKey(header[2]);
      if (!slots.some(([k]) => k === slot)) { result.skipped++; continue; }
      const info = block.match(/^id=(\d+) \| (.*?) \| ilevel=([\d.]+)/m);
      const base = block.match(/^base_for_spec: (.*)/m);
      const flags = block.match(/^gear_flags: sockets=(\d+), set_id=(\d+), embellishment=([01])/m);
      if (!info || !base || !flags || /^ERROR:/m.test(block)) { result.failed++; continue; }
      const raw = Object.fromEntries([...base[1].matchAll(/(\w+)=(-?[\d.]+)/g)].map(m => [m[1],Number(m[2])]));
      const primary = mainType;
      result.items.push({id:id(),itemId:Number(info[1]),name:header[3].trim() || info[2],ilevel:Number(info[3]),slot,position:header[1] === 'equipped' ? Number(header[2].match(/[12]$/)?.[0] || 1) : 0,origin:'import',source:header[1],mainType:primary,weaponType:block.match(/^weapon: (\w+)/m)?.[1]||'none',stats:{armor:(raw.armor||0)+(raw.bonus_armor||0),stamina:raw.stamina||0,avoidance:raw.avoidance_rating||0,leech:raw.leech_rating||0,speed:raw.speed_rating||0,main:raw[primary]||0,crit:raw.crit_rating||0,haste:raw.haste_rating||0,mastery:raw.mastery_rating||0,versatility:raw.versatility_rating||0},socket:Number(flags[1])>0,socketCount:Number(flags[1]),set:tierSlots.includes(slot)&&Number(flags[2])>0,setId:tierSlots.includes(slot)?Number(flags[2]):0,embellishment:flags[3]==='1'});
    }
    result.mainType = mainType;
    result.warnings = report.split('\n').filter(s => /WARNING|ERROR/.test(s));
    return result;
  }
  function baseline(c){
    if(stats.some(([k])=>!Number.isFinite(c.baseStats?.[k])))return null;
    return {...c.baseStats};
  }
  function upsert(c,item){
    delete item.position;if(!tierSlots.includes(item.slot)){item.set=false;item.setId=0;}
    const index=c.items.findIndex(i=>i.id===item.id);
    if(index<0)c.items.push(item);else c.items[index]=item;
  }
  function applyImport(c,result,report){
    ensurePresets(c);
    const identity=JSON.stringify({name:result.name||'',...result.attributeContext});
    const changed=c.mainType!==result.mainType || (c.importIdentity&&c.importIdentity!==identity);
    if(changed)c.baseStats=emptyStats();
    c.importIdentity=identity;
    const fingerprint=i=>JSON.stringify([i.slot,i.itemId,i.ilevel,itemStats.map(([k])=>i.stats?.[k]||0)]);
    const locks=new Map();for(const i of c.items.filter(i=>i.locked)){const key=fingerprint(i);locks.set(key,(locks.get(key)||0)+1);}
    const custom=c.items.filter(i=>i.origin==='custom');
    c.items=[...result.items.map(item=>{
      const i={...item,stats:{...zeroStats(),...item.stats},selected:item.position>0};if(!changed&&(locks.get(fingerprint(i))||0)>0){locks.set(fingerprint(i),locks.get(fingerprint(i))-1);i.locked=true;i.selected=true;}delete i.position;return i;
    }),...custom];
    c.report=report;c.mainType=result.mainType;
    // Import identifies candidate types, not currently worn gem quantities.
    if(Array.isArray(result.equippedGems)){
      for(const i of c.items.filter(i=>i.slot==='gem'&&(i.presetId||i.importedGem)))i.selected=false;
      for(const importedGemId of new Set(result.equippedGems)){
        const gemId=Number(presets.aliases[String(importedGemId)]||importedGemId);
        let gem=c.items.find(i=>i.slot==='gem'&&i.itemId===gemId);
        if(!gem){gem={id:id(),itemId:gemId,name:`未识别宝石 #${gemId}`,slot:'gem',origin:'custom',importedGem:true,unresolved:true,selected:true,ilevel:0,mainType:c.mainType,adaptiveMain:true,stats:zeroStats(),socket:false,embellishment:false,set:false};c.items.push(gem);}
        if(gem.presetId||gem.importedGem)gem.selected=true;
      }
    }
    if(Array.isArray(result.equippedEnchants)){
      const selected=new Set(result.equippedEnchants);
      for(const i of c.items.filter(i=>i.slot==='enchant'&&i.presetId))i.selected=selected.has(i.enchantId);
    }
    if(!c.renamed&&result.name)c.name=result.name.slice(0,80);
    c.importInfo=`已导入 ${result.items.length} 件装备；忽略 ${result.skipped} 件；失败 ${result.failed} 件。`+(changed?'角色、专精或等级信息变化，请重新填写基础属性。':'已保留填写的基础属性。');
  }
  const candidates=c=>c.items.filter(i=>i.selected===true);
  function zeroStats(){return Object.fromEntries(itemStats.map(([k])=>[k,0]));}
  function ensurePresets(c){
    for(const p of presets.items)if(!c.items.some(i=>i.presetId===p.presetId)){
      c.items.push({...p,id:id(),origin:'custom',source:'preset',selected:false,mainType:p.supportedMainTypes?.length===1?p.supportedMainTypes[0]:c.mainType,adaptiveMain:!p.supportedMainTypes?.length,stats:{...zeroStats(),...p.stats},socket:false,embellishment:false,set:false});
    }
    return c;
  }
  const gemGroups=['钻石','榴石','榄石','紫晶','青金石'];
  function gemGroup(item){
    if(item.presetId){const name=presets.items.find(p=>p.presetId===item.presetId)?.name||item.name;return gemGroups.find(g=>name.includes(g))||null;}
    return null;
  }
  const sockets=i=>i.socketCount??(i.socket?1:0);
  function convolve(a,b){
    const out=new Map();
    for(const [x,n]of a)for(const [y,m]of b)out.set(x+y,(out.get(x+y)||0n)+n*m);
    return out;
  }
  function slotChoices(items,take,weight=()=>1n){
    const locked=items.filter(i=>i.locked),others=items.filter(i=>!i.locked);
    if(locked.length>take)return new Map();
    const base=locked.reduce((n,i)=>n+sockets(i),0),factor=locked.reduce((n,i)=>n*weight(i),1n);
    // Descending DP chooses distinct records, including every mandatory record.
    const remaining=take-locked.length,dp=Array.from({length:remaining+1},()=>new Map());dp[0].set(0,1n);
    for(const i of others)for(let n=remaining;n>=1;n--)for(const [socketCount,ways]of dp[n-1]){
      const key=socketCount+sockets(i);dp[n].set(key,(dp[n].get(key)||0n)+ways*weight(i));
    }
    return new Map([...dp[remaining]].map(([n,ways])=>[n+base,ways*factor]));
  }
  function enchantPool(c,item){
    const weapon=['main_hand','off_hand'].includes(item.slot);
    if(weapon&&item.weaponType==='none')return [];
    return c.items.filter(i=>i.slot==='enchant'&&i.selected&&i.enchantSlot===(weapon?'weapon':item.slot)&&(!i.minItemLevel||item.ilevel>=i.minItemLevel));
  }
  const enchantChoices=(c,item)=>BigInt(Math.max(1,enchantPool(c,item).length));
  function combinationCount(c){
    let distribution=new Map([[0,1n]]),equipmentDistribution=new Map([[0,1n]]),hasEquipment=false;
    const missing=[];
    for(const [key,label,capacity]of getSlots(c).filter(([key])=>!usageSlot(key))){
      const all=c.items.filter(i=>i.slot===key);if(!all.length)continue;
      hasEquipment=true;
      const selected=all.filter(i=>i.selected),take=Math.min(capacity,all.length);
      if(key==='off_hand'&&!selected.length)continue;
      if(selected.length<take){missing.push(`${label}需选 ${take} 件`);continue;}
      equipmentDistribution=convolve(equipmentDistribution,slotChoices(selected,take));
      distribution=convolve(distribution,slotChoices(selected,take,i=>enchantChoices(c,i)));
    }
    if(!hasEquipment||!c.items.some(i=>!usageSlot(i.slot)&&i.selected)||missing.length)return {total:0n,equipment:0n,missing,hasEquipment};
    const equipment=[...equipmentDistribution.values()].reduce((a,b)=>a+b,0n);
    let consumables=1n;
    for(const [key]of getSlots(c).filter(([key])=>usageSlot(key)&&!['gem','enchant'].includes(key)))consumables*=BigInt(Math.max(1,c.items.filter(i=>i.slot===key&&i.selected).length));
    const gems=c.items.filter(i=>i.slot==='gem'&&i.selected),ordinary=gems.filter(i=>!i.uniqueGroup).length;
    const uniqueGroups=new Map();for(const i of gems)if(i.uniqueGroup)uniqueGroups.set(i.uniqueGroup,(uniqueGroups.get(i.uniqueGroup)||0n)+1n);
    let uniqueWays=new Map([[0,1n]]);for(const count of uniqueGroups.values())uniqueWays=convolve(uniqueWays,new Map([[0,1n],[1,count]]));
    const maxSockets=Math.max(...distribution.keys());
    // Fill all sockets: C(g + n - 1, n), unordered with repetition.
    const ordinaryWays=[1n];for(let n=1;n<=maxSockets;n++)ordinaryWays[n]=ordinaryWays[n-1]*BigInt(ordinary+n-1)/BigInt(n);
    let total=0n;
    for(const [n,equipmentWays]of distribution){
      let gemWays=gems.length?0n:1n;if(gems.length)for(const [used,ways]of uniqueWays)if(used<=n)gemWays+=ways*ordinaryWays[n-used];
      total+=equipmentWays*gemWays;
    }
    if(!total&&gems.length)missing.push('所选宝石无法填满孔位，请增加普通宝石候选');
    return {total:total*consumables,equipment,missing,hasEquipment};
  }
  // SimC exports bags/bank as commented rows. Only successfully parsed worn rows count.
  function attachEquippedGems(result,input){
    result.equippedGems=[];result.equippedEnchants=[];
    for(const line of input.replace(/^\uFEFF/,'').split(/\r?\n/)){
      const match=line.trim().match(/^(head|neck|shoulder|shoulders|back|chest|wrist|wrists|hands|waist|legs|feet|finger[12]|trinket[12]|main_hand|off_hand)\s*=\s*(.*)$/);
      if(!match)continue;
      const key=slotKey(match[1]),position=Number(match[1].match(/[12]$/)?.[0]||1);
      const itemId=Number(match[2].match(/(?:^|,)id=(\d+)/)?.[1]);
      const item=result.items.find(i=>i.slot===key&&i.position===position&&i.itemId===itemId);if(!item)continue;
      const enchantId=Number(match[2].match(/(?:^|,)enchant_id=(\d+)/)?.[1]);if(enchantId)result.equippedEnchants.push(enchantId);
      const gemField=match[2].match(/(?:^|,)gem_id=([0-9/]+)/)?.[1];
      const gems=gemField?gemField.split('/').map(Number):[];
      item.socketCount=Math.max(item.socketCount||0,gems.length);item.socket=item.socketCount>0;
      result.equippedGems.push(...gems.filter(n=>n>0));
    }
    return result;
  }
  function closeCharacter(s,id){
    const index=s.characters.findIndex(c=>c.id===id);if(index<0)return;
    const [closed]=s.characters.splice(index,1);
    s.closedCharacters=[...(s.closedCharacters||[]),closed].slice(-20);
    if(!s.characters.length)s.characters.push(newCharacter('角色 1'));
    if(s.activeId===id)s.activeId=s.characters[Math.min(index,s.characters.length-1)].id;
  }
  function reopenCharacter(s){
    if(!s.closedCharacters?.length||s.characters.length>=100)return false;
    const c=s.closedCharacters[s.closedCharacters.length-1];if(s.characters.some(t=>t.id===c.id))return false;
    validateState({version:2,activeId:c.id,characters:[c]});
    s.closedCharacters.pop();s.characters.push(c);s.activeId=c.id;return true;
  }
  const api={tierSlots,itemStats,displayStats,toggleLock,toggleSelected,enchantSlots,enchantPool,enchantChoices,presets,ensurePresets,usageSlot,gemGroups,gemGroup,combinationCount,attachEquippedGems,getSlots,addSlot,renameSlot,candidates,closeCharacter,reopenCharacter,slots,stats,types,id,emptyStats,newCharacter,newState,validateState,parseReport,baseline,upsert,applyImport};
  if(typeof module !== 'undefined')module.exports=api; else root.GearModel=api;
})(globalThis);
