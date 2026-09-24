'use strict';
const M=window.GearModel, $=s=>document.querySelector(s);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state,editing,renamingId,importingId=null,saveQueue=Promise.resolve(),pending=0,revision=0,canClose=false;
const current=()=>state.characters.find(c=>c.id===state.activeId);
function save() {
  window.searchUI?.invalidate();
  const snapshot=structuredClone(state),rev=++revision;
  pending++;$('#save-status').textContent='正在保存…';
  saveQueue=saveQueue.then(()=>window.simc.save(snapshot)).then(()=>{
    if(rev===revision){$('#save-status').textContent='已保存到本机';$('#save-status').className='';}
    return true;
  }).catch(e=>{ $('#save-status').textContent='未保存：'+e.message;$('#save-status').className='error';return false; }).finally(()=>pending--);
  return saveQueue;
}
window.addEventListener('beforeunload',e=>{
  if(pending&&!canClose){e.preventDefault();e.returnValue=false;saveQueue.then(ok=>{if(ok){canClose=true;window.close();}});}
});
function tabs() {
  $('#tabs').innerHTML=state.characters.map(c=>`<div class="tab-shell ${c.id===state.activeId?'active':''}"><button class="tab" role="tab" aria-selected="${c.id===state.activeId}" data-tab="${escape(c.id)}" title="${escape(c.name)}（双击重命名）">${escape(c.name)}</button><button class="close-tab" data-close-tab="${escape(c.id)}" aria-label="关闭 ${escape(c.name)}" title="关闭角色">×</button></div>`).join('');
}
let toastTimer;
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,6000);}
function render() {
  const c=current();document.querySelectorAll('.workspace-section').forEach(section=>section.open=!(c.collapsedSections||[]).includes(section.id));tabs();$('#character-name').textContent=c.name;
  $('#input').value=c.input;
  $('#parse').disabled=!!importingId;$('#input').disabled=importingId===c.id;
  $('#parse').textContent=importingId===c.id?'导入中…':'导入';
  const context=c.attributeContext||{},cls=context.class||'warrior',race=({forsaken:'undead',dracthyr_alliance:'dracthyr',dracthyr_horde:'dracthyr',earthen_dwarf:'earthen',earthen_alliance:'earthen',earthen_horde:'earthen',harronir:'haranir',haranir_alliance:'haranir',haranir_horde:'haranir',pandaren_alliance:'pandaren',pandaren_horde:'pandaren'})[context.race]||context.race||'human',spec=context.spec||M.classes[cls][0];
  $('#profile-race').innerHTML=Object.entries(M.raceGroups).map(([group,entries])=>`<optgroup label="${group}">${Object.entries(entries).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</optgroup>`).join('');
  $('#profile-class').innerHTML=Object.entries(M.classLabels).map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
  $('#profile-spec').innerHTML=M.classes[cls].map(id=>`<option value="${id}">${M.specLabels[cls][id]}</option>`).join('');
  $('#profile-race').value=race;$('#profile-class').value=cls;$('#profile-spec').value=spec;
  for(const el of [$('#profile-race'),$('#profile-class'),$('#profile-spec')])el.disabled=importingId===c.id;
  const traitLabel=t=>M.traitDescription(t,c.mainType,spec);
  $('#profile-traits').innerHTML=c.traits?.length?c.traits.map(t=>`<label><input type="checkbox" data-trait="${t.id}" ${t.enabled?'checked':''} ${importingId===c.id?'disabled':''}><span>${escape(window.TalentZh?.[t.spellId]||t.name)} <span class="effect-detail">（${escape(traitLabel(t))}）</span></span></label>`).join(''):'<p class="hint">当前职业和专精暂无可选的属性天赋。</p>';
  $('#base-stats').innerHTML=M.itemStats.map(([key,label])=>`<tr data-stat-row="${key}"><th scope="row"><label for="base-${key}">${key==='main'?M.types[c.mainType]:label}</label></th><td><input class="stat-input" id="base-${key}" data-stat="${key}" type="number" min="0" max="10000000" step="1" value="${c.baseStats[key]??''}" placeholder="未填写" ${importingId===c.id?'disabled':''}></td></tr>`).join('');
  renderBaseline();renderGear();window.searchUI?.renderSettings();
}
function renderBaseline(){
  const c=current(),complete=M.itemStats.every(([k])=>Number.isFinite(c.baseStats[k]));
  $('#baseline').textContent=complete?'站街属性已填写；内部保留增幅前的原始值。':'导入 SimC 字符串或手动填写站街属性。';
}
function renderCombinations(){
  const result=M.combinationCount(current());
  $('#combo-count').textContent=result.total.toLocaleString('zh-CN');
  $('#combo-state').textContent=result.missing.length?result.missing.join(' · '):!result.hasEquipment?'请先导入或添加装备':'按黄色候选计数 · 属性过滤前';
  $('#combination-bar').hidden=false;
}
const isUsage=M.usageSlot;
function card(i) {
  const usage=isUsage(i.slot),disabled=current().id===importingId;
  const tags=usage?[]:[i.set&&M.tierSlots.includes(i.slot)?'套装':null,i.embellishment?'美化':null,i.socket?`${i.socketCount||1} 孔`:null].filter(Boolean);
  const attr=([k,label])=>`<span data-item-stat="${k}">${escape(k==='main'?(i.supportedMainTypes?.length?i.supportedMainTypes.map(t=>M.types[t]).join('/'):(i.adaptiveMain?'主属性':M.types[i.mainType])):label)} ${i.stats[k]}</span>`;
  const ordered=M.displayStats(i),groups=[['armor','stamina'],['main','crit','haste','mastery','versatility'],['avoidance','leech','speed']];
  const attrs=groups.map((keys,n)=>`<span class="stat-line" data-stat-line="${n+1}">${ordered.filter(([k])=>keys.includes(k)).map(attr).join(' · ')}</span>`).join('');
  return `<div class="gear-entry ${i.locked?'locked':''} ${['finger','trinket'].includes(i.slot)?'lockable':''}" data-entry="${escape(i.id)}"><button class="gear-card ${i.selected?'selected':''}" data-item="${escape(i.id)}" aria-pressed="${!!i.selected}" title="${i.locked?'已锁定，所有组合都会使用；右键编辑':'左键选择候选 · 右键编辑'}" ${disabled?'disabled':''}><span class="card-top"><span class="item-name">${escape(i.name)}</span>${usage?'':`<span class="ilevel">${i.ilevel||'—'}</span>`}</span><span class="item-stats">${attrs}</span><span class="item-tags" data-stat-line="4">${escape(tags.join(' · '))}</span>${i.uniqueGroup?'<span class="effect-note">唯一：钻石</span>':''}${i.unresolved?'<span class="effect-note">待补全属性</span>':''}${i.effectNote?`<span class="effect-note">${escape(i.effectNote)}</span>`:''}</button>${['finger','trinket'].includes(i.slot)?`<button class="lock-toggle ${i.locked?'active':''}" data-lock="${escape(i.id)}" aria-pressed="${!!i.locked}" aria-label="${i.locked?'解锁':'锁定'} ${escape(i.name)}" title="${i.locked?'点击解锁':'锁定后每套组合都使用此项目，最多锁定 2 件'}" ${disabled?'disabled':''}>${i.locked?'已锁定':'锁定'}</button>`:''}</div>`;
}
function renderGear(){
  const c=current(),candidates=M.candidates(c),disabled=c.id===importingId;
  $('#gear-count').textContent='';
  $('#candidate-info').textContent=`已选 ${candidates.length} 项作为候选；组合总数见底栏，可在下方设置条件并计算结果。`;
  const addButton=(key,label)=>`<button class="add-item-row" data-add="${key}" ${disabled?'disabled':''}>＋ 新增${isUsage(key)?'自定义'+label:'装备'}</button>`;
  const panel=([key,label,count])=>{
    const all=c.items.filter(i=>i.slot===key),items=all,custom=key.startsWith('custom_');
    return `<section class="slot-panel" data-slot="${key}"><div class="slot-heading"><h3>${escape(label)}</h3><div class="slot-heading-actions">${custom?`<button class="text-button" data-rename-slot="${key}" ${disabled?'disabled':''}>改名</button>`:''}</div></div><div class="gear-list">${items.map(card).join('')}${addButton(key,custom?'项目':label)}</div></section>`;
  };
  const gems=c.items.filter(i=>i.slot==='gem'),customGems=gems.filter(i=>!M.gemGroup(i));
  const gemPanel=`<section class="slot-panel gem-panel" data-slot="gem"><div class="slot-heading"><h3>宝石</h3><div class="slot-heading-actions"></div></div><p class="hint gem-help">选择宝石后填满所有孔位；普通宝石可重复，钻石最多一颗。不选宝石时暂不计算镶嵌。</p><div class="gem-groups">${M.gemGroups.map(group=>`<section class="gem-group" data-gem-group="${group}"><h4>${group}</h4><div class="gem-group-list">${gems.filter(i=>M.gemGroup(i)===group).map(card).join('')}</div></section>`).join('')}</div>${customGems.length?`<div class="custom-gems"><h4>自定义 / 待补全宝石</h4><div class="custom-gem-list">${customGems.map(card).join('')}</div></div>`:''}${addButton('gem','宝石')}</section>`;
  const enchantPanel=`<section class="slot-panel enchant-panel" data-slot="enchant"><div class="slot-heading"><h3>附魔</h3></div><p class="hint">按部位选择候选，每件适用装备使用一种。同一种附魔可用于两枚戒指或双持武器；触发效果单独显示。</p><div class="enchant-groups">${M.enchantSlots.map(([key,label])=>`<section class="enchant-group" data-enchant-group="${key}"><h4>${label}</h4><div class="gear-list">${c.items.filter(i=>i.slot==='enchant'&&i.enchantSlot===key).map(card).join('')}<button class="add-item-row" data-add="enchant" data-enchant-target="${key}" ${disabled?'disabled':''}>＋ 新增自定义附魔</button></div></section>`).join('')}</div></section>`;
  const specs=M.getSlots(c);
  $('#slots').innerHTML=specs.filter(([k])=>!isUsage(k)).map(panel).join('');
  $('#enchant-slots').innerHTML=enchantPanel+gemPanel;
  $('#consumable-slots').innerHTML=`<div class="consumables-row">${['food','flask'].map(k=>panel(specs.find(([s])=>s===k))).join('')}</div>`+specs.filter(([k])=>k.startsWith('custom_')).map(panel).join('')+`<button class="add-slot-panel" id="new-slot" ${disabled?'disabled':''}>＋ 新增自定义栏位</button>`;
  renderCombinations();window.searchUI?.invalidate();
}
let slotEditing=null;
function openSlotDialog(key=null){
  slotEditing={characterId:current().id,key};
  $('#slot-dialog-title').textContent=key?'修改栏位名称':'新增自定义栏位';
  $('#slot-name').value=key?current().customSlots.find(s=>s.id===key).name:'';
  $('#slot-error').textContent='';$('#slot-dialog').showModal();$('#slot-name').focus();
}
$('#slot-form').addEventListener('submit',e=>{
  e.preventDefault();const c=state.characters.find(c=>c.id===slotEditing.characterId);
  try{if(slotEditing.key)M.renameSlot(c,slotEditing.key,$('#slot-name').value);else M.addSlot(c,$('#slot-name').value);$('#slot-dialog').close();renderGear();save();}
  catch(err){$('#slot-error').textContent=err.message;}
});
function openEditor(slot,item,target) {
  const c=current();if(c.id===importingId)return;
  const spec=M.getSlots(c).find(([key])=>key===slot);
  editing={characterId:c.id,item:item?structuredClone(item):{id:M.id(),slot,origin:'custom',source:'custom',selected:true,name:'',ilevel:0,mainType:c.mainType,adaptiveMain:isUsage(slot),socketCount:0,enchantSlot:target||'head',stats:Object.fromEntries(M.itemStats.map(([k])=>[k,0])),socket:false,embellishment:false,set:false}};
  const i=editing.item;
  $('#editor-title').textContent=`${item?'编辑项目':'新增项目'} · ${spec[1]}`;
  $('#editor-source').textContent=(i.presetId?'':i.origin==='custom'?'自定义':'导入项目')+(i.itemId?` · 物品 ID ${i.itemId}`:'')+(i.unresolved?' · 请填写属性，保存后用于计算':'');
  const usage=isUsage(slot);
  $('#item-set').closest('label').hidden=!M.tierSlots.includes(slot);
  $('#item-set').disabled=!M.tierSlots.includes(slot);
  $('#set-group-field').hidden=!M.tierSlots.includes(slot);
  $('#item-set-group').value=i.setGroup||(i.setId>0?String(i.setId):'');
  $('#item-level').closest('label').hidden=usage;$('#item-level').disabled=usage;
  $('#item-type').closest('label').hidden=usage;$('#item-flags').hidden=usage;
  $('#enchant-target-field').hidden=slot!=='enchant';
  $('#enchant-target').innerHTML=M.enchantSlots.map(([key,label])=>`<option value="${key}">${label}</option>`).join('');
  $('#enchant-target').value=i.enchantSlot||'head';
  $('#editor-description').textContent=usage?'填写此项目提供的固定属性，未提供的属性填 0。':'填写装备本体属性，不含宝石和附魔；装备标记单独填写。';
  $('#item-stats').innerHTML=M.itemStats.map(([key,label])=>`<label>${label}<input id="item-${key}" type="number" min="0" max="10000000" step="1" required></label>`).join('');
  $('#item-sockets').value=i.socketCount??(i.socket?1:0);$('#socket-fields').hidden=isUsage(slot);
  $('#item-name').value=i.name;$('#item-level').value=i.ilevel;$('#item-type').value=i.mainType;
  for(const [k] of M.itemStats)$('#item-'+k).value=i.stats[k]||0;
  for(const flag of ['socket','embellishment','set'])$('#item-'+flag).checked=i[flag];
  $('#edit-error').textContent='';$('#editor').showModal();$('#item-name').focus();
}
$('#app').addEventListener('click',e=>{
  if(!e.target.closest('[data-item-region]'))return;
  if(current().id===importingId)return;
  const lock=e.target.closest('[data-lock]'),add=e.target.closest('[data-add]'),button=e.target.closest('[data-item]'),renameSlot=e.target.closest('[data-rename-slot]');
  if(lock){try{M.toggleLock(current(),current().items.find(i=>i.id===lock.dataset.lock));renderGear();save();}catch(err){toast(err.message);}}
  else if(e.target.closest('#new-slot'))openSlotDialog();
  else if(renameSlot)openSlotDialog(renameSlot.dataset.renameSlot);
  else if(add)openEditor(add.dataset.add,null,add.dataset.enchantTarget);
  else if(button){const i=current().items.find(i=>i.id===button.dataset.item);if(i){try{M.toggleSelected(i);renderGear();save();}catch(err){toast(err.message);}}}
});
$('#app').addEventListener('contextmenu',e=>{
  if(!e.target.closest('[data-item-region]'))return;
  const entry=e.target.closest('[data-entry]');if(!entry)return;e.preventDefault();
  const item=current().items.find(i=>i.id===entry.dataset.entry);if(item)openEditor(item.slot,item);
});
$('#edit-form').addEventListener('submit',e=>{
  e.preventDefault();const c=state.characters.find(c=>c.id===editing.characterId),i=editing.item;
  i.name=$('#item-name').value.trim();i.ilevel=Number($('#item-level').value);i.mainType=$('#item-type').value;
  for(const [k] of M.itemStats)i.stats[k]=Number($('#item-'+k).value);
  for(const flag of ['socket','embellishment','set'])i[flag]=$('#item-'+flag).checked;
  if(isUsage(i.slot)){i.ilevel=0;i.adaptiveMain=!i.supportedMainTypes?.length;i.socket=false;i.socketCount=0;i.embellishment=false;i.set=false;}
  if(i.slot==='enchant')i.enchantSlot=$('#enchant-target').value;
  if(!isUsage(i.slot)){i.socketCount=i.socket?Number($('#item-sockets').value)||1:0;}
  i.setGroup=i.set?$('#item-set-group').value.trim():'';
  if(i.set&&!i.setGroup){$('#edit-error').textContent='请填写套装编号或分组，同一套装使用相同值。';return;}
  i.unresolved=false;
  if(!i.name){$('#edit-error').textContent='请输入名称。';return;}
  const draft=structuredClone(state);M.upsert(draft.characters.find(n=>n.id===c.id),i);
  try{M.validateState(draft);}catch(err){$('#edit-error').textContent=err.message;return;}
  state=draft;$('#editor').close();renderGear();renderBaseline();save();
});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.close).close()));
function rename(id) {renamingId=id;$('#rename-value').value=state.characters.find(c=>c.id===id).name;$('#rename-dialog').showModal();$('#rename-value').select();}
$('#rename').addEventListener('click',()=>rename(state.activeId));
$('#rename-form').addEventListener('submit',e=>{e.preventDefault();const name=$('#rename-value').value.trim();if(!name)return;const c=state.characters.find(c=>c.id===renamingId);c.name=name;c.renamed=true;$('#rename-dialog').close();render();save();});
$('#tabs').addEventListener('click',e=>{
  const close=e.target.closest('[data-close-tab]');
  if(close){M.closeCharacter(state,close.dataset.closeTab);render();save();toast('角色已关闭，可按 Ctrl+Shift+T 恢复');return;}
  const t=e.target.closest('[data-tab]');if(!t)return;state.activeId=t.dataset.tab;render();save();
});
window.addEventListener('keydown',e=>{if(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==='t'){e.preventDefault();if(M.reopenCharacter(state)){render();save();}}});
$('#tabs').addEventListener('dblclick',e=>{const t=e.target.closest('[data-tab]');if(t)rename(t.dataset.tab);});
$('#new-tab').addEventListener('click',()=>{if(state.characters.length>=100){$('#save-status').textContent='最多可创建 100 个角色';return;}const c=M.newCharacter(`角色 ${state.characters.length+1}`);state.characters.push(c);state.activeId=c.id;render();save();});
$('#base-stats').addEventListener('input',e=>{
  if(!e.target.dataset.stat)return;
  const value=e.target.value;
  M.editDisplayedStat(current(),e.target.dataset.stat,value!==''&&e.target.validity.valid?Number(value):null);
  renderBaseline();save();
});
$('#profile-class').addEventListener('change',()=>{
  const cls=$('#profile-class').value;if(!M.classes[cls])return;
  M.selectProfile(current(),{class:cls,spec:M.classes[cls][0],race:$('#profile-race').value});render();save();
});
$('#profile-race').addEventListener('change',()=>{M.selectProfile(current(),{race:$('#profile-race').value});render();save();});
$('#profile-spec').addEventListener('change',()=>{M.selectProfile(current(),{spec:$('#profile-spec').value});render();save();});
$('#profile-traits').addEventListener('change',e=>{
  const id=Number(e.target.dataset.trait),c=current(),trait=c.traits?.find(t=>t.id===id);if(!trait)return;
  M.toggleTrait(c,id,e.target.checked);render();save();
});
$('#input').addEventListener('input',()=>{current().input=$('#input').value;save();});
$('#parse').addEventListener('click',async()=>{
  const c=current();c.input=$('#input').value;importingId=c.id;render();save();
  try {
    const result=await window.simc.parse(c.input),target=state.characters.find(t=>t.id===c.id)||state.closedCharacters?.find(t=>t.id===c.id);
    if(!target)return;
    if(result.code===1 || !result.gear?.baseStats) {target.report=result.report;target.importInfo='导入失败，原有装备和基础属性已保留。';target.importWarning=true;}
    else {M.applyImport(target,result.gear,result.report);target.importWarning=result.code!==0||result.gear.warnings.length>0;if(target.importWarning)target.importInfo+=' 部分装备或版本信息需核对。';}
    toast(target.importInfo);
  }catch(e){const target=state.characters.find(t=>t.id===c.id)||state.closedCharacters?.find(t=>t.id===c.id);if(target){target.report=e.message;target.importInfo='导入失败，原有装备和基础属性已保留。';target.importWarning=true;toast(target.importInfo);}}
  finally{importingId=null;render();save();}
});
document.querySelectorAll('.workspace-section').forEach(section=>section.addEventListener('toggle',()=>{
  if(!state)return;const c=current(),closed=new Set(c.collapsedSections||[]);
  if(closed.has(section.id)===!section.open)return;
  if(section.open)closed.delete(section.id);else closed.add(section.id);c.collapsedSections=[...closed];save();
}));
$('#count-rules').addEventListener('click',()=>$('#count-dialog').showModal());
(async()=>{
  try {state=await window.simc.load()||M.newState();M.validateState(state);$('#app').hidden=false;$('#new-tab').disabled=false;render();await save();}
  catch(e){$('#save-status').textContent=e.message;$('#save-status').className='error';}
})();
