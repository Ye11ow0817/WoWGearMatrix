(function (root) {
  'use strict';
  const slots = [['head','头部',1],['neck','项链',1],['shoulders','肩部',1],['back','背部',1],['chest','胸部',1],['wrists','手腕',1],['hands','手部',1],['waist','腰部',1],['legs','腿部',1],['feet','脚部',1],['finger','戒指',2],['trinket','饰品',2],['main_hand','主手',1],['off_hand','副手',1],['enchant','附魔',1],['gem','宝石',1],['food','食物',1],['flask','合剂',1]];
  const presets = typeof module !== 'undefined' ? require('./presets.js') : root.GearPresets;
  const profileCatalog = typeof module !== 'undefined' ? require('./profile-catalog.js') : root.ProfileCatalog;
  const detailSlot=key=>!['enchant','gem','food','flask'].includes(key);
  const usageSlot = key => ['enchant','gem','food','flask'].includes(key) || key.startsWith('custom_');
  const stats = [['main','主属性'],['crit','暴击'],['haste','急速'],['mastery','精通'],['versatility','全能']];
  const percentStats=['crit','haste','mastery','versatility','avoidance','leech','speed'];
  const itemStats=[['stamina','耐力'],['armor','护甲'],...stats,['avoidance','闪避'],['leech','吸血'],['speed','加速']];
  const tierSlots=['head','shoulders','chest','legs','hands'];
  const enchantSlots=[['head','头部'],['shoulders','肩部'],['chest','胸部'],['legs','腿部'],['feet','脚部'],['finger','戒指'],['weapon','武器']];
  function displayStats(i){
    const secondary=stats.slice(1).sort((a,b)=>(i.stats[b[0]]||0)-(i.stats[a[0]]||0));
    return [...itemStats.slice(0,3),...secondary,...itemStats.slice(-3)].filter(([k])=>i.stats[k]);
  }
  function toggleLock(c,i){
    if(!['finger','trinket'].includes(i.slot))throw Error('只有戒指和饰品可以锁定');
    if(!i.locked&&c.items.filter(x=>x.slot===i.slot&&x.locked).length>=2)throw Error('每个栏位最多锁定 2 件，请先解锁其他项目');
    i.locked=!i.locked;if(i.locked)i.selected=true;
  }
  function toggleSelected(c,i){if(i.locked)throw Error('请先解锁，再取消候选');i.selected=!i.selected;}
  const types = { strength:'力量', agility:'敏捷', intellect:'智力' };
  const classes={warrior:['arms','fury','protection'],paladin:['holy','protection','retribution'],hunter:['beast_mastery','marksmanship','survival'],rogue:['assassination','outlaw','subtlety'],priest:['discipline','holy','shadow'],death_knight:['blood','frost','unholy'],shaman:['elemental','enhancement','restoration'],mage:['arcane','fire','frost'],warlock:['affliction','demonology','destruction'],monk:['brewmaster','mistweaver','windwalker'],druid:['balance','feral','guardian','restoration'],demon_hunter:['devourer','havoc','vengeance'],evoker:['devastation','preservation','augmentation']};
  const races=['human','orc','dwarf','night_elf','undead','forsaken','tauren','gnome','troll','goblin','blood_elf','draenei','dark_iron_dwarf','vulpera','maghar_orc','mechagnome','dracthyr','dracthyr_alliance','dracthyr_horde','earthen','earthen_dwarf','earthen_alliance','earthen_horde','haranir','harronir','haranir_alliance','haranir_horde','worgen','pandaren','pandaren_alliance','pandaren_horde','nightborne','highmountain_tauren','void_elf','lightforged_draenei','zandalari_troll','kul_tiran'];
  const raceGroups={联盟:{human:'人类',dwarf:'矮人',night_elf:'暗夜精灵',gnome:'侏儒',draenei:'德莱尼',worgen:'狼人',void_elf:'虚空精灵',lightforged_draenei:'光铸德莱尼',dark_iron_dwarf:'黑铁矮人',kul_tiran:'库尔提拉斯人',mechagnome:'机械侏儒'},部落:{orc:'兽人',undead:'亡灵',tauren:'牛头人',troll:'巨魔',blood_elf:'血精灵',goblin:'地精',nightborne:'夜之子',highmountain_tauren:'至高岭牛头人',maghar_orc:'玛格汉兽人',zandalari_troll:'赞达拉巨魔',vulpera:'狐人'},其他:{pandaren:'熊猫人',dracthyr:'龙希尔',earthen:'土灵',haranir:'哈籁尼尔'}};
  const classLabels={warrior:'战士',paladin:'圣骑士',hunter:'猎人',rogue:'潜行者',priest:'牧师',shaman:'萨满祭司',mage:'法师',warlock:'术士',monk:'武僧',druid:'德鲁伊',death_knight:'死亡骑士',demon_hunter:'恶魔猎手',evoker:'唤魔师'};
  const specLabels={warrior:{arms:'武器',fury:'狂怒',protection:'防护'},paladin:{holy:'神圣',protection:'防护',retribution:'惩戒'},hunter:{beast_mastery:'野兽控制',marksmanship:'射击',survival:'生存'},rogue:{assassination:'奇袭',outlaw:'狂徒',subtlety:'敏锐'},priest:{discipline:'戒律',holy:'神圣',shadow:'暗影'},shaman:{elemental:'元素',enhancement:'增强',restoration:'恢复'},mage:{arcane:'奥术',fire:'火焰',frost:'冰霜'},warlock:{affliction:'痛苦',demonology:'恶魔学识',destruction:'毁灭'},monk:{brewmaster:'酒仙',mistweaver:'织雾',windwalker:'踏风'},druid:{balance:'平衡',feral:'野性',guardian:'守护',restoration:'恢复'},death_knight:{blood:'鲜血',frost:'冰霜',unholy:'邪恶'},demon_hunter:{devourer:'噬灭',havoc:'浩劫',vengeance:'复仇'},evoker:{devastation:'湮灭',preservation:'保存',augmentation:'增辉'}};
  const mainTypeFor=(cls,spec)=>({warrior:'strength',death_knight:'strength',hunter:'agility',rogue:'agility',mage:'intellect',priest:'intellect',warlock:'intellect',evoker:'intellect'})[cls] || (cls==='demon_hunter' ? (spec==='devourer'?'intellect':'agility') : cls==='paladin' ? (spec==='holy'?'intellect':'strength') : cls==='shaman' ? (spec==='enhancement'?'agility':'intellect') : cls==='druid' ? (['feral','guardian'].includes(spec)?'agility':'intellect') : cls==='monk' ? (spec==='mistweaver'?'intellect':'agility') : 'strength');
  const id = () => globalThis.crypto.randomUUID();
  const emptyStats = () => Object.fromEntries(stats.map(([k]) => [k, null]));
  const newCharacter = (name = '新角色') => {const c=ensurePresets({id:id(),name,renamed:false,input:'',report:'',items:[],customSlots:[],baseStats:emptyStats(),mainType:'strength',filters:{},sort:{},importInfo:'',alwaysUseDiamond:true});selectProfile(c,{class:'warrior',spec:'arms',race:'human'});return c;};
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
  function removeSlot(c,key){
    if(!c.customSlots?.some(s=>s.id===key))throw Error('只能删除自定义栏位');
    c.customSlots=c.customSlots.filter(s=>s.id!==key);
    c.items=c.items.filter(i=>i.slot!==key);
  }
  function validateState(s) {
    if (!s || s.version !== 2 || !Array.isArray(s.characters) || !s.characters.length || s.characters.length > 100) throw Error('角色数据格式无效');
    const ids = new Set();
    for (const c of s.characters) {
      if (!c || typeof c.id !== 'string' || ids.has(c.id) || typeof c.name !== 'string' || !c.name.trim() || c.name.length > 80 || !Array.isArray(c.items) || c.items.length > 3000 || typeof c.input !== 'string' || typeof c.report !== 'string' || !types[c.mainType]) throw Error('角色数据损坏');
      ids.add(c.id);
      if(c.alwaysUseDiamond!==undefined&&typeof c.alwaysUseDiamond!=='boolean')throw Error('钻石始终使用选项无效');
      if(c.resultPercent!==undefined&&typeof c.resultPercent!=='boolean')throw Error('结果百分比选项无效');
      if(c.customTagNames!==undefined&&(!Array.isArray(c.customTagNames)||c.customTagNames.length>200||c.customTagNames.some(name=>typeof name!=='string'||!name.trim()||name!==name.trim()||name.length>40)||new Set(c.customTagNames).size!==c.customTagNames.length))throw Error('自定义标签列表格式无效');
      if(c.basePercents!==undefined&&(!c.basePercents||typeof c.basePercents!=='object'||Array.isArray(c.basePercents)||percentStats.some(key=>c.basePercents[key]!==null&&c.basePercents[key]!==undefined&&(!Number.isFinite(c.basePercents[key])||c.basePercents[key]<0||c.basePercents[key]>10000))))throw Error('基础属性百分比无效');
      if(c.ratingOverrides!==undefined&&(!c.ratingOverrides||typeof c.ratingOverrides!=='object'||Array.isArray(c.ratingOverrides)||Object.entries(c.ratingOverrides).some(([key,value])=>!['crit','haste','mastery','versatility','avoidance','leech','speed'].includes(key)||!Number.isFinite(value)||value<=0||value>1000000)))throw Error('属性换算比例无效');
      if(!Array.isArray(c.customSlots)||c.customSlots.length>30)throw Error('自定义栏位格式无效');
      const slotIds=new Set(),slotNames=new Set(slots.map(s=>s[1].toLowerCase()));
      for(const slot of c.customSlots){
        if(!slot||typeof slot.id!=='string'||!/^custom_[a-zA-Z0-9-]+$/.test(slot.id)||slotIds.has(slot.id)||typeof slot.name!=='string'||!slot.name.trim()||slot.name.length>40||slotNames.has(slot.name.trim().toLowerCase()))throw Error('自定义栏位名称或编号无效');
        slotIds.add(slot.id);slotNames.add(slot.name.trim().toLowerCase());
      }
      for(const [k]of stats)if(c.baseStats?.[k]!==null&&(!Number.isFinite(c.baseStats?.[k])||c.baseStats[k]<0||c.baseStats[k]>10000000))throw Error('基础属性格式无效');
      for(const [k]of itemStats)if(c.baseStats[k]!==undefined&&c.baseStats[k]!==null&&(!Number.isFinite(c.baseStats[k])||c.baseStats[k]<0||c.baseStats[k]>10000000))throw Error('基础属性格式无效');
      if(c.rawBaseStats!==undefined){if(!c.rawBaseStats||itemStats.some(([k])=>!Number.isFinite(c.rawBaseStats[k])||c.rawBaseStats[k]<0||c.rawBaseStats[k]>10000000))throw Error('原始基础属性格式无效');}
      if(c.attributeFactors!==undefined&&(!c.attributeFactors||itemStats.some(([k])=>!Number.isFinite(c.attributeFactors[k])||c.attributeFactors[k]<=0||c.attributeFactors[k]>100)))throw Error('角色属性倍率无效');
      if(c.attributeResponse!==undefined&&c.attributeResponse!==null&&['armor_agility','armor_mastery','armor_joint'].some(k=>!Number.isFinite(c.attributeResponse[k])))throw Error('属性联动数据无效');
      if(c.responseBaseStats!==undefined&&(!c.responseBaseStats||!Number.isFinite(c.responseBaseStats.main)||!Number.isFinite(c.responseBaseStats.mastery)))throw Error('属性联动基准无效');
      if(c.responseBaseFactors!==undefined&&(!c.responseBaseFactors||!Number.isFinite(c.responseBaseFactors.main)||!Number.isFinite(c.responseBaseFactors.mastery)))throw Error('属性联动倍率基准无效');
      if(c.attributeContext!==undefined){const a=c.attributeContext;if(!a||!classes[a.class]?.includes(a.spec)||!races.includes(a.race)||!Number.isInteger(a.level)||a.level<1||a.level>120||typeof a.talents!=='string'||a.talents.length>4000)throw Error('角色属性来源无效');}
      if(c.disabledTraits!==undefined&&(!Array.isArray(c.disabledTraits)||c.disabledTraits.length>100||c.disabledTraits.some(n=>!Number.isInteger(n)||n<1||n>10000000)))throw Error('天赋选择无效');
      if(c.enabledTraits!==undefined&&(!Array.isArray(c.enabledTraits)||c.enabledTraits.length>100||c.enabledTraits.some(n=>!Number.isInteger(n)||n<1||n>10000000)))throw Error('天赋选择无效');
      if(c.traits!==undefined&&!Array.isArray(c.traits))throw Error('天赋资料无效');
      enrichProfileData(c);
      ensurePresets(c);
      delete c.diamondLockInitialized;
      if(c.items.length>3000)throw Error('每个角色最多保存 3000 个项目（含预设）');
      const items = new Set();
      for (const i of c.items) {
        if(!detailSlot(i.slot)){i.set=false;i.setId=0;}
        if(i.boe===undefined)i.boe=false;
        if(i.customTags!==undefined&&(!Array.isArray(i.customTags)||i.customTags.length>20||i.customTags.some(name=>typeof name!=='string'||!name.trim()||name!==name.trim()||name.length>40)||new Set(i.customTags).size!==i.customTags.length))throw Error('自定义标签须为不重复的 1–40 字文本，每件装备最多 20 个');
        if(!detailSlot(i.slot))i.boe=false;
        if(i.setGroup!==undefined&&(typeof i.setGroup!=='string'||i.setGroup.length>80))throw Error('套装分组须为 80 字以内文本');
        i.stats={...zeroStats(),...i.stats};
        if(i.locked!==undefined&&typeof i.locked!=='boolean')throw Error('锁定状态无效');
        if(i.slot==='gem')delete i.locked;
        if(i.locked){if(!['finger','trinket'].includes(i.slot))throw Error('该栏位不支持锁定');i.selected=true;}
        if(i.slot==='enchant'&&!enchantSlots.some(([k])=>k===i.enchantSlot))throw Error('附魔部位无效');
        if(i.socketCount!==undefined&&(!Number.isInteger(i.socketCount)||i.socketCount<0||i.socketCount>10))throw Error('装备孔位数量须为 0–10 的整数');
        if(i.adaptiveMain!==undefined&&typeof i.adaptiveMain!=='boolean')throw Error('主属性类型无效');
        if(typeof i.selected!=='boolean')throw Error('装备选择状态无效');
        const slot = getSlots(c).find(([k]) => k === i.slot);
        if (!slot || typeof i.id !== 'string' || items.has(i.id) || typeof i.name !== 'string' || !i.name.trim() || i.name.length > 200 || !Number.isInteger(i.ilevel) || i.ilevel < 0 || i.ilevel > 10000 || !types[i.mainType] || !['import','custom'].includes(i.origin)) throw Error('装备数据格式无效');
        for (const flag of ['socket','embellishment','boe','set']) if (typeof i[flag] !== 'boolean') throw Error('装备标记格式无效');
        for (const [k] of itemStats) if (!Number.isFinite(i.stats?.[k]) || i.stats[k] < 0 || i.stats[k] > 10000000) throw Error('装备属性格式无效');
        items.add(i.id);
      }
      for(const key of ['finger','trinket'])if(c.items.filter(i=>i.slot===key&&i.locked).length>2)throw Error('每个栏位最多锁定 2 件');
      migrateBoe(c);
      c.customTagNames=[...new Set([...(c.customTagNames||[]),...c.items.filter(i=>detailSlot(i.slot)).flatMap(i=>i.customTags||[])])];
      ensureTagColors(c);
    }
    if (!ids.has(s.activeId)) throw Error('当前角色不存在');
    return s;
  }
  const slotKey = s => ({shoulder:'shoulders',wrist:'wrists',finger1:'finger',finger2:'finger',trinket1:'trinket',trinket2:'trinket'})[s] || s;
  function prepareProfileInput(input,profile){
    if(!profile)return input;
    if(!classes[profile.class]?.includes(profile.spec)||!races.includes(profile.race)||!Array.isArray(profile.disabledTraits)||profile.disabledTraits.length>100||profile.disabledTraits.some(n=>!Number.isInteger(n)||n<1||n>10000000)||!Array.isArray(profile.enabledTraits||[])||(profile.enabledTraits||[]).length>100||(profile.enabledTraits||[]).some(n=>!Number.isInteger(n)||n<1||n>10000000))throw Error('角色选项无效');
    const actor=input.match(/^(warrior|paladin|hunter|rogue|priest|death_knight|deathknight|shaman|mage|warlock|monk|druid|demon_hunter|demonhunter|evoker)\s*=/m)?.[1];
    const originalSpec=input.match(/^spec\s*=\s*(\w+)/m)?.[1];
    const level=profile.level===undefined?90:profile.level;
    if(!Number.isInteger(level)||level<1||level>90)throw Error('角色等级无效');
    let text=actor?input.replace(/^(warrior|paladin|hunter|rogue|priest|death_knight|deathknight|shaman|mage|warlock|monk|druid|demon_hunter|demonhunter|evoker)(\s*=)/m,profile.class+'$2'):`${profile.class}="Manual"\nlevel=${level}\n`;
    text=/^race\s*=/m.test(text)?text.replace(/^race\s*=.*$/m,'race='+profile.race):text+'\nrace='+profile.race;
    text=/^spec\s*=/m.test(text)?text.replace(/^spec\s*=.*$/m,'spec='+profile.spec):text+'\nspec='+profile.spec;
    if(profile.level!==undefined)text=/^level\s*=/m.test(text)?text.replace(/^level\s*=.*$/m,'level='+level):text+'\nlevel='+level;
    if((({deathknight:'death_knight',demonhunter:'demon_hunter'})[actor]||actor)!==profile.class||originalSpec!==profile.spec)text=text.replace(/^talents\s*=.*$/m,'talents=');
    return text+'\n# wgm_disable_traits='+profile.disabledTraits.join('/')+'\n# wgm_enable_traits='+(profile.enabledTraits||[]).join('/')+'\n# wgm_discover_traits=1\n';
  }
  function parseReport(report) {
    const character = report.match(/^Character: (.*?) \| (.*?)\/(.*?) \| level=(\d+)/m);
    const cls=({deathknight:'death_knight',demonhunter:'demon_hunter'})[character?.[2]]||character?.[2], spec=character?.[3];
    const mainType = mainTypeFor(cls,spec);
    const context=report.match(/^Context: race=(.*?) \| talents=(.*)$/m);
    const dataVersion=report.match(/^Data: (.*)$/m)?.[1]||'';
    const parseValues=line=>Object.fromEntries([...(line||'').matchAll(/(\w+)=(-?[\d.]+(?:[eE][+-]?\d+)?)/g)].map(m=>[m[1],Number(m[2])]));
    const values=parseValues(report.match(/^character_stats: (.*)$/m)?.[1]);
    const raw=parseValues(report.match(/^raw_character: (.*)$/m)?.[1]);
    const factors=parseValues(report.match(/^character_factors: (.*)$/m)?.[1]);
    const percents=parseValues(report.match(/^character_percent: (.*)$/m)?.[1]);
    const response=parseValues(report.match(/^character_response: (.*)$/m)?.[1]);
    const toStats=v=>({armor:v.armor||0,stamina:v.stamina||0,main:v[mainType]||0,crit:v.crit_rating||0,haste:v.haste_rating||0,mastery:v.mastery_rating||0,versatility:v.versatility_rating||0,avoidance:v.avoidance_rating||0,leech:v.leech_rating||0,speed:v.speed_rating||0});
    const effects=new Map([...report.matchAll(/^trait_effect: id=(\d+) \| stats: (.*)$/gm)].map(m=>[Number(m[1]),toStats(parseValues(m[2]))]));
    const multipliers=new Map([...report.matchAll(/^trait_multiplier: id=(\d+) \| stats: (.*)$/gm)].map(m=>[Number(m[1]),toStats(parseValues(m[2]))]));
    const probes=new Map([...report.matchAll(/^trait_probe: id=(\d+) \| stats: (.*)$/gm)].map(m=>[Number(m[1]),toStats(parseValues(m[2]))]));
    const spellEffects=new Map([...report.matchAll(/^trait_spell: id=(\d+) \| rank=(\d+)(.*)$/gm)].map(m=>[Number(m[1]),parseValues(m[3])]));
    const traitResponses=new Map([...report.matchAll(/^trait_response: id=(\d+) \| (.*)$/gm)].map(m=>[Number(m[1]),parseValues(m[2])]));
    const traits=[...report.matchAll(/^trait: id=(\d+) \| (?:spell=(\d+) \| )?name=(.*?) \| rank=(\d+) \| enabled=([01])(?: \| origin=(import|manual|available))?$/gm)].map(m=>({id:Number(m[1]),spellId:Number(m[2]||0),name:m[3],rank:Number(m[4]),enabled:m[5]==='1',origin:m[6]||'import',effect:effects.get(Number(m[1]))||zeroStats(),multiplier:multipliers.get(Number(m[1]))||{},probe:probes.get(Number(m[1]))||zeroStats(),spellEffects:spellEffects.get(Number(m[1]))||{},response:traitResponses.get(Number(m[1]))||{}})).filter(t=>itemStats.some(([k])=>t.effect[k]||t.probe[k]||t.multiplier[k]&&Math.abs(t.multiplier[k]-1)>0.00001));
    const result = {name:character?.[1] || '',attributeContext:{class:cls||'',spec:spec||'',level:Number(character?.[4]||0),race:context?.[1]||'',talents:context?.[2]||'',dataVersion},baseStats:Object.keys(values).length?toStats(values):null,basePercents:Object.keys(percents).length?Object.fromEntries(percentStats.map(key=>[key,percents[key]??null])):null,rawStats:Object.keys(raw).length?toStats(raw):null,attributeFactors:Object.keys(factors).length?toStats(factors):null,attributeResponse:Object.keys(response).length?response:null,traits,items:[],skipped:0,failed:0,warnings:[]};
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
    if(item.origin==='custom'&&item.source==='custom'&&c.items.some(i=>i.id!==item.id&&i.slot===item.slot&&(item.slot!=='enchant'||i.enchantSlot===item.enchantSlot)&&i.name.trim().toLocaleLowerCase()===item.name.trim().toLocaleLowerCase()))throw Error('目标栏位已有同名物品');
    delete item.position;if(!detailSlot(item.slot)){item.set=false;item.setId=0;}
    const previous=tagColumns(c).map(([key])=>key),index=c.items.findIndex(i=>i.id===item.id);
    if(index<0)c.items.push(item);else c.items[index]=item;
    c.customTagNames=[...new Set([...(c.customTagNames||previous.map(key=>decodeURIComponent(key.slice(4)))),...(item.customTags||[])])];
    syncTagSettings(c,previous);
  }
  function removeCustomItem(c,itemId){
    const index=c.items.findIndex(i=>i.id===itemId&&i.origin==='custom'&&i.source==='custom');
    if(index<0)throw Error('只能删除用户创建的自定义物品');
    c.items.splice(index,1);
    syncTagSettings(c);
  }
  const tagKey=name=>'tag:'+encodeURIComponent(name);
  function migrateBoe(c){
    const key=tagKey('BOE'),assigned=c.items.filter(item=>item.boe&&detailSlot(item.slot)),referenced=c.resultColumns?.includes('boe')||c.sort?.rules?.some(rule=>rule.type==='stat'&&rule.stat==='boe')||c.filters?.counts?.boe!==undefined||c.filters?.boe!==undefined;
    if(assigned.length||referenced)c.customTagNames=[...new Set([...(c.customTagNames||[]),'BOE'])];
    for(const item of assigned){item.customTags=[...new Set([...(item.customTags||[]),'BOE'])];item.boe=false;}
    if(Array.isArray(c.resultColumns))c.resultColumns=[...new Set(c.resultColumns.map(column=>column==='boe'?key:column))];
    for(const rule of c.sort?.rules||[])if(rule.type==='stat'&&rule.stat==='boe')rule.stat=key;
    if(c.filters?.counts?.boe!==undefined){c.filters.counts[key]??=c.filters.counts.boe;delete c.filters.counts.boe;}
    if(c.filters?.boe!==undefined){const value=c.filters.boe;c.filters.counts??={};c.filters.counts[key]??=value==null||value===''?{}:{min:value,max:value};delete c.filters.boe;}
  }
  const presetTagColors={tier:'#ffd166',embellishment:'#b58cff',embellishments:'#b58cff'};
  const tagPalette=['#ff7b89','#6ab8ff','#a9df62','#ffab66','#61dde8','#f58ed6','#e0c486','#8da0f2','#f2b4a0','#91cba6','#d8daf2','#d99168','#68a6b8','#d8a83d','#da7db5','#84b477','#a7cfff','#eddf97','#b4a18a','#c2e5da'];
  function tagColor(c,name){
    const names=tagColumns(c).map(([,label])=>label),colors=c.customTagColors||{};
    if(Object.hasOwn(colors,name)&&tagPalette.includes(colors[name]))return colors[name];
    const pending=names.filter(label=>!Object.hasOwn(colors,label)||!tagPalette.includes(colors[label])),next=Number.isInteger(c.customTagColorNext)?c.customTagColorNext:0;
    return tagPalette[(next+Math.max(0,pending.indexOf(name)))%tagPalette.length];
  }
  function ensureTagColors(c){
    c.customTagColors=Object.fromEntries(tagColumns(c).map(([,name])=>[name,c.customTagColors?.[name]]).filter(([,color])=>tagPalette.includes(color)));
    let next=Number.isInteger(c.customTagColorNext)&&c.customTagColorNext>=0&&c.customTagColorNext<tagPalette.length?c.customTagColorNext:Object.keys(c.customTagColors).length%tagPalette.length;
    for(const [,name]of tagColumns(c))if(!Object.hasOwn(c.customTagColors,name)){Object.defineProperty(c.customTagColors,name,{value:tagPalette[next],enumerable:true,writable:true,configurable:true});next=(next+1)%tagPalette.length;}
    c.customTagColorNext=next;
  }
  function tagColumns(c){return (c.customTagNames??[...new Set(c.items.filter(i=>detailSlot(i.slot)).flatMap(i=>i.customTags||[]))]).map(name=>[tagKey(name),name]);}
  function setCustomTagNames(c,names){
    const previous=tagColumns(c).map(([key])=>key),active=new Set(names);
    c.customTagNames=[...names];
    for(const item of c.items)if(item.customTags)item.customTags=item.customTags.filter(name=>active.has(name));
    syncTagSettings(c,previous);
  }
  function syncTagSettings(c,previous=null){
    ensureTagColors(c);
    const active=new Set(tagColumns(c).map(([key])=>key));
    if(Array.isArray(c.resultColumns))c.resultColumns=[...c.resultColumns.filter(key=>!key.startsWith('tag:')||active.has(key)),...Array.from(active).filter(key=>previous&&!previous.includes(key)&&!c.resultColumns.includes(key))];
    for(const key of Object.keys(c.filters?.counts||{}))if(key.startsWith('tag:')&&!active.has(key))delete c.filters.counts[key];
    if(Array.isArray(c.sort?.rules))c.sort.rules=c.sort.rules.filter(r=>r.type!=='stat'||!r.stat?.startsWith('tag:')||active.has(r.stat));
  }
  function applyImport(c,result,report){
    ensurePresets(c);
    const identity=JSON.stringify({name:result.name||'',...result.attributeContext});
    const changed=c.mainType!==result.mainType || (c.importIdentity&&c.importIdentity!==identity);
    if(result.baseStats){c.rawBaseStats=result.rawStats;c.naturalRawStats={...result.rawStats};c.manualRawAdjustment=zeroStats();c.attributeFactors=result.attributeFactors;c.attributeResponse=result.attributeResponse;c.responseBaseStats={main:result.rawStats.main,mastery:result.rawStats.mastery};c.responseBaseFactors={main:result.attributeFactors.main,mastery:result.attributeFactors.mastery};c.baseStats=result.baseStats;c.basePercents=result.basePercents||(!changed?c.basePercents:null)||Object.fromEntries(percentStats.map(key=>[key,null]));c.attributeContext=result.attributeContext;c.traits=result.traits;c.disabledTraits=[];c.enabledTraits=[];c.attributeOffset=Object.fromEntries(itemStats.map(([k])=>[k,(result.baseStats[k]||0)-statRound(k,(result.rawStats[k]||0)*(result.attributeFactors[k]||1))]));}
    else if(changed)c.baseStats=emptyStats();
    c.importIdentity=identity;
    const fingerprint=i=>JSON.stringify([i.slot,i.itemId,i.ilevel,itemStats.map(([k])=>i.stats?.[k]||0)]);
    const tags=new Map(c.items.filter(i=>i.origin==='import'&&i.customTags?.length).map(i=>[fingerprint(i),i.customTags]));
    const previousTags=tagColumns(c).map(([key])=>key);
    const locks=new Map();for(const i of c.items.filter(i=>i.locked)){const key=fingerprint(i);locks.set(key,(locks.get(key)||0)+1);}
    const custom=c.items.filter(i=>i.origin==='custom');
    c.items=[...result.items.map(item=>{
      const i={...item,stats:{...zeroStats(),...item.stats},selected:item.position>0};if(!changed&&tags.has(fingerprint(i)))i.customTags=[...tags.get(fingerprint(i))];if(!changed&&(locks.get(fingerprint(i))||0)>0){locks.set(fingerprint(i),locks.get(fingerprint(i))-1);i.locked=true;i.selected=true;}delete i.position;return i;
    }),...custom];
    syncTagSettings(c,previousTags);
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
    c.importInfo=`已导入 ${result.items.length} 件装备；忽略 ${result.skipped} 件；失败 ${result.failed} 件。`+(result.baseStats?'基础属性已按 SimC 计算。':changed?'角色信息变化，请重新填写基础属性。':'已保留填写的基础属性。')+(result.baseStats&&!result.basePercents?'导入数据未提供基础百分比，请手动填写。':'');
  }
  function applyProfile(c,result){
    if(!result.baseStats||!result.rawStats)throw Error('SimC 未返回角色基础属性');
    const oldContext=c.attributeContext||{},sameTalents=oldContext.class===result.attributeContext.class&&oldContext.spec===result.attributeContext.spec&&oldContext.talents===result.attributeContext.talents;
    const oldTraits=new Map((sameTalents?c.traits||[]:[]).map(t=>[t.id,t]));
    c.attributeContext=result.attributeContext;c.rawBaseStats=result.rawStats;c.attributeFactors=result.attributeFactors;c.attributeResponse=result.attributeResponse;c.responseBaseStats={main:result.rawStats.main,mastery:result.rawStats.mastery};c.responseBaseFactors={main:result.attributeFactors.main,mastery:result.attributeFactors.mastery};c.baseStats=result.baseStats;c.basePercents=result.basePercents||((oldContext.class===result.attributeContext.class&&oldContext.spec===result.attributeContext.spec&&oldContext.race===result.attributeContext.race)?c.basePercents:null)||Object.fromEntries(percentStats.map(key=>[key,null]));c.mainType=result.mainType;
    c.traits=[...result.traits];
    for(const id of c.disabledTraits||[])if(oldTraits.has(id)&&!c.traits.some(t=>t.id===id))c.traits.push({...oldTraits.get(id),enabled:false});
    const imported=c.items.filter(i=>i.origin==='import');
    c.items=[...result.items.map((item,n)=>{
      const old=imported[n],matching=old&&old.slot===item.slot&&old.itemId===item.itemId;
      return {...item,id:matching?old.id:item.id,selected:matching?old.selected:item.position>0,locked:matching?old.locked:false,stats:{...zeroStats(),...item.stats}};
    }),...c.items.filter(i=>i.origin==='custom')];
    for(const i of c.items)delete i.position;
  }
  function statRound(key,value){return ['main','stamina'].includes(key)?Math.floor(value):Math.round(value);}
  function hydrateProfile(c){
    c.rawBaseStats??=zeroStats();c.naturalRawStats??={...c.rawBaseStats};c.manualRawAdjustment??=zeroStats();
    c.attributeFactors??=Object.fromEntries(itemStats.map(([k])=>[k,1]));
    c.attributeOffset??=Object.fromEntries(itemStats.map(([k])=>[k,(c.baseStats?.[k]||0)-statRound(k,(c.rawBaseStats[k]||0)*(c.attributeFactors[k]||1))]));
  }
  function enrichProfileData(c){
    const context=c.attributeContext,entry=profileCatalog?.profiles?.[`${context?.class}/${context?.spec}`];
    if(!entry)return;
    c.traits??=[];
    const existing=new Map(c.traits.map(t=>[t.id,t]));
    for(const fresh of entry.traits){
      const old=existing.get(fresh.id);
      if(old){
        if(old.rank===fresh.rank){old.spellEffects??={...fresh.spellEffects};old.probe??={...fresh.probe};old.response??={...fresh.response};}
      }else{
        const line=c.report?.match(new RegExp(`^trait: id=${fresh.id} \\| .*?rank=(\\d+) \\| enabled=([01])`,'m'));
        c.traits.push({...structuredClone(fresh),enabled:line?.[2]==='1',rank:line?Number(line[1]):fresh.rank,origin:line?'import':'available'});
      }
    }
    if(!c.attributeResponse&&entry.attributeResponse){
      c.attributeResponse={...entry.attributeResponse};
      for(const trait of c.traits.filter(t=>t.enabled))for(const key of ['armor_agility','armor_mastery','armor_joint'])c.attributeResponse[key]+=trait.response?.[key]||0;
    }
    if(!c.responseBaseStats&&c.attributeResponse)c.responseBaseStats={main:entry.rawStats.main,mastery:entry.rawStats.mastery};
    if(!c.responseBaseFactors&&c.attributeResponse)c.responseBaseFactors={main:entry.attributeFactors.main,mastery:entry.attributeFactors.mastery};
  }
  function inferRaw(c,key){
    const visible=c.baseStats?.[key],factor=c.attributeFactors?.[key]||1,offset=c.attributeOffset?.[key]||0;
    if(Number.isFinite(visible)){
      const approximate=(visible-offset)/factor,candidates=[Math.floor(approximate)-1,Math.floor(approximate),Math.ceil(approximate),Math.ceil(approximate)+1].filter(n=>n>=0&&statRound(key,n*factor)+offset===visible);
      const preferred=(c.naturalRawStats?.[key]||0)+(c.manualRawAdjustment?.[key]||0);
      c.rawBaseStats[key]=candidates.length?candidates.sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred))[0]:Math.max(0,approximate);
      c.manualRawAdjustment[key]=c.rawBaseStats[key]-(c.naturalRawStats?.[key]||0);
    }else{
      c.manualRawAdjustment[key]=0;c.rawBaseStats[key]=c.naturalRawStats?.[key]||0;
    }
  }
  function editDisplayedStat(c,key,value){
    if(!itemStats.some(([k])=>k===key))throw Error('属性无效');
    hydrateProfile(c);
    c.baseStats[key]=value;
    inferRaw(c,key);
  }
  function selectProfile(c,choice){
    hydrateProfile(c);
    const old=c.attributeContext||{},cls=choice.class||old.class||'warrior',spec=choice.spec||old.spec||classes[cls]?.[0],race=choice.race||old.race||'human';
    if(!classes[cls]?.includes(spec)||!races.includes(race))throw Error('角色选项无效');
    const entry=profileCatalog?.profiles?.[`${cls}/${spec}`];
    c.attributeContext={...old,class:cls,spec,race,level:90,talents:old.class===cls&&old.spec===spec?(old.talents||''):'',dataVersion:entry?.dataVersion||old.dataVersion||''};
    c.mainType=mainTypeFor(cls,spec);
    const changedProfile=old.class!==cls||old.spec!==spec||!c.traits;
    if(changedProfile)c.basePercents=Object.fromEntries(percentStats.map(key=>[key,null]));
    if(entry&&changedProfile){
      c.traits=structuredClone(entry.traits);
      c.attributeFactors={...entry.attributeFactors};
      c.attributeResponse=entry.attributeResponse?{...entry.attributeResponse}:null;
      c.responseBaseStats={main:entry.rawStats.main,mastery:entry.rawStats.mastery};
      c.responseBaseFactors={main:entry.attributeFactors.main,mastery:entry.attributeFactors.mastery};
      c.attributeOffset=Object.fromEntries(itemStats.map(([k])=>[k,(entry.baseStats[k]||0)-statRound(k,(entry.rawStats[k]||0)*(entry.attributeFactors[k]||1))]));
      c.disabledTraits=[];c.enabledTraits=[];
    }
    if(entry){
      const normalizedRace=id=>({forsaken:'undead',dracthyr_alliance:'dracthyr',dracthyr_horde:'dracthyr',earthen_dwarf:'earthen',earthen_alliance:'earthen',earthen_horde:'earthen',harronir:'haranir',haranir_alliance:'haranir',haranir_horde:'haranir',pandaren_alliance:'pandaren',pandaren_horde:'pandaren'})[id]||id;
      const raceFactor=(id,key)=>{
        return (profileCatalog.races?.[normalizedRace(id)]?.attributeFactors?.[key]||1)/(profileCatalog.races?.human?.attributeFactors?.[key]||1);
      };
      const previous=changedProfile?'human':old.race||'human';
      for(const [key] of itemStats)c.attributeFactors[key]*=raceFactor(race,key)/raceFactor(previous,key);
      const raceDelta=(profileCatalog.races?.[normalizedRace(race)]?.[c.mainType]||0)-(profileCatalog.races?.human?.[c.mainType]||0);
      const staminaDelta=(profileCatalog.races?.[normalizedRace(race)]?.stamina||0)-(profileCatalog.races?.human?.stamina||0);
      c.naturalRawStats={...entry.rawStats,main:entry.rawStats.main+raceDelta,stamina:entry.rawStats.stamina+staminaDelta};
      for(const [key] of itemStats)c.rawBaseStats[key]=Math.max(0,(c.naturalRawStats[key]||0)+(c.manualRawAdjustment[key]||0));
    }
  }
  function toggleTrait(c,id,enabled){
    const trait=c.traits?.find(t=>t.id===id);if(!trait||trait.enabled===enabled)return;
    hydrateProfile(c);
    const warrior=c.attributeContext?.class==='warrior',oldArmor=warrior?warriorArmorFormula(c):1;
    const oldTransfer=warrior?warriorArmorStrength(c):0;
    for(const [key] of itemStats){
      if(warrior&&key==='armor')continue;
      if(warrior&&id===112233&&key==='main')continue;
      const ratio=trait.multiplier?.[key]||1;
      if(Math.abs(ratio-1)>0.00001)c.attributeFactors[key]*=enabled?ratio:1/ratio;
      else c.attributeOffset[key]+=(enabled?1:-1)*(trait.effect?.[key]||0);
    }
    trait.enabled=enabled;
    if(c.attributeResponse)for(const key of ['armor_agility','armor_mastery','armor_joint'])c.attributeResponse[key]+=(enabled?1:-1)*(trait.response?.[key]||0);
    if(warrior){
      c.attributeFactors.armor*=warriorArmorFormula(c)/oldArmor;
      const newTransfer=warriorArmorStrength(c);
      if(oldTransfer!==newTransfer)c.attributeOffset.main+=Math.floor(newTransfer*(c.baseStats.armor||0))-Math.floor(oldTransfer*(c.baseStats.armor||0));
    }
    const disabled=new Set(c.disabledTraits||[]),selected=new Set(c.enabledTraits||[]);
    if(trait.origin==='import'){if(enabled)disabled.delete(id);else disabled.add(id);}
    else {if(enabled)selected.add(id);else selected.delete(id);}
    c.disabledTraits=[...disabled];c.enabledTraits=[...selected];
  }
  // Spell effect values are already resolved by SimC for the selected rank and
  // specialization. Never use an isolated trial's composite ratio as the label.
  function traitDescription(t,mainType,spec){
    if(!t.spellEffects||!Object.keys(t.spellEffects).length)return '请重新导入以读取该点数的法术数值';
    const e=n=>t.spellEffects?.['e'+n], pct=(n,label)=>Number.isFinite(e(n))?`+${e(n)}%${label}`:'';
    const main=types[mainType]||'主属性';
    switch(t.id){
      case 112233:return `获得相当于护甲${e(spec==='protection'?3:2)}%的力量`;
      case 112235:return [pct(1,'耐力'),pct(2,'护甲')].join('、');
      case 112160:return pct(1,'护甲');
      case 118836:return pct(1,'耐力');
      case 132882:return [pct(1,'耐力'),pct(2,'急速')].join('、');
      case 102597:return [pct(2,'护甲'),pct(2,'暴击几率')].join('、');
      case 102612:return [pct(1,main),pct(2,'精通')].join('、');
      case 115034:return [pct(1,'耐力'),pct(3,'护甲')].join('、');
      case 126447:return `暴击属性来源+${e(1)}%`;
      case 136677:case 126332:case 112636:case 125074:return pct(t.id===126332?2:1,'敏捷')+(t.id===126332?`；双持额外+${e(3)}%敏捷`:'');
      case 135502:return [pct(1,'精通'),`精通属性来源+${e(2)}%`].join('、');
      case 135734:return pct(1,'耐力');
      case 103818:case 135312:case 136103:case 136561:return pct(1,'智力');
      case 103837:case 127855:case 91438:case 96197:case 115609:case 103297:return pct(1,'耐力')+(t.id===103297?`；熊形态额外+${e(2)}%耐力`:'');
      case 136102:return pct(3,'耐力')+'（牺牲魔典生效时）';
      case 96183:return pct(1,'护甲');
      case 124795:return [pct(1,'法术暴击几率'),`暴击属性来源+${e(2)}%`].join('、');
      case 134540:return [pct(1,'急速'),`急速属性来源+${e(2)}%`].join('、');
      case 91463:return pct(4,'护甲');
      case 124830:return `急速属性来源+${e(1)}%`;
      case 124882:return pct(2,'耐力');
      case 125025:return pct(3,'耐力');
      case 103303:return pct(1,'护甲');
      case 112845:return pct(1,'精通');
      default:return '';
    }
  }
  function warriorArmorStrength(c){
    const trait=c.traits?.find(t=>t.id===112233&&t.enabled);
    return trait?(trait.spellEffects?.[c.attributeContext?.spec==='protection'?'e3':'e2']||0)/100:0;
  }
  function warriorArmorFormula(c){
    const active=id=>c.traits?.find(t=>t.id===id&&t.enabled)?.spellEffects||{};
    const reinforced=1+(active(112235).e2||0)/100;
    if(c.attributeContext?.spec!=='protection')return reinforced*reinforced;
    const specialized=1+(active(112160).e1||0)/100;
    const armed=(active(112233).e3||0)/100;
    return reinforced*reinforced*specialized*specialized/(1-0.7*armed*reinforced*specialized);
  }
  function scaledStat(c,key,added){
    const base=c.baseStats[key],factor=c.attributeFactors?.[key]||1,raw=c.rawBaseStats?.[key]||0;
    if(factor===1)return base+added;
    const round=['main','stamina'].includes(key)?Math.floor:Math.round;
    return base+round((raw+added)*factor)-round(raw*factor);
  }
  function scaledStats(c,added,conditions={}){
    const result=Object.fromEntries(itemStats.map(([key])=>[key,scaledStat(c,key,added[key]||0)]));
    if(conditions.dualWield&&c.attributeContext?.class==='hunter'&&c.attributeContext?.spec==='survival'){
      const lunge=c.traits?.find(t=>t.id===126332&&t.enabled),bonus=(lunge?.spellEffects?.e3||0)/100;
      if(bonus){const raw=c.rawBaseStats?.main||0,factor=c.attributeFactors?.main||1;
        result.main=(c.baseStats.main||0)+Math.floor((raw+(added.main||0))*factor*(1+bonus))-Math.floor(raw*factor);
      }
    }
    if(c.attributeContext?.class==='demon_hunter'&&c.attributeContext?.spec==='vengeance'&&c.attributeResponse){
      const a=added.main||0,m=added.mastery||0,r=c.attributeResponse;
      const agilityRatio=(c.attributeFactors?.main||1)/(c.responseBaseFactors?.main||c.attributeFactors?.main||1);
      const masteryRatio=(c.attributeFactors?.mastery||1)/(c.responseBaseFactors?.mastery||c.attributeFactors?.mastery||1);
      const cross=(r.armor_joint-r.armor_agility-r.armor_mastery)*agilityRatio*masteryRatio;
      const baseA=(c.rawBaseStats?.main||0)-(c.responseBaseStats?.main||0);
      const baseM=(c.rawBaseStats?.mastery||0)-(c.responseBaseStats?.mastery||0);
      const armorDelta=((r.armor_agility*agilityRatio+cross*baseM/1000)*a+(r.armor_mastery*masteryRatio+cross*baseA/1000)*m)/1000+cross*a*m/1000000;
      result.armor+=Math.round(armorDelta);
    }
    if(c.attributeContext?.class!=='warrior')return result;
    const f=c.attributeFactors?.armor||1,mainFactor=c.attributeFactors?.main||1;
    const rawMain=c.rawBaseStats?.main||0,mainAdded=added.main||0;
    const ordinaryMain=Math.floor((rawMain+mainAdded)*mainFactor)-Math.floor(rawMain*mainFactor);
    const vanguard=c.attributeContext.spec==='protection'?0.7:0;
    const armorAdded=((added.armor||0)+vanguard*ordinaryMain)*f;
    result.armor=(c.baseStats.armor||0)+Math.round(armorAdded);
    const transfer=warriorArmorStrength(c);
    if(transfer){
      const baselineArmor=c.baseStats.armor||0;
      result.main=(c.baseStats.main||0)+Math.floor((rawMain+mainAdded+transfer*(baselineArmor+armorAdded))*mainFactor)-Math.floor((rawMain+transfer*baselineArmor)*mainFactor);
    }
    return result;
  }
  const candidates=c=>c.items.filter(i=>i.selected===true);
  function zeroStats(){return Object.fromEntries(itemStats.map(([k])=>[k,0]));}
  function ensurePresets(c){
    c.items=c.items.filter(i=>!['enchant-8009','enchant-8007'].includes(i.presetId));
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
  const twoHanded=i=>i.slot==='main_hand'&&/^(?:sword2h|axe2h|mace2h|staff|polearm|bow|gun|crossbow)(?:_|$)/i.test(i.weaponType||'');
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
    for(const [key,label,capacity]of getSlots(c).filter(([key])=>detailSlot(key))){
      if(key==='off_hand'&&c.items.some(i=>i.slot==='main_hand'))continue;
      const all=c.items.filter(i=>i.slot===key);if(!all.length)continue;
      if(!usageSlot(key))hasEquipment=true;
      const selected=all.filter(i=>i.selected),take=Math.min(capacity,all.length);
      if((key==='off_hand'||key.startsWith('custom_'))&&!selected.length)continue;
      if(selected.length<take){missing.push(`${label}需选 ${take} 件`);continue;}
      if(key==='main_hand'){
        const off=c.items.filter(i=>i.slot==='off_hand'&&i.selected);
        const weaponChoices=weight=>{
          const out=new Map();
          for(const main of selected){
            const offChoices=twoHanded(main)||!off.length?[null]:off;
            for(const extra of offChoices){
              const items=extra?[main,extra]:[main];
              const sockets=items.reduce((n,i)=>n+(i.socketCount??(i.socket?1:0)),0);
              const ways=items.reduce((n,i)=>n*weight(i),1n);
              out.set(sockets,(out.get(sockets)||0n)+ways);
            }
          }
          return out;
        };
        equipmentDistribution=convolve(equipmentDistribution,weaponChoices(()=>1n));
        distribution=convolve(distribution,weaponChoices(i=>enchantChoices(c,i)));
      }else{
        equipmentDistribution=convolve(equipmentDistribution,slotChoices(selected,take));
        distribution=convolve(distribution,slotChoices(selected,take,i=>enchantChoices(c,i)));
      }
    }
    if(!hasEquipment||!c.items.some(i=>!usageSlot(i.slot)&&i.selected)||missing.length)return {total:0n,equipment:0n,missing,hasEquipment};
    const equipment=[...equipmentDistribution.values()].reduce((a,b)=>a+b,0n);
    let consumables=1n;
    for(const [key]of getSlots(c).filter(([key])=>usageSlot(key)&&!detailSlot(key)&&!['gem','enchant'].includes(key)))consumables*=BigInt(Math.max(1,c.items.filter(i=>i.slot===key&&i.selected).length));
    const gems=c.items.filter(i=>i.slot==='gem'&&i.selected),ordinary=gems.filter(i=>!i.uniqueGroup).length;
    const uniqueGroups=new Map();for(const i of gems)if(i.uniqueGroup)uniqueGroups.set(i.uniqueGroup,(uniqueGroups.get(i.uniqueGroup)||0n)+1n);
    const diamondCount=[...uniqueGroups.values()].reduce((sum,count)=>sum+count,0n);
    const uniqueWays=diamondCount?new Map(c.alwaysUseDiamond===false?[[0,1n],[1,diamondCount]]:[[1,diamondCount]]):new Map([[0,1n]]);
    const maxSockets=Math.max(...distribution.keys());
    // Fill all sockets: C(g + n - 1, n), unordered with repetition.
    const ordinaryWays=[1n];for(let n=1;n<=maxSockets;n++)ordinaryWays[n]=ordinaryWays[n-1]*BigInt(ordinary+n-1)/BigInt(n);
    let total=0n;
    for(const [n,equipmentWays]of distribution){
      let gemWays=gems.length?0n:1n;if(gems.length)for(const [used,ways]of uniqueWays)if(used<=n)gemWays+=ways*ordinaryWays[n-used];
      total+=equipmentWays*gemWays;
    }
    if(!total&&gems.length)missing.push(diamondCount&&c.alwaysUseDiamond!==false&&!maxSockets?'已选钻石需要至少一个孔位':'所选宝石无法填满孔位，请增加普通宝石候选');
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
  const api={tagPalette,presetTagColors,detailSlot,tagColor,setCustomTagNames,tagKey,tagColumns,syncTagSettings,tierSlots,itemStats,displayStats,toggleLock,toggleSelected,enchantSlots,enchantPool,enchantChoices,twoHanded,presets,ensurePresets,usageSlot,gemGroups,gemGroup,combinationCount,attachEquippedGems,getSlots,addSlot,renameSlot,removeSlot,candidates,closeCharacter,reopenCharacter,slots,stats,types,classes,races,raceGroups,classLabels,specLabels,mainTypeFor,id,emptyStats,newCharacter,newState,validateState,parseReport,baseline,upsert,removeCustomItem,applyImport,applyProfile,editDisplayedStat,selectProfile,toggleTrait,traitDescription,scaledStat,scaledStats,prepareProfileInput};
  if(typeof module !== 'undefined')module.exports=api; else root.GearModel=api;
})(globalThis);
