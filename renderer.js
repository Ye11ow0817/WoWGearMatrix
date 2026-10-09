'use strict';
const M=window.GearModel, $=s=>document.querySelector(s);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state,editing,importingId=null,saveQueue=Promise.resolve(),pending=0,revision=0,canClose=false;
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
  window.workspaceUI?.sync();const c=current();tabs();$('#character-name').value=c.name;
  $('#input').value=c.input;
  $('#parse').disabled=!!importingId;$('#input').disabled=importingId===c.id;
  $('#parse').textContent=importingId===c.id?'导入中…':'导入';
  const context=c.attributeContext||{},cls=context.class||'warrior',race=({forsaken:'undead',dracthyr_alliance:'dracthyr',dracthyr_horde:'dracthyr',earthen_dwarf:'earthen',earthen_alliance:'earthen',earthen_horde:'earthen',harronir:'haranir',haranir_alliance:'haranir',haranir_horde:'haranir',pandaren_alliance:'pandaren',pandaren_horde:'pandaren'})[context.race]||context.race||'human',spec=context.spec||M.classes[cls][0];
  $('#profile-race').innerHTML=Object.entries(M.raceGroups).map(([group,entries])=>`<optgroup label="${group}">${Object.entries(entries).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</optgroup>`).join('');
  $('#profile-class').innerHTML=Object.entries(M.classLabels).map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
  $('#profile-spec').innerHTML=M.classes[cls].map(id=>`<option value="${id}">${M.specLabels[cls][id]}</option>`).join('');
  $('#profile-race').value=race;$('#profile-class').value=cls;$('#profile-spec').value=spec;
  for(const el of [$('#profile-race'),$('#profile-class'),$('#profile-spec')])el.disabled=!!importingId;
  renderProfileEffects(c,cls,spec);
  $('#rating-rules').innerHTML=renderRatingRules(c,cls,spec);
  $('#base-stats').innerHTML=M.itemStats.map(([key,label])=>`<tr data-stat-row="${key}"><th scope="row"><label for="base-${key}">${key==='main'?M.types[c.mainType]:label}</label></th><td><input class="stat-input" id="base-${key}" data-stat="${key}" type="number" min="0" max="10000000" step="1" value="${c.baseStats[key]??''}" placeholder="未填写" ${importingId===c.id?'disabled':''}></td><td>${RatingConversion.keys.includes(key)?`<span class="base-percent-field"><input class="stat-input" id="base-percent-${key}" data-base-percent="${key}" type="number" min="0" max="10000" step="any" value="${c.basePercents?.[key]??''}" placeholder="未填写" aria-label="${label}基础百分比" ${importingId===c.id?'disabled':''}><span>%</span></span>`:''}</td></tr>`).join('');
  window.searchUI?.renderSettings();renderGear();window.workspaceUI?.restore();
}
function renderProfileEffects(c,cls,spec){
  const states=M.characterStateNames(cls,spec),active=c.activeCharacterState||'none';
  const stateChoices=states.length?`<section class="profile-effect-group"><h4>姿态与形态 <span class="hint">最多勾选一项</span></h4>${states.map(value=>`<label><input type="checkbox" data-profile-state="${value}" ${active===value?'checked':''} ${importingId===c.id||c.availableCharacterStates&&!c.availableCharacterStates.includes(value)?'disabled':''}><span>${escape(M.characterStateLabels[value])}${c.availableCharacterStates&&!c.availableCharacterStates.includes(value)?'<span class="hint">（未学习）</span>':''}</span></label>`).join('')}</section>`:'';
  const traits=(c.traits||[]).filter(t=>![386164,386196,386208,24858,197625,232698].includes(t.spellId)),groups=[[true,'被动天赋'],[false,'主动天赋']];
  const talentChoices=groups.map(([passive,title])=>{const entries=traits.filter(t=>(t.passive!==false)===passive);return entries.length?`<section class="profile-effect-group"><h4>${title}</h4>${entries.map(t=>`<label><input type="checkbox" data-trait="${t.id}" ${t.enabled?'checked':''} ${importingId===c.id?'disabled':''}><span>${escape(window.TalentZh?.[t.spellId]||'属性天赋')} <span class="effect-detail">（${escape(M.traitDescription(t,c.mainType,spec))}）</span></span></label>`).join('')}</section>`:'';}).join('');
  $('#profile-traits').innerHTML=stateChoices+talentChoices||'<p class="hint">当前职业和专精暂无可选的属性天赋或被动。</p>';
}
function renderRatingRules(c,cls,spec){
  const R=RatingConversion,name=k=>M.itemStats.find(([key])=>key===k)?.[1]||k;
  const number=n=>String(Number(n.toFixed(2)));
  const conversion=R.keys.map(k=>`<tr><th scope="row"><label for="rating-ratio-${k}">${escape(name(k))}</label></th><td><div class="rating-ratio-control"><input id="rating-ratio-${k}" data-rating-ratio="${k}" type="number" min="0.000001" max="1000000" step="any" value="${escape(R.displayRatio(c,k))}" aria-label="${escape(name(k))}每 1% 所需等级"><span>等级 = 1%</span><button type="button" class="filter-reset" data-reset-rating="${k}" ${c.ratingOverrides?.[k]===undefined?'hidden':''}>重置</button></div></td></tr>`).join('');
  const matrix=(title,curve,keys)=>{
    const points=R.curves[curve],bands=R.ratingBands(curve);
    return `<section class="rating-matrix-section"><h3>${title}</h3><div class="rating-table-scroll"><table class="rating-table rating-matrix"><thead><tr><th scope="col">属性</th>${bands.map(b=>`<th scope="col">-${b.penalty}%</th>`).join('')}<th scope="col">-100%</th></tr></thead><tbody>${keys.map(k=>{const per=R.perPercent(c,k);return `<tr><th scope="row">${escape(name(k))}</th>${bands.map(b=>`<td>${number(b.start*per)}–${number(b.end*per)}</td>`).join('')}<td>&gt;${number(points.at(-1)[0]*per)}</td></tr>`;}).join('')}</tbody></table></div></section>`;
  };
  return `<p class="rating-context">${escape(M.classLabels[cls])} · ${escape(M.specLabels[cls][spec])} · ${escape(c.attributeContext?.level||90)} 级 · SimC ${escape(c.attributeContext?.dataVersion||'12.1.0.69814')}</p><section class="rating-matrix-section"><div class="rating-section-heading"><h3>属性换算</h3><button type="button" id="reset-all-ratings" class="text-button" ${Object.keys(c.ratingOverrides||{}).length?'':'hidden'}>全部重置</button></div><div class="rating-table-scroll"><table class="rating-table rating-conversion"><thead><tr><th scope="col">属性</th><th scope="col">等级换算</th></tr></thead><tbody>${conversion}</tbody></table></div></section>${matrix('副属性递减','secondary',['haste','crit','versatility','mastery'])}${matrix('额外属性递减','tertiary',['avoidance','leech','speed'])}`;
}
function renderCombinations(){
  const result=M.combinationCount(current());
  $('#combo-count').textContent=result.total.toLocaleString('zh-CN');
  $('#combo-state').textContent=result.missing.length?result.missing.join(' · '):!result.hasEquipment?'请先导入或添加装备':'按黄色候选计数 · 属性过滤前';
  $('#combination-bar').hidden=false;
}
const isUsage=M.usageSlot;
function card(i) {
  const usage=!M.detailSlot(i.slot),disabled=current().id===importingId;
  const customItem=i.origin==='custom'&&i.source!=='preset'&&!i.presetId&&!i.importedGem;
  const sockets=i.socket?Math.max(1,i.socketCount||1):0;
  // Raidbots Top Gear EMPTY-PRISMATIC: https://www.raidbots.com/frontend/c6217d2ee6dd7647cbfa.png
  const socketIcons=sockets?`<span class="socket-icons" aria-label="${sockets} 个空孔">${Array.from({length:sockets},()=>'<img src="assets/empty-prismatic-socket.png" alt="">').join('')}</span>`:'';
  const tags=usage?[]:[i.set?'<span class="item-tag tier-tag">套装</span>':null,i.embellishment?'<span class="item-tag embellishment-tag">美化</span>':null,...(i.customTags||[]).map(name=>`<span class="item-tag custom-tag" data-custom-tag="${escape(name)}">${escape(name)}</span>`)].filter(Boolean);
  const tagLine=[socketIcons,...tags].filter(Boolean).join('<span class="tag-separator"> · </span>');
  const attr=([k,label])=>`<span data-item-stat="${k}">${escape(k==='main'?(i.supportedMainTypes?.length?i.supportedMainTypes.map(t=>M.types[t]).join('/'):(i.adaptiveMain?'主属性':M.types[i.mainType])):label)} ${i.stats[k]}</span>`;
  const ordered=M.displayStats(i),groups=[['stamina','armor'],['main','crit','haste','mastery','versatility'],['avoidance','leech','speed']];
  const attrs=groups.map((keys,n)=>`<span class="stat-line" data-stat-line="${n+1}">${ordered.filter(([k])=>keys.includes(k)).map(attr).join(' · ')}</span>`).join('');
  return `<div class="gear-entry ${i.locked?'locked':''} ${['finger','trinket'].includes(i.slot)?'lockable':''}" data-entry="${escape(i.id)}"><button class="gear-card ${i.selected?'selected':''} ${customItem?'custom-item':''}" data-item="${escape(i.id)}" aria-pressed="${!!i.selected}" title="${i.locked?'已锁定，所有组合都会使用；右键编辑':'左键选择候选 · 右键编辑'}" ${disabled?'disabled':''}><span class="card-top"><span class="item-name">${escape(i.name)}</span>${usage?'':`<span class="ilevel">${i.ilevel||'-'}</span>`}</span><span class="item-stats">${attrs}</span><span class="item-tags" data-stat-line="4">${tagLine}</span>${i.uniqueGroup?'<span class="effect-note">唯一：钻石</span>':''}${i.unresolved?'<span class="effect-note">待补全属性</span>':''}${i.effectNote?`<span class="effect-note">${escape(i.effectNote)}</span>`:''}</button>${['finger','trinket'].includes(i.slot)?`<button class="lock-toggle ${i.locked?'active':''}" data-lock="${escape(i.id)}" aria-pressed="${!!i.locked}" aria-label="${i.locked?'解锁':'锁定'} ${escape(i.name)}" title="${i.locked?'点击解锁':'锁定后每套组合都使用此项目，最多锁定 2 件'}" ${disabled?'disabled':''}>${i.locked?'已锁定':'锁定'}</button>`:''}</div>`;
}
function fitLockButtons(){
  for(const entry of document.querySelectorAll('#slots .gear-entry.lockable')){
    const card=entry.querySelector('.gear-card'),lock=entry.querySelector('.lock-toggle');
    card.style.paddingBottom='';
    const button=lock.getBoundingClientRect();
    const walker=document.createTreeWalker(card,NodeFilter.SHOW_TEXT);
    let node,overlap=0;
    while((node=walker.nextNode())){
      if(!node.textContent.trim())continue;
      const range=document.createRange();range.selectNodeContents(node);
      for(const rect of range.getClientRects()){
        if(rect.right>button.left-4&&rect.left<button.right+4&&rect.bottom>button.top-4&&rect.top<button.bottom+4)
          overlap=Math.max(overlap,rect.bottom-button.top+4);
      }
    }
    if(overlap)card.style.paddingBottom=`${8+overlap}px`;
  }
}
window.addEventListener('resize',fitLockButtons);
function renderGear(){
  const c=current(),candidates=M.candidates(c),disabled=c.id===importingId;
  $('#gear-count').textContent='';
  $('#candidate-info').textContent=`已选 ${candidates.length} 项作为候选；组合总数见底栏，可在下方设置条件并计算结果。`;
  const addButton=(key,label)=>`<button class="add-item-row" data-add="${key}" ${disabled?'disabled':''}>＋ 新增${isUsage(key)?'自定义'+label:'装备'}</button>`;
  const panel=([key,label,count])=>{
    const all=c.items.filter(i=>i.slot===key),items=all,custom=key.startsWith('custom_');
    return `<section class="slot-panel" data-slot="${key}"><div class="slot-heading"><h3>${escape(label)}</h3><div class="slot-heading-actions">${custom?`<button class="text-button" data-rename-slot="${key}" ${disabled?'disabled':''}>改名</button><button class="text-button delete-slot" data-delete-slot="${key}" ${disabled?'disabled':''}>删除</button>`:''}</div></div><div class="gear-list">${items.map(card).join('')}${addButton(key,custom?'项目':label)}</div></section>`;
  };
  const gems=c.items.filter(i=>i.slot==='gem'),customGems=gems.filter(i=>!M.gemGroup(i));
  const diamondOrder=['240983','240967','240969','240971'];
  const diamondRank=i=>{const rank=diamondOrder.indexOf(i.presetId);return rank<0?diamondOrder.length:rank;};
  const gemPanel=`<section class="slot-panel gem-panel" data-slot="gem"><div class="gem-groups">${M.gemGroups.map(group=>`<section class="gem-group" data-gem-group="${group}"><h4>${group}</h4><div class="gem-group-list">${gems.filter(i=>M.gemGroup(i)===group).sort((a,b)=>group==='钻石'?diamondRank(a)-diamondRank(b):0).map(card).join('')}<button class="add-item-row" data-add="gem" data-gem-target="${group}" ${disabled?'disabled':''}>＋ 新增自定义${group}</button></div>${group==='钻石'?`<div class="diamond-options"><label class="diamond-option"><input type="checkbox" id="always-use-diamond" ${c.alwaysUseDiamond!==false?'checked':''} ${disabled||!gems.some(i=>i.selected&&i.uniqueGroup)?'disabled':''}>始终使用</label><div class="diamond-suboption"><label class="diamond-option"><input type="checkbox" id="only-max-gem-colors" ${c.onlyMaxGemColors?'checked':''} ${disabled||!M.maxGemColorsAvailable(c)?'disabled':''}>尽量凑齐宝石颜色</label><span class="gem-color-help" tabindex="0" aria-label="宝石颜色说明" aria-describedby="gem-color-tooltip">?<span id="gem-color-tooltip" class="gem-color-tooltip" role="tooltip">尽量搭配不同颜色的宝石，让钻石获得更多颜色加成。孔位不够时，能凑几种颜色就凑几种；只计算颜色种类最多的搭配。</span></span></div></div>`:''}</section>`).join('')}</div>${customGems.length?`<div class="custom-gems"><h4>自定义 / 待补全宝石</h4><div class="custom-gem-list">${customGems.map(card).join('')}</div></div>`:''}</section>`;
  const enchantOrder=['avoidance','leech','speed'];
  const enchantRank=i=>{const rank=enchantOrder.findIndex(stat=>i.stats?.[stat]>0);return rank<0?enchantOrder.length:rank;};
  const enchantPanel=`<section class="slot-panel enchant-panel" data-slot="enchant"><p class="hint">按部位选择候选，每件适用装备使用一种。同一种附魔可用于两枚戒指或双持武器；触发效果单独显示。</p><div class="enchant-groups">${M.enchantSlots.map(([key,label])=>`<section class="enchant-group" data-enchant-group="${key}"><h4>${label}</h4><div class="gear-list">${c.items.filter(i=>i.slot==='enchant'&&i.enchantSlot===key).sort((a,b)=>['head','shoulders','feet'].includes(key)?enchantRank(a)-enchantRank(b):0).map(card).join('')}<button class="add-item-row" data-add="enchant" data-enchant-target="${key}" ${disabled?'disabled':''}>＋ 新增自定义附魔</button></div></section>`).join('')}</div></section>`;
  const specs=M.getSlots(c);
  $('#slots').innerHTML=specs.filter(([k])=>!isUsage(k)).map(panel).join('');
  fitLockButtons();
  $('#enchant-slots').innerHTML=enchantPanel;$('#gem-slots').innerHTML=gemPanel;
  $('#consumable-slots').innerHTML=`<div class="consumables-row">${['food','flask'].map(k=>panel(specs.find(([s])=>s===k))).join('')}</div>`;
  $('#custom-slots').innerHTML=specs.filter(([k])=>k.startsWith('custom_')).map(panel).join('')+`<button class="add-slot-panel" id="new-slot" ${disabled?'disabled':''}>＋ 新增自定义栏位</button>`;
  colorCustomTags();renderCombinations();window.workspaceUI?.renderCategories();window.searchUI?.invalidate();
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
  editing={characterId:c.id,item:item?structuredClone(item):{id:M.id(),slot,origin:'custom',source:'custom',selected:true,name:'',ilevel:0,mainType:c.mainType,adaptiveMain:!M.detailSlot(slot),socketCount:0,enchantSlot:target||'head',stats:Object.fromEntries(M.itemStats.map(([k])=>[k,0])),socket:false,embellishment:false,set:false}};
  if(!item&&slot==='gem'&&M.gemGroups.includes(target)){
    editing.item.gemGroup=target;
    if(target==='钻石')editing.item.uniqueGroup=M.presets.items.find(i=>i.slot==='gem'&&i.uniqueGroup).uniqueGroup;
  }
  editing.tagNames=M.tagColumns(c).map(([,name])=>name);
  const i=editing.item;
  $('#editor-title').textContent=`${item?'编辑项目':'新增项目'} · ${slot==='gem'?(M.gemGroup(i)||spec[1]):spec[1]}`;
  $('#editor-source').textContent=(i.presetId?'':i.origin==='custom'?'自定义':'导入项目')+(i.itemId?` · 物品 ID ${i.itemId}`:'')+(i.unresolved?' · 请填写属性，保存后用于计算':'');
  $('#delete-item').hidden=!(item&&i.origin==='custom'&&i.source==='custom');
  const usage=!M.detailSlot(slot);
  $('#item-set').closest('label').hidden=false;
  $('#item-set').disabled=false;
  $('#set-group-field').hidden=false;
  $('#item-set-group').value=i.setGroup||(i.setId>0?String(i.setId):'');
  $('#item-level').closest('label').hidden=usage;$('#item-level').disabled=usage;
  $('#item-type').closest('label').hidden=usage;$('#item-flags').hidden=usage;
  $('#enchant-target-field').hidden=slot!=='enchant';
  $('#enchant-target').innerHTML=M.enchantSlots.map(([key,label])=>`<option value="${key}">${label}</option>`).join('');
  $('#enchant-target').value=i.enchantSlot||'head';
  $('#editor-description').hidden=!usage;
  $('#editor-description').textContent=usage?'填写此项目提供的固定属性，未提供的属性填 0。':'';
  const statField=key=>{const label=M.itemStats.find(([k])=>k===key)[1];return `<label>${label}<input id="item-${key}" type="number" min="0" max="10000000" step="1" required></label>`;};
  $('#item-stats').innerHTML=[['stamina','armor','main'],['crit','haste','mastery','versatility'],['avoidance','leech','speed']].map(keys=>`<div class="item-stat-column">${keys.map(statField).join('')}</div>`).join('');
  $('#item-sockets').value=i.socketCount??(i.socket?1:0);$('#socket-fields').hidden=!M.detailSlot(slot);
  $('#item-name').value=i.name;$('#item-level').value=i.ilevel||'';$('#item-type').value=i.mainType;
  for(const [k] of M.itemStats)$('#item-'+k).value=i.stats[k]||0;
  for(const flag of ['socket','embellishment','set'])$('#item-'+flag).checked=!!i[flag];
  renderItemTags();$('#item-tag-name').value='';$('#item-tag-error').textContent='';
  $('#edit-error').textContent='';$('#editor').showModal();$('#item-name').focus();
}
$('#app').addEventListener('click',e=>{
  if(!e.target.closest('[data-item-region]'))return;
  if(current().id===importingId)return;
  const lock=e.target.closest('[data-lock]'),add=e.target.closest('[data-add]'),button=e.target.closest('[data-item]'),renameSlot=e.target.closest('[data-rename-slot]'),deleteSlot=e.target.closest('[data-delete-slot]');
  if(lock){try{M.toggleLock(current(),current().items.find(i=>i.id===lock.dataset.lock));renderGear();save();}catch(err){toast(err.message);}}
  else if(e.target.closest('#new-slot'))openSlotDialog();
  else if(renameSlot)openSlotDialog(renameSlot.dataset.renameSlot);
  else if(deleteSlot){const c=current(),key=deleteSlot.dataset.deleteSlot,slot=c.customSlots.find(s=>s.id===key);if(!slot||!confirm(`确定删除栏位“${slot.name}”及其中的所有项目吗？`))return;try{M.removeSlot(c,key);renderGear();save();}catch(err){toast(err.message);}}
  else if(add)openEditor(add.dataset.add,null,add.dataset.enchantTarget||add.dataset.gemTarget);
  else if(button){const i=current().items.find(i=>i.id===button.dataset.item);if(i){try{M.toggleSelected(current(),i);renderGear();save();}catch(err){toast(err.message);}}}
});
$('#gem-slots').addEventListener('change',e=>{
  const field={'always-use-diamond':'alwaysUseDiamond','only-max-gem-colors':'onlyMaxGemColors'}[e.target.id];
  if(!field||current().id===importingId)return;
  current()[field]=e.target.checked;renderGear();save();
});
$('#app').addEventListener('contextmenu',e=>{
  if(!e.target.closest('[data-item-region]'))return;
  const entry=e.target.closest('[data-entry]');if(!entry)return;e.preventDefault();
  const item=current().items.find(i=>i.id===entry.dataset.entry);if(item)openEditor(item.slot,item);
});
function colorCustomTags(root=document,c=current()){for(const node of root.querySelectorAll('[data-custom-tag],[data-count-tag]'))node.style.color=node.dataset.countTag?M.presetTagColors[node.dataset.countTag]:M.tagColor(c,node.dataset.customTag);}
function renderItemTags(){
  const tags=editing.item.customTags||[];
  $('#item-custom-tags').innerHTML=editing.tagNames.map((name,n)=>`<span class="custom-tag-chip"><label class="custom-tag" data-custom-tag="${escape(name)}"><input type="checkbox" data-item-tag="${n}" ${tags.includes(name)?'checked':''}>${escape(name)}</label><button type="button" data-remove-item-tag="${n}" aria-label="删除标签 ${escape(name)}" title="从所有装备删除此标签">×</button></span>`).join('');
  $('#item-tag-suggestions').innerHTML='';colorCustomTags($('#item-custom-tags'),{...current(),customTagNames:editing.tagNames});
}
function addItemTag(){
  const name=$('#item-tag-name').value.trim(),tags=editing.item.customTags||[];
  let error='';
  if(!name)error='请输入标签名称';
  else if(name.length>40)error='标签最多 40 个字';
  else if(editing.tagNames.includes(name))error='已添加此标签，请直接勾选';
  else if(editing.tagNames.length>=200)error='最多添加 200 个标签';
  else if(tags.length>=20)error='每件装备最多 20 个标签';
  else if([...M.itemStats.map(([,label])=>label),'套装','美化','带美化','带孔'].includes(name))error='请使用与预设属性不同的标签名称';
  $('#item-tag-error').textContent=error;if(error)return false;
  editing.tagNames.push(name);editing.item.customTags=[...tags,name];$('#item-tag-name').value='';renderItemTags();return true;
}
$('#add-item-tag').addEventListener('click',addItemTag);
$('#item-tag-name').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addItemTag();}});
$('#item-custom-tags').addEventListener('click',e=>{const button=e.target.closest('[data-remove-item-tag]');if(!button)return;const [name]=editing.tagNames.splice(Number(button.dataset.removeItemTag),1);editing.item.customTags=(editing.item.customTags||[]).filter(tag=>tag!==name);$('#item-tag-error').textContent='';renderItemTags();});
$('#item-custom-tags').addEventListener('change',e=>{if(!e.target.matches('[data-item-tag]'))return;const name=editing.tagNames[Number(e.target.dataset.itemTag)],tags=new Set(editing.item.customTags||[]);if(e.target.checked&&tags.size>=20){e.target.checked=false;$('#item-tag-error').textContent='每件装备最多 20 个标签';return;}if(e.target.checked)tags.add(name);else tags.delete(name);editing.item.customTags=[...tags];$('#item-tag-error').textContent='';});
$('#edit-form').addEventListener('submit',e=>{
  e.preventDefault();const c=state.characters.find(c=>c.id===editing.characterId),i=editing.item;
  if(M.detailSlot(i.slot)&&$('#item-tag-name').value.trim()&&!addItemTag())return;
  i.name=$('#item-name').value.trim();i.ilevel=Number($('#item-level').value);i.mainType=$('#item-type').value;
  for(const [k] of M.itemStats)i.stats[k]=Number($('#item-'+k).value);
  for(const flag of ['socket','embellishment','set'])i[flag]=$('#item-'+flag).checked;
  if(!M.detailSlot(i.slot)){i.ilevel=0;i.adaptiveMain=!i.supportedMainTypes?.length;i.socket=false;i.socketCount=0;i.embellishment=false;i.boe=false;i.set=false;}
  if(i.slot==='enchant')i.enchantSlot=$('#enchant-target').value;
  if(M.detailSlot(i.slot)){i.adaptiveMain=false;i.socketCount=i.socket?Number($('#item-sockets').value)||1:0;}
  i.setGroup=i.set?$('#item-set-group').value.trim():'';
  if(i.set&&!i.setGroup){$('#edit-error').textContent='请填写套装编号或分组，同一套装使用相同值。';return;}
  i.unresolved=false;
  if(!i.name){$('#edit-error').textContent='请输入名称。';return;}
  const draft=structuredClone(state);
  try{const target=draft.characters.find(n=>n.id===c.id);M.setCustomTagNames(target,editing.tagNames);M.upsert(target,i);M.validateState(draft);}catch(err){$('#edit-error').textContent=err.message;return;}
  state=draft;$('#editor').close();window.searchUI?.renderSettings();renderGear();save();
});
$('#delete-item').addEventListener('click',()=>{
  const c=state.characters.find(c=>c.id===editing.characterId),item=c?.items.find(i=>i.id===editing.item.id);
  if(!item||!confirm(`确定删除“${item.name}”吗？`))return;
  try{M.removeCustomItem(c,item.id);$('#editor').close();renderGear();save();}
  catch(err){$('#edit-error').textContent=err.message;}
});
$('#usage-open').addEventListener('click',()=>$('#usage-dialog').showModal());
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.close).close()));
function renameCharacter(id,value){
  const c=state.characters.find(c=>c.id===id),name=value.trim();
  if(!c||!name||name.length>80)return false;
  if(c.name!==name){c.name=name;c.renamed=true;save();}
  if(current().id===id)$('#character-name').value=c.name;
  return true;
}
function rename(id){
  const button=[...$('#tabs').querySelectorAll('[data-tab]')].find(b=>b.dataset.tab===id),c=state.characters.find(c=>c.id===id);
  if(!button||!c)return;
  const input=document.createElement('input');input.className='tab-rename';input.value=c.name;input.maxLength=80;input.setAttribute('aria-label','重命名角色');button.replaceWith(input);
  let done=false;
  const finish=(commit,defer=false)=>{if(done)return;done=true;if(commit)renameCharacter(id,input.value);if(defer)requestAnimationFrame(tabs);else tabs();};
  input.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key==='Escape'){e.preventDefault();e.stopPropagation();finish(e.key==='Enter');}});
  input.addEventListener('blur',()=>finish(true,true));input.focus();input.select();
}
$('#character-name').addEventListener('change',()=>{renameCharacter(current().id,$('#character-name').value);$('#character-name').value=current().name;tabs();});
$('#character-name').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#character-name').blur();}if(e.key==='Escape'){e.preventDefault();$('#character-name').value=current().name;$('#character-name').blur();}});
$('#tabs').addEventListener('click',e=>{
  const close=e.target.closest('[data-close-tab]');
  if(close){M.closeCharacter(state,close.dataset.closeTab);render();save();toast('角色已关闭，可按 Ctrl+Shift+T 恢复');return;}
  const t=e.target.closest('[data-tab]');if(!t||t.dataset.tab===state.activeId)return;state.activeId=t.dataset.tab;render();save();
});
window.addEventListener('keydown',e=>{if(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==='t'){e.preventDefault();if(M.reopenCharacter(state)){render();save();}}});
$('#tabs').addEventListener('dblclick',e=>{const t=e.target.closest('[data-tab]');if(t)rename(t.dataset.tab);});
$('#new-tab').addEventListener('click',()=>{if(state.characters.length>=100){$('#save-status').textContent='最多可创建 100 个角色';return;}const c=M.newCharacter(`角色 ${state.characters.length+1}`);state.characters.push(c);state.activeId=c.id;render();save();});
$('#base-stats').addEventListener('input',e=>{
  const percent=e.target.dataset.basePercent;
  if(percent){const value=e.target.value;current().basePercents??={};current().basePercents[percent]=value!==''&&e.target.validity.valid?Number(value):null;save();return;}
  if(!e.target.dataset.stat)return;
  const value=e.target.value;
  M.editDisplayedStat(current(),e.target.dataset.stat,value!==''&&e.target.validity.valid?Number(value):null);
  save();
});
async function updateCharacterProfile(choice={},traitChange=null){
  if(importingId)return;
  const c=current(),draft=structuredClone(c),old=c.attributeContext||{};
  const cls=choice.class||old.class||'warrior',spec=choice.spec||old.spec||M.classes[cls][0],race=choice.race||old.race||'human';
  const changed=cls!==old.class||spec!==old.spec;
  if(traitChange)M.toggleTrait(draft,traitChange.id,traitChange.enabled);
  const profile={class:cls,spec,race,level:old.level||90,disabledTraits:changed?[]:draft.disabledTraits||[],enabledTraits:changed?[]:draft.enabledTraits||[],fast:true,characterState:choice.characterState??(changed?'auto':c.characterState??'auto')};
  const input=`${cls}="Profile"\nlevel=${profile.level}\nrace=${race}\nspec=${spec}\ntalents=${changed?'':old.talents||''}\n`;
  importingId=c.id;render();
  try{
    const result=await window.simc.parse(input,profile);
    if(result.code===1||!result.gear?.baseStats)throw Error(result.report||'状态计算失败');
    const target=state.characters.find(t=>t.id===c.id)||state.closedCharacters?.find(t=>t.id===c.id);if(!target)return;
    if(!changed)for(const t of result.gear.traits){const previous=c.traits?.find(old=>old.id===t.id);if(previous&&!t.enabled&&previous.rank===t.rank)t.spellEffects=previous.spellEffects;}
    M.applyCharacterState(target,result.gear);
    target.disabledTraits=profile.disabledTraits;target.enabledTraits=profile.enabledTraits;

  }catch(e){toast('计算失败，已保留原有属性：'+e.message);}
  finally{importingId=null;render();save();}
}
$('#profile-class').addEventListener('change',()=>{const cls=$('#profile-class').value;if(M.classes[cls])updateCharacterProfile({class:cls,spec:M.classes[cls][0]});});
$('#profile-race').addEventListener('change',()=>updateCharacterProfile({race:$('#profile-race').value}));
$('#profile-spec').addEventListener('change',()=>updateCharacterProfile({spec:$('#profile-spec').value}));
$('#profile-traits').addEventListener('change',e=>{if(e.target.dataset.profileState){updateCharacterProfile({characterState:e.target.checked?e.target.dataset.profileState:'none'});return;}const id=Number(e.target.dataset.trait);if(current().traits?.some(t=>t.id===id))updateCharacterProfile({}, {id,enabled:e.target.checked});});
$('#input').addEventListener('input',()=>{current().input=$('#input').value;save();});
$('#parse').addEventListener('click',async()=>{
  const c=current();c.input=$('#input').value;importingId=c.id;render();save();
  try {
    const inputClass=c.input.match(/^(warrior|paladin|hunter|rogue|priest|death_knight|deathknight|shaman|mage|warlock|monk|druid|demon_hunter|demonhunter|evoker)\s*=/m)?.[1],inputSpec=c.input.match(/^spec\s*=\s*(\w+)/m)?.[1];
    const sameProfile=inputClass===c.attributeContext?.class&&inputSpec===c.attributeContext?.spec;
    const importText=c.input.replace(/^# wgm_state=.*$/gm,'')+'\n# wgm_state='+(sameProfile?c.characterState??'auto':'auto')+'\n';
    const result=await window.simc.parse(importText),target=state.characters.find(t=>t.id===c.id)||state.closedCharacters?.find(t=>t.id===c.id);
    if(!target)return;
    if(result.code===1 || !result.gear?.baseStats) {target.report=result.report;target.importInfo='导入失败，原有装备和基础属性已保留。';target.importWarning=true;}
    else {M.applyImport(target,result.gear,result.report);target.importWarning=result.code!==0||result.gear.warnings.length>0;if(target.importWarning)target.importInfo+=' 部分装备或版本信息需核对。';}
    toast(target.importInfo);
  }catch(e){const target=state.characters.find(t=>t.id===c.id)||state.closedCharacters?.find(t=>t.id===c.id);if(target){target.report=e.message;target.importInfo='导入失败，原有装备和基础属性已保留。';target.importWarning=true;toast(target.importInfo);}}
  finally{importingId=null;render();save();}
});
$('#rating-rules-open').addEventListener('click',()=>$('#rating-rules-dialog').showModal());
$('#rating-rules').addEventListener('change',e=>{
  const key=e.target.dataset.ratingRatio;if(!key)return;
  const value=Number(e.target.value);
  if(!e.target.value||!Number.isFinite(value)||value<=0||value>1000000){e.target.setAttribute('aria-invalid','true');return;}
  const c=current();c.ratingOverrides??={};c.ratingOverrides[key]=value;
  $('#rating-rules').innerHTML=renderRatingRules(c,c.attributeContext?.class||'warrior',c.attributeContext?.spec||'arms');
  window.searchUI?.renderSettings();save();
});
$('#rating-rules').addEventListener('click',e=>{
  const key=e.target.closest('[data-reset-rating]')?.dataset.resetRating,all=e.target.closest('#reset-all-ratings');
  if(!key&&!all)return;
  const c=current();if(all)delete c.ratingOverrides;else delete c.ratingOverrides?.[key];
  $('#rating-rules').innerHTML=renderRatingRules(c,c.attributeContext?.class||'warrior',c.attributeContext?.spec||'arms');
  window.searchUI?.renderSettings();save();
});
(async()=>{
  try {state=await window.simc.load()||M.newState();M.validateState(state);$('#app').hidden=false;$('#new-tab').disabled=false;render();await save();}
  catch(e){$('#save-status').textContent=e.message;$('#save-status').className='error';}
})();
