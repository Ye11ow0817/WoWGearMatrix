'use strict';
(()=>{
 const S=window.GearSearch,records=new Map(),errors=new Map();let exporting=false,running=null,renderedData=null,renderedId=null,renderedColumns=null,boundsKey=null,bounds={};
 const Rating=window.RatingConversion;let inputError=false;
 const tagClass=key=>({tier:'tier-tag',embellishment:'embellishment-tag',embellishments:'embellishment-tag'})[key]||(key.startsWith('tag:')?'custom-tag':'');
 const tagStyle=(c,key)=>key.startsWith('tag:')?` data-custom-tag="${escape(decodeURIComponent(key.slice(4)))}"`:M.presetTagColors[key]?` data-count-tag="${key}"`:'';
 const countColumns=(c=current())=>[['sockets','孔数量'],['tier','套装数量'],['embellishments','美化数量'],...M.tagColumns(c).map(([key,name])=>[key,name+'数量'])];
 const countDefs=(c=current())=>[['sockets','孔'],['tier','套装'],['embellishment','美化'],...M.tagColumns(c)];
 const countKeys=()=>countDefs().map(([key])=>key);
 const countInput=(key,bound)=>document.getElementById(`filter-${key}-${bound}`);
 const formulaColumns=c=>S.sortRules(c).flatMap((rule,index)=>rule.type==='formula'?[[`formula-${index}`,ruleLabel(rule,c),index]]:[]);
 const columnDefs=(c,formulaSource=records.get(c.id)?.snapshot||c)=>[...M.itemStats,['sockets','孔'],['tier','套装'],['embellishments','美化'],...M.tagColumns(c),...formulaColumns(formulaSource),...window.ResultExport.slotColumns(c)];
 const defaultColumns=c=>[...M.stats.map(([k])=>k),'sockets','tier','embellishments',...M.tagColumns(c).map(([key])=>key)];
 const visibleColumns=c=>{const selected=new Set(Array.isArray(c.resultColumns)?c.resultColumns:defaultColumns(c)),automatic=new Set(window.ResultExport.defaultSlotColumns(c));return columnDefs(c).filter(([k,label,index])=>index!==undefined?(c.resultFormulaVisibility?.[label]??true):k.startsWith('slot:')?(c.resultSlotVisibility?.[k]??automatic.has(k)):selected.has(k));};
 let renderedChoices=null;
 function renderColumnChoices(){const c=current(),selected=new Set(visibleColumns(c).map(([k])=>k)),defs=columnDefs(c),groups=window.ResultExport.slotGroups(c),key=JSON.stringify([c.id,defs,[...selected]]);if(renderedChoices===key)return;renderedChoices=key;
  const choices=entries=>entries.map(([k,label])=>`<label class="${tagClass(k)}"${tagStyle(c,k)}><input type="checkbox" data-result-column="${escape(k)}" ${selected.has(k)?'checked':''}>${escape(label)}</label>`).join('');
  $('#result-column-options').innerHTML=`<fieldset class="result-column-options"><legend>属性</legend><div class="result-stat-choices">${choices(defs.slice(0,M.itemStats.length))}</div><div class="result-count-choices">${choices(defs.slice(M.itemStats.length).filter(([k])=>!k.startsWith('slot:')))}</div></fieldset>${[['equipment','装备'],['enchants','附魔'],['usage','宝石和消耗品']].map(([group,label])=>`<fieldset class="result-column-options result-slot-choices" data-slot-group="${group}"><legend>${label}</legend><div class="result-slot-choice-list">${choices(groups[group])}</div></fieldset>`).join('')}`;colorCustomTags($('#result-column-options'),c);
 }
 const statText=(c,row,key)=>{const value=format(row.stats[key]);if(!$('#result-percent').checked||!Rating.keys.includes(key))return value;const percent=Rating.toSheetPercent(c,key,row.stats[key]);return `${value} (${percent===null?'—':percent.toFixed(2)}%)`;};
 const loadoutCache=new WeakMap();
 const slotText=(c,row,key)=>{if(!loadoutCache.has(row))loadoutCache.set(row,window.ResultExport.slotValues(c,row));return loadoutCache.get(row)[key]||'-';};
 const cellText=(c,row,key,formulaIndex)=>formulaIndex===undefined?(key.startsWith('slot:')?slotText(c,row,key):key==='sockets'?`${row.sockets} 孔`:key.startsWith('tag:')?`${row.tagCounts?.[key]??0} 件`:key==='tier'||key==='embellishments'?`${row[key]} 件`:statText(c,row,key)):row.sortValues?.[formulaIndex]==null?'—':format(row.sortValues[formulaIndex]);
 const sourceKey=c=>JSON.stringify([c.items,c.customTagNames,c.baseStats,c.basePercents,c.rawBaseStats,c.attributeFactors,c.attributeResponse,c.attributeContext,c.characterState,c.activeCharacterState,c.traits?.map(t=>[t.id,t.enabled,t.rank]),c.mainType,c.customSlots,c.alwaysUseDiamond,c.onlyMaxGemColors]);
 const defaults=c=>{const key=sourceKey(c);if(key!==boundsKey){boundsKey=key;bounds={...S.defaultRanges(c),countRanges:S.defaultCountRanges(c)};}return bounds;};
 const signature=c=>{let config;try{config=S.settings(c,defaults(c));}catch{config=[c.filters,c.sort];}return JSON.stringify([sourceKey(c),config,c.ratingOverrides]);};
 const formatPercent=(n,digits=1)=>n===null?'—':n.toFixed(digits);
 const differs=(value,initial)=>value!==undefined&&value!==null&&value!==''&&(initial===undefined||Number(value)!==initial);
 const countRange=(c,key)=>{const old=c.filters?.[key];return c.filters?.counts?.[key]??(key==='tier'?(old==null||old===''||Number(old)===0?{}:{min:old}):(old==null||old===''?{}:{min:old,max:old}));};
 function refreshInputs(){const c=current(),initial=defaults(c);for(const e of document.querySelectorAll('[data-range]')){const v=initial[e.dataset.range]?.[e.dataset.bound],pct=e.dataset.unit==='percent',display=pct&&v!==undefined?formatPercent(Rating.toSheetPercent(c,e.dataset.range,v),2):v;e.placeholder=display===undefined?'不限':String(display);e.title=v===undefined?'无可计算的初始范围':`初始值：${display}${pct?'%':''}`;e.classList.toggle('manual-value',e.value!=='');e.removeAttribute('aria-invalid');}for(const key of countKeys())for(const bound of ['min','max']){const e=countInput(key,bound),value=initial.countRanges[key][bound];e.placeholder=String(value);e.title=`当前候选组合的初始值：${value}`;e.classList.toggle('manual-value',e.value!=='');e.removeAttribute('aria-invalid');}let message='';try{S.settings(c,initial);}catch(error){message=error.message;}
 inputError=false;
 const showError=(node,text,fields)=>{node.textContent=text;node.hidden=!text;if(text){inputError=true;fields.forEach(e=>e.setAttribute('aria-invalid','true'));}};
 for(const [k]of M.itemStats){const r=c.filters?.ranges?.[k]||{},lo=r.min===''||r.min==null?initial[k]?.min:Number(r.min),hi=r.max===''||r.max==null?initial[k]?.max:Number(r.max),fields=[...document.querySelectorAll(`[data-range="${k}"]`)];let text='';
 if(fields.some(e=>e.validity.badInput)||[lo,hi].some(v=>v!==undefined&&(!Number.isFinite(v)||v<0||v>1e9)))text=fields.some(e=>e.dataset.unit==='percent'&&e.value!=='')?'数值或百分比超出可计算范围':'请输入 0–10亿 的数值';
 else if(lo>hi)text='最低值不能大于最高值';
 showError($(`[data-range-error="${k}"]`),text,fields);}
 for(const key of countKeys()){const r=countRange(c,key),fields=['min','max'].map(b=>countInput(key,b));let text='';if(fields.some(e=>e.validity.badInput)||['min','max'].some(b=>r[b]!==undefined&&r[b]!==null&&r[b]!==''&&(!Number.isInteger(Number(r[b]))||Number(r[b])<0||Number(r[b])>(key==='sockets'?1e9:16))))text=key==='sockets'?'请输入 0–10亿 的整数':'请输入 0–16 的整数';else if(r.min!==undefined&&r.min!==null&&r.min!==''&&r.max!==undefined&&r.max!==null&&r.max!==''&&Number(r.min)>Number(r.max))text=key==='sockets'?'最少孔数不能大于最多孔数':'最少件数不能大于最多件数';showError($(`[data-count-error="${key}"]`),text,fields);}
 for(const [k]of M.itemStats){const r=c.filters?.ranges?.[k]||{};$(`[data-reset-range="${k}"]`).hidden=!['min','max'].some(bound=>differs(r[bound],initial[k]?.[bound]));}
 for(const k of ['crit','haste','mastery','versatility']){const r=c.filters?.ranges?.[k]||{},maximum=r.max===''||r.max==null?initial[k]?.max:Number(r.max),threshold=Rating.curves.secondary[1][0]*Rating.perPercent(c,k),warning=$(`[data-diminishing-warning="${k}"]`);warning.hidden=!Number.isFinite(maximum)||maximum<threshold;warning.textContent=`范围达到副属性递减：${Number(threshold.toFixed(2))} 等级起（${k==='mastery'?'30 精通点':'30%'}），后续换算效率降低。`;}
 for(const key of countKeys()){const r=countRange(c,key);$(`[data-reset-count="${key}"]`).hidden=!['min','max'].some(bound=>differs(r[bound],initial.countRanges[key][bound]));}
 try{S.validateComparisons(c);$('#comparison-error').textContent='';}catch(error){$('#comparison-error').textContent=error.message;inputError=true;}
 $('#comparison-error').hidden=!$('#comparison-error').textContent;
 $('#reset-filters').hidden=!(c.filters?.comparisons?.length||document.querySelector('#filter-section [data-reset-range]:not([hidden]), #filter-section [data-reset-count]:not([hidden])'));
 return message;
 }
 const format=n=>Number.isInteger(n)?n.toLocaleString('zh-CN'):Number(n.toFixed(3)).toLocaleString('zh-CN');
 const count=n=>BigInt(n||0).toLocaleString('zh-CN');
 function stop(){if(!running)return;running.worker.terminate();const record=records.get(running.id);if(record)record.status='stopped';running=null;renderResults();}
 function invalidate(){if(!state)return;const c=current();if(running&&running.id!==c.id)stop();errors.delete(c.id);renderResults();}
 function renderComparisons(){
  const c=current(),rules=c.filters?.comparisons||[];
  const comparisonKeys=['crit','haste','mastery','versatility'];
  const options=(value)=>`<option value="">选择属性</option>`+M.itemStats.filter(([k])=>comparisonKeys.includes(k)||k===value).map(([k,label])=>`<option value="${k}" ${k===value?'selected':''} ${comparisonKeys.includes(k)?'':'disabled'}>${escape(k==='main'?M.types[c.mainType]:label)}${comparisonKeys.includes(k)?'':'（请更换）'}</option>`).join('');
  $('#comparison-rules').innerHTML=rules.map((r,n)=>`<div class="comparison-row" data-comparison-index="${n}"><select data-comparison-field="left" aria-label="第 ${n+1} 条比较左侧属性">${options(r.left)}</select><select data-comparison-field="operator" aria-label="第 ${n+1} 条比较符">${[['>','>'],['>=','≥'],['<','<'],['<=','≤'],['=','=']].map(([value,label])=>`<option value="${escape(value)}" ${r.operator===value?'selected':''}>${escape(label)}</option>`).join('')}</select><select data-comparison-field="right" aria-label="第 ${n+1} 条比较右侧属性">${options(r.right)}</select><select data-comparison-field="unit" aria-label="第 ${n+1} 条比较单位"><option value="value" ${r.unit==='value'?'selected':''}>等级</option><option value="percent" ${r.unit==='percent'?'selected':''} ${[r.left,r.right].every(k=>Rating.keys.includes(k))?'':'disabled'}>百分比</option></select><button type="button" class="sort-delete" data-delete-comparison aria-label="删除第 ${n+1} 条属性比较" title="删除属性比较"><span aria-hidden="true">−</span></button></div>`).join('');
  $('#comparison-hint').hidden=!rules.length;
 }
 function renderSettings(){if(!state)return;const c=current();c.filters??={};c.sort??={};
  if(c.resultSocketColumnVersion!==1){if(Array.isArray(c.resultColumns)&&!c.resultColumns.includes('sockets'))c.resultColumns.push('sockets');c.resultSocketColumnVersion=1;}
  renderComparisons();
  const groups=[['stamina','armor','main'],['crit','haste','mastery','versatility'],['avoidance','leech','speed']];
  $('#filter-ranges').innerHTML=groups.map((group,n)=>`<div class="filter-group"><h4>${['耐力、护甲、主属性','副属性','额外属性'][n]}</h4>${group.map(k=>{const label=k==='main'?M.types[c.mainType]:M.itemStats.find(([key])=>key===k)[1],r=c.filters.ranges?.[k]||{};return `<div class="filter-range"><div class="filter-range-heading"><span class="filter-stat-label">${escape(label)}</span><span class="filter-input-error" data-range-error="${k}" role="alert" hidden></span><button type="button" class="filter-reset" data-reset-range="${k}" hidden>重置</button></div><div class="filter-range-pair"><input type="number" min="0" max="1000000000" step="10" data-range="${k}" data-bound="min" value="${escape(r.min??'')}" placeholder="min" aria-label="${label}最低值"><span>～</span><input type="number" min="0" max="1000000000" step="10" data-range="${k}" data-bound="max" value="${escape(r.max??'')}" placeholder="max" aria-label="${label}最高值"></div>${n?`<div class="filter-range-pair percent-pair"><span class="percent-field"><input type="number" min="0" step="1" data-range="${k}" data-bound="min" data-unit="percent" value="${r.min===''||r.min==null?'':formatPercent(Rating.toSheetPercent(c,k,Number(r.min)))}" placeholder="min" aria-label="${label}最低百分比"><b>%</b></span><span>～</span><span class="percent-field"><input type="number" min="0" step="1" data-range="${k}" data-bound="max" data-unit="percent" value="${r.max===''||r.max==null?'':formatPercent(Rating.toSheetPercent(c,k,Number(r.max)))}" placeholder="max" aria-label="${label}最高百分比"><b>%</b></span></div>`:''}${n===1?`<p class="diminishing-warning" data-diminishing-warning="${k}" role="status" hidden></p>`:''}</div>`;}).join('')}</div>`).join('');
  $('#filter-section .search-options').innerHTML=countDefs(c).map(([key,label])=>`<div class="count-range"><div class="count-range-heading"><span class="${tagClass(key)}"${tagStyle(c,key)}>${escape(label)}数量</span><button type="button" class="filter-reset" data-reset-count="${escape(key)}" hidden>重置</button></div><div class="filter-range-pair"><input id="filter-${escape(key)}-min" data-count-key="${escape(key)}" data-bound="min" type="number" min="0" max="${key==='sockets'?1e9:16}" step="1" aria-label="${escape(label)}${key==='sockets'?'最少孔数':'最少件数'}"><span>～</span><input id="filter-${escape(key)}-max" data-count-key="${escape(key)}" data-bound="max" type="number" min="0" max="${key==='sockets'?1e9:16}" step="1" aria-label="${escape(label)}${key==='sockets'?'最多孔数':'最多件数'}"></div></div>`).join('');
  for(const key of countKeys()){const range=countRange(c,key);for(const bound of ['min','max'])countInput(key,bound).value=range[bound]??'';const heading=countInput(key,'min').closest('.count-range').querySelector('.count-range-heading');if(!heading.querySelector('[data-count-error]'))heading.insertAdjacentHTML('beforeend',`<span class="filter-input-error" data-count-error="${key}" role="alert" hidden></span>`);}
  for(const input of document.querySelectorAll('#filter-section input[type="number"]')){if(input.parentElement.classList.contains('filter-number-control'))continue;const control=document.createElement('span');control.className='filter-number-control';input.before(control);control.append(input);const label=input.getAttribute('aria-label')||'数值';control.insertAdjacentHTML('beforeend',`<span class="filter-step-buttons"><button type="button" data-filter-step="up" aria-label="${escape(label)}增加">▴</button><button type="button" data-filter-step="down" aria-label="${escape(label)}减少">▾</button></span>`);}
  colorCustomTags();renderSortRules();renderColumnChoices();$('#result-limit').value=c.sort.limit||100;$('#result-percent').checked=!!c.resultPercent;
  invalidate();
 }
 function renderResults(){if(!state)return;renderColumnChoices();const active=current(),record=records.get(active.id),c=record?.snapshot||active,validationError=refreshInputs(),dirty=!!record&&record.signature!==signature(active);$('#run-search').disabled=!!running||importingId===active.id;$('#stop-search').hidden=!running;$('#search-error').textContent=inputError?'':validationError||errors.get(active.id)||record?.error||'';for(const id of ['#search-dirty','#results-dirty']){$(id).hidden=!dirty;$(id).textContent='条件已变更，需要重新计算；保留上一次计算结果。';}
  for(const id of ['#export-results','#export-selected-results'])$(id).disabled=exporting||record?.status==='running'||!record?.data?.rows.length;
  const view=window.workspaceUI.view();updatePagination(record?.data?.rows.length||0);
  if(!record){$('#search-status').textContent='设置条件后点击“计算并筛选”。';$('#search-results').innerHTML='';renderedData=null;renderedId=null;return;}
  const data=record.data;const prefix={running:'正在计算',done:'计算完成',stopped:'已停止 · 仅为已检查部分的结果',error:'计算失败'}[record.status];
  $('#search-status').textContent=prefix+(data?(record.status==='done'?` · 共 ${count(data.matched)} 条${BigInt(data.matched)>BigInt(data.rows.length)?` · 保留 ${data.rows.length} 条`:''}`:` · 已检查 ${count(data.visited)} / ${count(data.total)} · 符合 ${count(data.matched)} · 保留 ${data.rows.length} 条`):'');
  if(!data){$('#search-results').innerHTML='';renderedData=null;renderedId=null;return;}
  const sortRules=S.sortRules(c);
  const columns=visibleColumns(active).map(([k,label,index])=>[k,k==='main'?M.types[c.mainType]:label,index]);
  const sortDirection=(key,formulaIndex)=>formulaIndex===undefined?sortRules.find(rule=>rule.type==='stat'&&rule.stat===key)?.direction:sortRules[formulaIndex]?.direction;
  const sortArrow=(key,formulaIndex)=>{const direction=sortDirection(key,formulaIndex);return direction==='asc'?'↑':direction==='desc'?'↓':'';};
  const headerWidth=(key,label,formulaIndex)=>measure.measureText(label).width+(sortArrow(key,formulaIndex)?40:0)+24;
  const columnKey=JSON.stringify([columns,sortRules,!!active.resultPercent,view.page,view.size]);
  if(renderedData===data&&renderedId===active.id&&renderedColumns===columnKey)return;
  const scroll=$('#search-results'),top=scroll.scrollTop,left=scroll.scrollLeft,focused=document.activeElement.closest?.('[data-row-index]')?.dataset.rowIndex;
  renderedData=data;renderedId=active.id;renderedColumns=columnKey;
  if(!data.rows.length){$('#search-results').innerHTML=`<p class="hint">${escape(data.missing?.join('；')||(record.status==='done'?'没有符合条件的组合，请放宽条件或增加候选。':'目前尚未找到符合条件的组合。'))}</p>`;return;}
  const byId=new Map(c.items.map(i=>[i.id,i])),labels=new Map(M.getSlots(c).map(([k,n])=>[k,n]));
  const itemText=(id,n=1)=>{const i=byId.get(id);return `${escape(i?.name||'未知项目')}${n>1?' × '+n:''}`;};
  const gearText=id=>{const i=byId.get(id);if(!i)return itemText(id);const details=[i.name,labels.get(i.slot)||i.slot,i.ilevel?`${i.ilevel} 装等`:null,...M.itemStats.filter(([key])=>i.stats?.[key]).map(([key,label])=>`${key==='main'?M.types[c.mainType]:label} ${format(i.stats[key])}`),i.socketCount?`${i.socketCount} 个插槽`:i.socket?'1 个插槽':null,i.set?'套装装备':null,i.embellishment?'美化装备':null,...(i.customTags||[]),i.effectNote||null].filter(Boolean);return `<span class="result-gear" tabindex="0" data-gear-tooltip="${escape(details.join('\n'))}">${itemText(id)}</span>`;};
  const detailText=id=>{const i=byId.get(id);if(!i)return itemText(id);const num=i.socket?Math.max(1,i.socketCount||1):0,icons=num?`<span class="socket-icons" aria-label="${num} 个空孔">${Array.from({length:num},()=>'<img src="../../assets/empty-prismatic-socket.png" alt="">').join('')}</span>`:'';const tags=[icons,i.set?'<span class="item-tag tier-tag">套装</span>':'',i.embellishment?'<span class="item-tag embellishment-tag">美化</span>':'',...(i.customTags||[]).map(name=>`<span class="item-tag custom-tag" data-custom-tag="${escape(name)}">${escape(name)}</span>`)].filter(Boolean);return `${gearText(id)}${M.detailSlot(i.slot)?' · '+(i.ilevel||'-'):''}${tags.length?' · '+tags.join(' · '):''}`;};
  const gemCandidates=c.items.filter(i=>i.slot==='gem'&&i.selected),diamonds=gemCandidates.filter(i=>i.uniqueGroup),ordinaryGems=gemCandidates.filter(i=>!i.uniqueGroup),fixedGemSockets=new Map();
  const fixedGems=sockets=>{
   if(!fixedGemSockets.has(sockets)){
    const required=diamonds.length>0&&c.alwaysUseDiamond!==false;
    let diamondWays=0n,ordinaryWays=0n;
    for(const used of required?[1]:diamonds.length?[0,1]:[0]){
     if(sockets<used||sockets>used&&!ordinaryGems.length&&gemCandidates.length)continue;
     // Collapse diamond identities to count ordinary allocations independently.
     const items=[{slot:'head',selected:true,socketCount:sockets},...ordinaryGems,...(used?[diamonds[0]]:[])];
     const ways=M.combinationCount({...c,customSlots:[],alwaysUseDiamond:!!used,onlyMaxGemColors:required&&c.onlyMaxGemColors,items}).total;
     if(ways){diamondWays+=used?BigInt(diamonds.length):1n;ordinaryWays+=ways;}
    }
    fixedGemSockets.set(sockets,{diamond:diamondWays===1n,ordinary:ordinaryWays===1n});
   }
   return fixedGemSockets.get(sockets);
  };
  const detailSlots=M.getSlots(c).filter(([slot])=>!['gem','enchant'].includes(slot));
  const slotDetails=(row,group)=>detailSlots.filter(([slot])=>group==='equipment'?!M.usageSlot(slot):group==='custom'?slot.startsWith('custom_'):['food','flask'].includes(slot)).map(([slot,label,capacity])=>{
   const ids=(group==='equipment'?row.gear:row.consumables).filter(id=>byId.get(id)?.slot===slot),single=c.items.filter(i=>i.slot===slot&&i.selected).length<=capacity;
   return ids.length?ids.map(id=>`<li data-detail-slot="${escape(slot)}"${single?' class="result-part-fixed"':''}>${escape(label)}：${detailText(id)}</li>`).join(''):`<li data-detail-slot="${escape(slot)}" class="result-part-empty">${escape(label)}：-</li>`;
  }).join('');
  const measure=document.createElement('canvas').getContext('2d');measure.font='12px '+getComputedStyle($('#search-results')).fontFamily;
  const contentWidth=(row,key,index)=>Math.max(...cellText(c,row,key,index).split('\n').map(line=>measure.measureText(line).width))+24;
  const widths=[Math.max(52,measure.measureText(String(data.rows.length)).width+24),...columns.map(([key,label,index])=>{
   const measured=Math.max(52,index===undefined?headerWidth(key,label,index):Math.min(260,headerWidth(key,label,index)),data.rows.reduce((width,row)=>Math.max(width,contentWidth(row,key,index)),0));
   return Math.ceil(key.startsWith('slot:')?Math.min(240,measured):measured);
  })];
  $('#search-results').style.setProperty('--result-tracks',widths.map(n=>n+'px').join(' '));
  $('#search-results').style.setProperty('--result-min-width',(widths.reduce((sum,n)=>sum+n,0)+24)+'px');
  $('#search-results').innerHTML=`<div class="result-scroll"><div class="result-columns"><span>序号</span>${columns.map(([k,n,formulaIndex])=>`<span class="${tagClass(k)}"${tagStyle(c,k)} data-result-header="${escape(k)}"${formulaIndex===undefined?'':` title="${escape(n)}"`}><span class="result-header-label"><span class="result-header-text">${escape(n)}</span>${sortArrow(k,formulaIndex)?`<span class="sort-arrow" aria-label="${sortDirection(k,formulaIndex)==='asc'?'升序':'降序'}">${sortArrow(k,formulaIndex)}</span>`:''}</span></span>`).join('')}</div>${data.rows.slice((view.page-1)*view.size,view.page*view.size).map((row,index)=>{const n=(view.page-1)*view.size+index,customDetails=row.consumables.some(id=>byId.get(id)?.slot.startsWith('custom_'))?slotDetails(row,'custom'):'';return `<div class="result-entry"><button type="button" class="result-row" data-row-index="${n}" aria-expanded="${selectedRow===n&&!drawer.hidden}" aria-controls="result-drawer" aria-label="查看第 ${n+1} 条搭配"><span>${n+1}</span>${columns.map(([k,,formulaIndex])=>`<span class="${tagClass(k)}"${tagStyle(c,k)} data-result-cell="${escape(k)}">${k.startsWith('slot:')?escape(cellText(c,row,k,formulaIndex)):cellText(c,row,k,formulaIndex)}</span>`).join('')}</button><template data-detail="${n}"><div class="result-detail"><p class="result-all-stats">${M.itemStats.map(([k,label])=>`${escape(k==='main'?M.types[c.mainType]:label)} ${statText(c,row,k)}`).join(' · ')}</p><div class="result-count-summary">${[['sockets','孔'],['tier','套装'],['embellishments','美化'],...M.tagColumns(c)].map(([k,label])=>`<p class="result-all-stats ${tagClass(k)}"${tagStyle(c,k)}>${escape(label)}：${k.startsWith('tag:')?row.tagCounts?.[k]??0:row[k]} ${k==='sockets'?'孔':'件'}</p>`).join('')}</div><div class="result-parts"><section><h4>装备</h4><ul>${slotDetails(row,'equipment')}</ul></section><section><h4>宝石 · ${row.sockets} 孔</h4><ul>${row.gems.length?window.ResultExport.orderedGems(c,row).map(g=>`<li${fixedGems(row.sockets)[byId.get(g.id)?.uniqueGroup?'diamond':'ordinary']?' class="result-part-fixed"':''}>${itemText(g.id,g.count)}</li>`).join(''):'<li class="result-part-empty">-</li>'}</ul><h4>附魔</h4><ul>${row.enchants.length?row.enchants.map(e=>`<li${byId.has(e.target)&&M.enchantPool(c,byId.get(e.target)).length===1?' class="result-part-fixed"':''}>${escape(labels.get(byId.get(e.target)?.slot)||'未知部位')}：${itemText(e.id)}</li>`).join(''):'<li class="result-part-empty">-</li>'}</ul></section><section><h4>食物、合剂</h4><ul>${slotDetails(row,'consumables')}</ul></section>${customDetails?`<section><h4>自定义项目</h4><ul>${customDetails}</ul></section>`:''}</div></div></template></div>`;}).join('')}</div>`;
  colorCustomTags($('#search-results'),c);scroll.scrollTop=top;scroll.scrollLeft=left;if(focused!==undefined)scroll.querySelector(`[data-row-index="${focused}"]`)?.focus({preventScroll:true});
 }
 async function exportResults(all){
  const active=current(),record=records.get(active.id);if(exporting||record?.status==='running'||!record?.data?.rows.length)return;
  const c=record.snapshot,columns=(all?columnDefs(c,c):visibleColumns(active)).map(([k,label,index])=>[k,k==='main'?M.types[c.mainType]:label,index]);
  const table=window.ResultExport.table(c,record.data.rows,columns,{all,percent:all||!!active.resultPercent});
  const date=new Date(),stamp=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0'),String(date.getHours()).padStart(2,'0'),String(date.getMinutes()).padStart(2,'0')].join('');
  exporting=true;renderResults();
  try{const result=await window.simc.exportResults(table,`${active.name||'角色'}-${stamp}`);if(!result.canceled)toast(`已导出 ${record.data.rows.length} 条结果`);}
  catch(error){toast('导出失败：'+error.message);}
  finally{exporting=false;renderResults();}
 }
 $('#export-results').addEventListener('click',()=>exportResults(true));
 $('#export-selected-results').addEventListener('click',()=>exportResults(false));
 const gearTooltip=document.createElement('div');gearTooltip.id='result-gear-tooltip';gearTooltip.className='result-gear-tooltip';gearTooltip.setAttribute('role','tooltip');gearTooltip.hidden=true;document.body.append(gearTooltip);
 let tooltipTarget=null;
 function hideGearTooltip(){tooltipTarget?.removeAttribute('aria-describedby');tooltipTarget=null;gearTooltip.hidden=true;}
 function showGearTooltip(target){
  hideGearTooltip();tooltipTarget=target;target.setAttribute('aria-describedby',gearTooltip.id);gearTooltip.textContent=target.dataset.gearTooltip;gearTooltip.hidden=false;
  const anchor=target.getBoundingClientRect(),box=gearTooltip.getBoundingClientRect(),gap=8;
  gearTooltip.style.left=Math.max(gap,Math.min(anchor.left,innerWidth-box.width-gap))+'px';
  gearTooltip.style.top=Math.max(gap,Math.min(anchor.bottom+gap+box.height<=innerHeight?anchor.bottom+gap:anchor.top-box.height-gap,innerHeight-box.height-gap))+'px';
 }
 const drawer=$('#result-drawer');
 drawer.addEventListener('pointerover',e=>{const target=e.target.closest('[data-gear-tooltip]');if(target&&target!==tooltipTarget)showGearTooltip(target);});
 drawer.addEventListener('pointerout',e=>{if(tooltipTarget&&!tooltipTarget.contains(e.relatedTarget))hideGearTooltip();});
 drawer.addEventListener('focusin',e=>{const target=e.target.closest('[data-gear-tooltip]');if(target)showGearTooltip(target);});
 drawer.addEventListener('focusout',()=>hideGearTooltip());
 document.addEventListener('scroll',()=>{if(tooltipTarget&&document.activeElement===tooltipTarget)showGearTooltip(tooltipTarget);else hideGearTooltip();},true);
 window.addEventListener('resize',()=>hideGearTooltip());window.addEventListener('blur',()=>hideGearTooltip());
 let selectedRow=null;
 function closeDrawer(focus=true){hideGearTooltip();$('#search-results').querySelector('[aria-expanded="true"]')?.setAttribute('aria-expanded','false');$('#result-drawer').hidden=true;if(focus&&selectedRow!==null)$('#search-results').querySelector(`[data-row-index="${selectedRow}"]`)?.focus({preventScroll:true});selectedRow=null;}
 $('#drawer-close').addEventListener('click',()=>closeDrawer());
 $('#result-drawer').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeDrawer();}});
 $('#search-results').addEventListener('click',e=>{const row=e.target.closest('[data-row-index]');if(!row)return;$('#search-results').querySelector('[aria-expanded="true"]')?.setAttribute('aria-expanded','false');row.setAttribute('aria-expanded','true');selectedRow=Number(row.dataset.rowIndex);$('#drawer-title').textContent=`第 ${selectedRow+1} 条搭配`;$('#drawer-content').replaceChildren(row.nextElementSibling.content.cloneNode(true));colorCustomTags($('#drawer-content'),records.get(current().id)?.snapshot||current());$('#result-drawer').hidden=false;$('#drawer-close').focus({preventScroll:true});});
 function updatePagination(length){const v=window.workspaceUI.view(),pages=Math.max(1,Math.ceil(length/v.size));v.page=Math.min(v.page,pages);$('#page-size').value=v.size;$('#page-info').textContent=`${v.page} / ${pages} 页 · ${length} 条`;if(document.activeElement!==$('#page-number'))$('#page-number').value=v.page;$('#page-number').max=pages;$('#page-prev').disabled=v.page<=1;$('#page-next').disabled=v.page>=pages;}
 function changePage(page){const v=window.workspaceUI.view(),length=records.get(current().id)?.data?.rows.length||0;v.page=Math.max(1,Math.min(Math.ceil(length/v.size)||1,page));closeDrawer(false);$('#search-results').scrollTop=0;v.scroll.results=[0,$('#search-results').scrollLeft];renderResults();}
 $('#page-prev').addEventListener('click',()=>changePage(window.workspaceUI.view().page-1));
 $('#page-next').addEventListener('click',()=>changePage(window.workspaceUI.view().page+1));
 $('#page-form').addEventListener('submit',e=>{e.preventDefault();changePage(Number($('#page-number').value)||1);});
 $('#page-size').addEventListener('change',()=>{const v=window.workspaceUI.view(),first=(v.page-1)*v.size;v.size=Number($('#page-size').value);changePage(Math.floor(first/v.size)+1);});
 let sortEdit=null,dragCharacterId=null;
 const statLabel=(k,c=current())=>k==='main'?M.types[c.mainType]:M.itemStats.find(([key])=>key===k)?.[1]||countColumns(c).find(([key])=>key===k)?.[1]||k;
 const formulaSigns={'+':'＋','-':'−','*':'×','/':'÷'};
 const ruleLabel=(r,c=current())=>r.type==='stat'?statLabel(r.stat,c):r.expression||`${statLabel(r.left,c)} ${formulaSigns[r.operator]} ${statLabel(r.right,c)}`;
 function renderSortRules(){
  const rules=S.sortRules(current());
  $('#sort-rules').innerHTML=rules.length?rules.map((r,n)=>`<div class="sort-card" data-sort-index="${n}" role="listitem"><button type="button" class="sort-handle" data-sort-drag aria-label="第 ${n+1} 条规则，拖动或按上下方向键调整优先级" title="拖动调整；也可使用上下方向键">≡</button><span class="sort-priority">${n+1}</span><button type="button" class="sort-card-edit" data-sort-edit aria-label="编辑第 ${n+1} 条规则：${escape(ruleLabel(r))}"><strong class="${r.type==='stat'?tagClass(r.stat):''}"${r.type==='stat'?tagStyle(current(),r.stat):''}>${escape(ruleLabel(r))}</strong><span>${r.direction==='asc'?'升序':'降序'}</span></button><button type="button" class="sort-delete" data-sort-delete aria-label="删除第 ${n+1} 条排序规则" title="删除排序规则"><span aria-hidden="true">−</span></button></div>`).join(''):'<p class="hint">暂无排序规则；组合按固定顺序排列。</p>';
  $('#sort-rules').setAttribute('role','list');colorCustomTags($('#sort-rules'));
 }
 function saveRules(rules){current().sort??={};current().sort.rules=rules;renderSortRules();save();}
 function openSortEditor(index=null){
  sortEdit={characterId:current().id,index};
  const r=index===null?{type:'stat',stat:'main',direction:'desc'}:S.sortRules(current())[index];
  const options=[...M.itemStats,...countColumns()].map(([k])=>`<option value="${escape(k)}" class="${tagClass(k)}"${tagStyle(current(),k)}>${escape(statLabel(k))}</option>`).join('');
  $('#sort-field').innerHTML=options+'<option value="formula">ƒ 自定义计算</option>';
  colorCustomTags($('#sort-field'));$('#sort-field').value=r.type==='stat'?r.stat:'formula';$('#sort-expression').value=index===null?'':r.expression||`${statLabel(r.left||'crit')}${formulaSigns[r.operator||'-']}${statLabel(r.right||'mastery')}`;$('#sort-direction').value=r.direction;colorSortField();
  $('#sort-formula').hidden=r.type!=='formula';$('#sort-error').textContent='';$('#sort-dialog-title').textContent=index===null?'添加排序规则':'编辑排序规则';$('#sort-dialog').showModal();$('#sort-field').focus();
 }
 function moveRule(from,to){
  const rules=[...S.sortRules(current())];if(from<0||to<0||from>=rules.length||to>=rules.length||from===to)return;
  rules.splice(to,0,rules.splice(from,1)[0]);saveRules(rules);$(`[data-sort-index="${to}"] [data-sort-drag]`).focus();
 }
 $('#add-sort-rule').addEventListener('click',()=>openSortEditor());
 const colorSortField=()=>{const key=$('#sort-field').value;$('#sort-field').style.color=key.startsWith('tag:')?M.tagColor(current(),decodeURIComponent(key.slice(4))):M.presetTagColors[key]||'';};
 $('#sort-field').addEventListener('change',()=>{$('#sort-formula').hidden=$('#sort-field').value!=='formula';colorSortField();});
 $('#sort-form').addEventListener('submit',e=>{
  e.preventDefault();if(!sortEdit||sortEdit.characterId!==current().id){$('#sort-dialog').close();return;}
  const field=$('#sort-field').value,direction=$('#sort-direction').value;
  const rule=field==='formula'?{type:'formula',expression:$('#sort-expression').value.trim(),direction}:{type:'stat',stat:field,direction};
  try{S.validateRules([rule],M.tagColumns(current()).map(([key])=>key));const rules=[...S.sortRules(current())];if(sortEdit.index===null)rules.push(rule);else rules[sortEdit.index]=rule;saveRules(rules);$('#sort-dialog').close();}catch(error){$('#sort-error').textContent=error.message;}
 });
 $('#sort-rules').addEventListener('click',e=>{const card=e.target.closest('[data-sort-index]');if(!card)return;const n=Number(card.dataset.sortIndex);if(e.target.closest('[data-sort-edit]'))openSortEditor(n);if(e.target.closest('[data-sort-delete]')){const rules=[...S.sortRules(current())];rules.splice(n,1);saveRules(rules);}});
 $('#sort-rules').addEventListener('keydown',e=>{if(!e.target.closest('[data-sort-drag]')||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const n=Number(e.target.closest('[data-sort-index]').dataset.sortIndex);moveRule(n,n+(e.key==='ArrowUp'?-1:1));});
 Sortable.create($('#sort-rules'),{
  handle:'[data-sort-drag]',draggable:'.sort-card',animation:180,forceFallback:true,fallbackOnBody:true,fallbackTolerance:3,
  ghostClass:'sort-ghost',chosenClass:'sort-chosen',fallbackClass:'sort-floating',
  onStart(){dragCharacterId=current().id;},
  onEnd({oldDraggableIndex,newDraggableIndex}){if(dragCharacterId===current().id)moveRule(oldDraggableIndex,newDraggableIndex);else renderSortRules();dragCharacterId=null;}
 });
 document.addEventListener('click',e=>{const panel=$('#result-display-options');if(panel.open&&!panel.contains(e.target))panel.open=false;});
 document.addEventListener('keydown',e=>{const panel=$('#result-display-options');if(e.key==='Escape'&&panel.open){panel.open=false;panel.querySelector('summary').focus({preventScroll:true});}});
 $('#result-column-options').addEventListener('change',e=>{if(!e.target.matches('[data-result-column]'))return;const key=e.target.dataset.resultColumn;if(key.startsWith('formula-')){const column=columnDefs(current()).find(([k])=>k===key);if(column){current().resultFormulaVisibility??={};current().resultFormulaVisibility[column[1]]=e.target.checked;}}if(key.startsWith('slot:')){current().resultSlotVisibility??={};current().resultSlotVisibility[key]=e.target.checked;}current().resultColumns=[...document.querySelectorAll('[data-result-column]:checked')].map(e=>e.dataset.resultColumn);save();});
 $('#result-percent').addEventListener('change',()=>{current().resultPercent=$('#result-percent').checked;save();});
 const stepDefault=(e,up,event)=>{const start=e.value===''?e.placeholder:e.value;if(e.validity.badInput||start.trim()===''||!Number.isFinite(Number(start)))return;event.preventDefault();e.focus();const step=Number(e.step)||1,min=e.min===''?-Infinity:Number(e.min),max=e.max===''?Infinity:Number(e.max);e.value=String(Number(Math.min(max,Math.max(min,Number(start)+(up?step:-step))).toFixed(10)));e.dispatchEvent(new Event('input',{bubbles:true}));};
 let wheelInput=null;
 $('#filter-section').addEventListener('pointerdown',event=>{wheelInput=event.button===0&&event.target.matches('input[type="number"]')?event.target:null;if(event.target.closest('[data-filter-step]'))event.preventDefault();});
 $('#filter-section').addEventListener('focusout',event=>{if(event.target===wheelInput)wheelInput=null;});
 $('#filter-section').addEventListener('click',event=>{const button=event.target.closest('[data-filter-step]');if(button)stepDefault(button.closest('.filter-number-control').querySelector('input'),button.dataset.filterStep==='up',event);});
 $('#filter-section').addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown'].includes(event.key)&&event.target.matches('input[type="number"]'))stepDefault(event.target,event.key==='ArrowUp',event);});
 $('#filter-section').addEventListener('wheel',event=>{const control=event.target.closest('.filter-number-control');if(!control||event.deltaY===0)return;const input=control.querySelector('input');if(input!==wheelInput||document.activeElement!==input){if(document.activeElement===input)event.preventDefault();return;}event.preventDefault();stepDefault(input,event.deltaY<0,event);},{passive:false});
 $('#filter-ranges').addEventListener('input',e=>{const k=e.target.dataset.range;if(!k)return;const c=current(),bound=e.target.dataset.bound,pct=e.target.dataset.unit==='percent';c.filters??={};c.filters.ranges??={};c.filters.ranges[k]??={};let value=e.target.validity.badInput?'无效数值':e.target.value;if(pct&&value!==''){const n=Rating.toSheetRating(c,k,value);value=n===null?'无效数值':String(bound==='min'?Math.ceil(n-1e-7):Math.floor(n+1e-7));}c.filters.ranges[k][bound]=value;const other=document.querySelector(`[data-range="${k}"][data-bound="${bound}"]${pct?':not([data-unit])':'[data-unit="percent"]'}`);if(other)other.value=value==='无效数值'?'':value===''?'':pct?value:formatPercent(Rating.toSheetPercent(c,k,Number(value)));save();});
 $('#filter-ranges').addEventListener('change',e=>{if(e.target.dataset.unit!=='percent'||e.target.value===''||e.target.validity.badInput)return;e.target.value=Number(e.target.value).toFixed(1);e.target.dispatchEvent(new Event('input',{bubbles:true}));});
 $('#filter-ranges').addEventListener('click',e=>{const key=e.target.closest('[data-reset-range]')?.dataset.resetRange;if(!key)return;delete current().filters.ranges?.[key];renderSettings();save();});
 $('#result-limit').addEventListener('change',()=>{current().sort??={};current().sort.limit=$('#result-limit').value;save();});
 const updateCount=e=>{const key=e.target.dataset.countKey;if(!key)return;const c=current();c.filters??={};c.filters.counts??={};c.filters.counts[key]??={};c.filters.counts[key][e.target.dataset.bound]=e.target.validity.badInput?'无效数值':e.target.value;delete c.filters[key];save();};
 $('#filter-section .search-options').addEventListener('input',updateCount);
 $('#filter-section .search-options').addEventListener('change',updateCount);
 $('#filter-section .search-options').addEventListener('click',e=>{const key=e.target.closest('[data-reset-count]')?.dataset.resetCount;if(!key)return;delete current().filters.counts?.[key];delete current().filters[key];renderSettings();save();});
 $('#reset-filters').addEventListener('click',()=>{current().filters={};renderSettings();save();});
 $('#add-comparison').addEventListener('click',()=>{const c=current();c.filters??={};c.filters.comparisons??=[];c.filters.comparisons.push({left:'',operator:'>=',right:'',unit:'value'});renderComparisons();save();$('#comparison-rules .comparison-row:last-child select').focus();});
 $('#comparison-rules').addEventListener('change',e=>{const field=e.target.dataset.comparisonField,row=e.target.closest('[data-comparison-index]');if(!field||!row)return;const n=Number(row.dataset.comparisonIndex),r=current().filters.comparisons[n];r[field]=e.target.value;if(r.unit==='percent'&&![r.left,r.right].every(k=>Rating.keys.includes(k)))r.unit='value';renderComparisons();save();$(`[data-comparison-index="${n}"] [data-comparison-field="${field}"]`).focus();});
 $('#comparison-rules').addEventListener('click',e=>{if(!e.target.closest('[data-delete-comparison]'))return;const n=Number(e.target.closest('[data-comparison-index]').dataset.comparisonIndex);current().filters.comparisons.splice(n,1);renderComparisons();save();});
 $('#stop-search').addEventListener('click',stop);
 $('#run-search').addEventListener('click',()=>{const c=current();try{S.validate(c);window.workspaceUI.newSearch();const snapshot=structuredClone(c),sig=signature(c);stop();const worker=new Worker('search-worker.js');errors.delete(c.id);records.set(c.id,{signature:sig,status:'running',snapshot});running={id:c.id,signature:sig,worker};renderResults();
  worker.onmessage=({data})=>{if(running?.worker!==worker)return;const record=records.get(c.id);if(data.type==='error'){record.status='error';record.error=data.message;worker.terminate();running=null;}else{record.data=data;if(data.done){record.status='done';worker.terminate();running=null;}}if(current().id===c.id)renderResults();};
  worker.onerror=e=>{if(running?.worker!==worker)return;records.set(c.id,{signature:sig,status:'error',snapshot,error:e.message||'后台计算失败'});worker.terminate();running=null;renderResults();};worker.postMessage(snapshot);
 }catch(error){errors.set(c.id,error.message);renderResults();}});
 window.searchUI={invalidate,renderSettings,stop,closeDrawer};if(state)renderSettings();
})();
