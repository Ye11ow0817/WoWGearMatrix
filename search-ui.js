'use strict';
(()=>{
 const S=window.GearSearch,records=new Map(),errors=new Map();let running=null,renderedData=null,renderedId=null,renderedColumns=null,boundsKey=null,bounds={};
 const Rating=window.RatingConversion;let inputError=false;
 const countColumns=[['tier','套装数量'],['embellishments','美化数量'],['boe','BOE 数量']];
 const columnDefs=[...M.itemStats,['tier','套装'],['embellishments','美化'],['boe','BOE']];
 const defaultColumns=[...M.stats.map(([k])=>k),'tier','embellishments'];
 const visibleColumns=c=>columnDefs.filter(([k])=>(Array.isArray(c.resultColumns)?c.resultColumns:defaultColumns).includes(k));
 function renderColumnChoices(){const selected=new Set(visibleColumns(current()).map(([k])=>k));$('#result-column-options').innerHTML=columnDefs.map(([k,label])=>`<label><input type="checkbox" data-result-column="${k}" ${selected.has(k)?'checked':''}>${label}</label>`).join('');}
 const statText=(c,row,key)=>{const value=format(row.stats[key]);if(!$('#result-percent').checked||!Rating.keys.includes(key))return value;const percent=Rating.toSheetPercent(c,key,row.stats[key]);return `${value}(${percent===null?'—':percent.toFixed(2)}%)`;};
 const cellText=(c,row,key,formulaIndex)=>formulaIndex===undefined?(key==='tier'||key==='embellishments'||key==='boe'?`${row[key]} 件`:statText(c,row,key)):row.sortValues?.[formulaIndex]==null?'—':format(row.sortValues[formulaIndex]);
 const sourceKey=c=>JSON.stringify([c.items,c.baseStats,c.basePercents,c.rawBaseStats,c.attributeFactors,c.attributeResponse,c.attributeContext,c.traits?.map(t=>[t.id,t.enabled,t.rank]),c.mainType,c.customSlots,c.alwaysUseDiamond]);
 const defaults=c=>{const key=sourceKey(c);if(key!==boundsKey){boundsKey=key;bounds={...S.defaultRanges(c),countRanges:S.defaultCountRanges(c)};}return bounds;};
 const signature=c=>{let config;try{config=S.settings(c,defaults(c));}catch{config=[c.filters,c.sort];}return JSON.stringify([sourceKey(c),config,c.ratingOverrides]);};
 const formatPercent=n=>n===null?'—':n.toFixed(1);
 const differs=(value,initial)=>value!==undefined&&value!==null&&value!==''&&(initial===undefined||Number(value)!==initial);
 const countRange=(c,key)=>{const old=c.filters?.[key];return c.filters?.counts?.[key]??(key==='tier'?(old==null||old===''||Number(old)===0?{}:{min:old}):(old==null||old===''?{}:{min:old,max:old}));};
 function refreshInputs(){const c=current(),initial=defaults(c);for(const e of document.querySelectorAll('[data-range]')){const v=initial[e.dataset.range]?.[e.dataset.bound],pct=e.dataset.unit==='percent',display=pct&&v!==undefined?formatPercent(Rating.toSheetPercent(c,e.dataset.range,v)):v;e.placeholder=display===undefined?'不限':String(display);e.title=v===undefined?'无可计算的初始范围':`初始值：${display}${pct?'%':''}`;e.classList.toggle('manual-value',e.value!=='');e.removeAttribute('aria-invalid');}for(const key of ['tier','embellishment','boe'])for(const bound of ['min','max']){const e=$(`#filter-${key}-${bound}`),value=initial.countRanges[key][bound];e.placeholder=String(value);e.title=`当前候选组合的初始值：${value}`;e.classList.toggle('manual-value',e.value!=='');e.removeAttribute('aria-invalid');}let message='';try{S.settings(c,initial);}catch(error){message=error.message;}
 inputError=false;
 const showError=(node,text,fields)=>{node.textContent=text;node.hidden=!text;if(text){inputError=true;fields.forEach(e=>e.setAttribute('aria-invalid','true'));}};
 for(const [k]of M.itemStats){const r=c.filters?.ranges?.[k]||{},lo=r.min===''||r.min==null?initial[k]?.min:Number(r.min),hi=r.max===''||r.max==null?initial[k]?.max:Number(r.max),fields=[...document.querySelectorAll(`[data-range="${k}"]`)];let text='';
 if(fields.some(e=>e.validity.badInput)||[lo,hi].some(v=>v!==undefined&&(!Number.isFinite(v)||v<0||v>1e9)))text=fields.some(e=>e.dataset.unit==='percent'&&e.value!=='')?'数值或百分比超出可计算范围':'请输入 0–10亿 的数值';
 else if(lo>hi)text='最低值不能大于最高值';
 showError($(`[data-range-error="${k}"]`),text,fields);}
 for(const key of ['tier','embellishment','boe']){const r=countRange(c,key),fields=['min','max'].map(b=>$(`#filter-${key}-${b}`));let text='';if(fields.some(e=>e.validity.badInput)||['min','max'].some(b=>r[b]!==undefined&&r[b]!==null&&r[b]!==''&&(!Number.isInteger(Number(r[b]))||Number(r[b])<0||Number(r[b])>16)))text='请输入 0–16 的整数';else if(r.min!==undefined&&r.min!==null&&r.min!==''&&r.max!==undefined&&r.max!==null&&r.max!==''&&Number(r.min)>Number(r.max))text='最少件数不能大于最多件数';showError($(`[data-count-error="${key}"]`),text,fields);}
 for(const [k]of M.itemStats){const r=c.filters?.ranges?.[k]||{};$(`[data-reset-range="${k}"]`).hidden=!['min','max'].some(bound=>differs(r[bound],initial[k]?.[bound]));}
 for(const k of ['crit','haste','mastery','versatility']){const r=c.filters?.ranges?.[k]||{},maximum=r.max===''||r.max==null?initial[k]?.max:Number(r.max),threshold=Rating.curves.secondary[1][0]*Rating.perPercent(c,k),warning=$(`[data-diminishing-warning="${k}"]`);warning.hidden=!Number.isFinite(maximum)||maximum<threshold;warning.textContent=`范围达到副属性递减：${Number(threshold.toFixed(2))} 等级起（${k==='mastery'?'30 精通点':'30%'}），后续换算效率降低。`;}
 for(const key of ['tier','embellishment','boe']){const r=countRange(c,key);$(`[data-reset-count="${key}"]`).hidden=!['min','max'].some(bound=>differs(r[bound],initial.countRanges[key][bound]));}
 $('#reset-filters').hidden=!document.querySelector('#filter-section [data-reset-range]:not([hidden]), #filter-section [data-reset-count]:not([hidden])');
 return message;
 }
 const format=n=>Number.isInteger(n)?n.toLocaleString('zh-CN'):Number(n.toFixed(3)).toLocaleString('zh-CN');
 const count=n=>BigInt(n||0).toLocaleString('zh-CN');
 function stop(){if(!running)return;running.worker.terminate();const record=records.get(running.id);if(record)record.status='stopped';running=null;renderResults();}
 function invalidate(){if(!state)return;const c=current();if(running&&running.id!==c.id)stop();errors.delete(c.id);renderResults();}
 function renderSettings(){if(!state)return;const c=current();c.filters??={};c.sort??={};
  const groups=[['stamina','armor','main'],['crit','haste','mastery','versatility'],['avoidance','leech','speed']];
  $('#filter-ranges').innerHTML=groups.map((group,n)=>`<div class="filter-group"><h4>${['耐力、护甲、主属性','副属性','额外属性'][n]}</h4>${group.map(k=>{const label=k==='main'?M.types[c.mainType]:M.itemStats.find(([key])=>key===k)[1],r=c.filters.ranges?.[k]||{};return `<div class="filter-range"><div class="filter-range-heading"><span class="filter-stat-label">${escape(label)}</span><span class="filter-input-error" data-range-error="${k}" role="alert" hidden></span><button type="button" class="filter-reset" data-reset-range="${k}" hidden>重置</button></div><div class="filter-range-pair"><input type="number" min="0" max="1000000000" step="10" data-range="${k}" data-bound="min" value="${escape(r.min??'')}" placeholder="min" aria-label="${label}最低值"><span>～</span><input type="number" min="0" max="1000000000" step="10" data-range="${k}" data-bound="max" value="${escape(r.max??'')}" placeholder="max" aria-label="${label}最高值"></div>${n?`<div class="filter-range-pair percent-pair"><span class="percent-field"><input type="number" min="0" step="1" data-range="${k}" data-bound="min" data-unit="percent" value="${r.min===''||r.min==null?'':formatPercent(Rating.toSheetPercent(c,k,Number(r.min)))}" placeholder="min" aria-label="${label}最低百分比"><b>%</b></span><span>～</span><span class="percent-field"><input type="number" min="0" step="1" data-range="${k}" data-bound="max" data-unit="percent" value="${r.max===''||r.max==null?'':formatPercent(Rating.toSheetPercent(c,k,Number(r.max)))}" placeholder="max" aria-label="${label}最高百分比"><b>%</b></span></div>`:''}${n===1?`<p class="diminishing-warning" data-diminishing-warning="${k}" role="status" hidden></p>`:''}</div>`;}).join('')}</div>`).join('');
  for(const key of ['tier','embellishment','boe']){const range=countRange(c,key);for(const bound of ['min','max'])$(`#filter-${key}-${bound}`).value=range[bound]??'';const heading=$(`#filter-${key}-min`).closest('.count-range').querySelector('.count-range-heading');if(!heading.querySelector('[data-count-error]'))heading.insertAdjacentHTML('beforeend',`<span class="filter-input-error" data-count-error="${key}" role="alert" hidden></span>`);}
  for(const input of document.querySelectorAll('#filter-section input[type="number"]')){if(input.parentElement.classList.contains('filter-number-control'))continue;const control=document.createElement('span');control.className='filter-number-control';input.before(control);control.append(input);const label=input.getAttribute('aria-label')||'数值';control.insertAdjacentHTML('beforeend',`<span class="filter-step-buttons"><button type="button" data-filter-step="up" aria-label="${escape(label)}增加">▴</button><button type="button" data-filter-step="down" aria-label="${escape(label)}减少">▾</button></span>`);}
  renderSortRules();renderColumnChoices();$('#result-limit').value=c.sort.limit||100;$('#result-percent').checked=!!c.resultPercent;
  invalidate();
 }
 function renderResults(){if(!state)return;const active=current(),record=records.get(active.id),c=record?.snapshot||active,validationError=refreshInputs(),dirty=!!record&&record.signature!==signature(active);$('#run-search').disabled=!!running||importingId===active.id;$('#stop-search').hidden=!running;$('#search-error').textContent=inputError?'':validationError||errors.get(active.id)||record?.error||'';for(const id of ['#search-dirty','#results-dirty']){$(id).hidden=!dirty;$(id).textContent='筛选、排序或候选已修改，尚未重新计算；下方保留上一次筛选结果。';}
  if(!record){$('#search-status').textContent='设置条件后点击“计算并筛选”。';$('#search-results').innerHTML='';renderedData=null;renderedId=null;return;}
  const data=record.data;const prefix={running:'正在计算',done:'计算完成',stopped:'已停止 · 仅为已检查部分的结果',error:'计算失败'}[record.status];
  $('#search-status').textContent=prefix+(data?` · 已检查 ${count(data.visited)} / ${count(data.total)} · 符合 ${count(data.matched)} · 展示 ${data.rows.length} 条`:'');
  if(!data){$('#search-results').innerHTML='';renderedData=null;renderedId=null;return;}
  const sortRules=S.sortRules(c);
  const columns=[...visibleColumns(active).map(([k,label])=>[k,k==='main'?M.types[c.mainType]:label]),...sortRules.flatMap((rule,index)=>rule.type==='formula'?[[`formula-${index}`,ruleLabel(rule,c),index]]:[])];
  const sortDirection=(key,formulaIndex)=>formulaIndex===undefined?sortRules.find(rule=>rule.type==='stat'&&rule.stat===key)?.direction:sortRules[formulaIndex]?.direction;
  const sortArrow=(key,formulaIndex)=>{const direction=sortDirection(key,formulaIndex);return direction==='asc'?'↑':direction==='desc'?'↓':'';};
  const headerText=(key,label,formulaIndex)=>label+(sortArrow(key,formulaIndex)?' '+sortArrow(key,formulaIndex):'');
  const columnKey=JSON.stringify([columns,sortRules,!!active.resultPercent]);
  if(renderedData===data&&renderedId===active.id&&renderedColumns===columnKey)return;
  const opened=renderedData===data&&renderedId===active.id?new Set([...document.querySelectorAll('.result-row[open]')].map(e=>Number(e.dataset.rowIndex))):new Set();
  renderedData=data;renderedId=active.id;renderedColumns=columnKey;
  if(!data.rows.length){$('#search-results').innerHTML=`<p class="hint">${escape(data.missing?.join('；')||(record.status==='done'?'没有符合条件的组合，请放宽条件或增加候选。':'目前尚未找到符合条件的组合。'))}</p>`;return;}
  const byId=new Map(c.items.map(i=>[i.id,i])),labels=new Map(M.getSlots(c).map(([k,n])=>[k,n]));
  const itemText=(id,n=1)=>{const i=byId.get(id);return `${escape(i?.name||'未知项目')}${n>1?' × '+n:''}`;};
  const gearText=id=>{const i=byId.get(id);if(!i)return itemText(id);const details=[i.name,labels.get(i.slot)||i.slot,i.ilevel?`${i.ilevel} 装等`:null,...M.itemStats.filter(([key])=>i.stats?.[key]).map(([key,label])=>`${key==='main'?M.types[c.mainType]:label} ${format(i.stats[key])}`),i.socketCount?`${i.socketCount} 个插槽`:i.socket?'1 个插槽':null,i.set?'套装装备':null,i.embellishment?'美化装备':null,i.effectNote||null].filter(Boolean);return `<span class="result-gear" title="${escape(details.join('\n'))}">${itemText(id)}</span>`;};
  const measure=document.createElement('canvas').getContext('2d');measure.font='12px '+getComputedStyle($('#search-results')).fontFamily;
  const widths=[Math.max(52,measure.measureText(String(data.rows.length)).width+24),...columns.map(([key,label,formulaIndex])=>Math.ceil(Math.max(52,formulaIndex===undefined?measure.measureText(headerText(key,label,formulaIndex)).width+24:Math.min(260,measure.measureText(headerText(key,label,formulaIndex)).width+24),...data.rows.map(row=>measure.measureText(cellText(c,row,key,formulaIndex)).width+24))))];
  $('#search-results').style.setProperty('--result-tracks',widths.map(n=>n+'px').join(' '));
  $('#search-results').innerHTML=`<div class="result-scroll"><div class="result-columns"><span>序号</span>${columns.map(([k,n,formulaIndex])=>`<span data-result-header="${k}"${formulaIndex===undefined?'':` title="${escape(n)}"`}>${escape(n)}${sortArrow(k,formulaIndex)?`<span class="sort-arrow" aria-label="${sortDirection(k,formulaIndex)==='asc'?'升序':'降序'}">${sortArrow(k,formulaIndex)}</span>`:''}</span>`).join('')}</div>${data.rows.map((row,n)=>`<details class="result-row" data-row-index="${n}" ${opened.has(n)?'open':''}><summary><span>${n+1}</span>${columns.map(([k,,formulaIndex])=>`<span data-result-cell="${k}">${cellText(c,row,k,formulaIndex)}</span>`).join('')}</summary><div class="result-detail"><p class="result-all-stats">${M.itemStats.map(([k,label])=>`${escape(k==='main'?M.types[c.mainType]:label)} ${statText(c,row,k)}`).join(' · ')}</p><div class="result-parts"><section><h4>装备</h4><ul>${row.gear.map(id=>`<li>${escape(labels.get(byId.get(id)?.slot))}：${gearText(id)}${byId.get(id)?.ilevel?' · '+byId.get(id).ilevel+' 装等':''}</li>`).join('')}</ul></section><section><h4>宝石 · ${row.sockets} 孔</h4><ul>${row.gems.length?row.gems.map(g=>`<li>${itemText(g.id,g.count)}</li>`).join(''):'<li>未选择宝石</li>'}</ul><h4>附魔</h4><ul>${row.enchants.length?row.enchants.map(e=>`<li>${escape(labels.get(byId.get(e.target)?.slot)||'未知部位')}：${itemText(e.id)}</li>`).join(''):'<li>未选择适用附魔</li>'}</ul></section><section><h4>食物、合剂与自定义项目</h4><ul>${row.consumables.length?row.consumables.map(id=>`<li>${itemText(id)}</li>`).join(''):'<li>未选择</li>'}</ul>${row.sets.length?`<h4>套装</h4><ul>${row.sets.map(([id,num])=>`<li>${escape(row.gear.filter(key=>{const i=byId.get(key);return i.set&&M.tierSlots.includes(i.slot)&&(S.tierGroup(i)||'unknown:'+key)===id;}).map(key=>labels.get(byId.get(key).slot)).join('、'))}：${num} 件</li>`).join('')}</ul>`:''}</section></div></div></details>`).join('')}</div>`;
 }
 let sortEdit=null,dragCharacterId=null;
 const statLabel=(k,c=current())=>k==='main'?M.types[c.mainType]:M.itemStats.find(([key])=>key===k)?.[1]||countColumns.find(([key])=>key===k)?.[1]||k;
 const formulaSigns={'+':'＋','-':'−','*':'×','/':'÷'};
 const ruleLabel=(r,c=current())=>r.type==='stat'?statLabel(r.stat,c):r.expression||`${statLabel(r.left,c)} ${formulaSigns[r.operator]} ${statLabel(r.right,c)}`;
 function renderSortRules(){
  const rules=S.sortRules(current());
  $('#sort-rules').innerHTML=rules.length?rules.map((r,n)=>`<div class="sort-card" data-sort-index="${n}" role="listitem"><button type="button" class="sort-handle" data-sort-drag aria-label="第 ${n+1} 条规则，拖动或按上下方向键调整优先级" title="拖动调整；也可使用上下方向键">≡</button><span class="sort-priority">${n+1}</span><button type="button" class="sort-card-edit" data-sort-edit aria-label="编辑第 ${n+1} 条规则：${escape(ruleLabel(r))}"><strong>${escape(ruleLabel(r))}</strong><span>${r.direction==='asc'?'升序':'降序'}</span></button><button type="button" class="sort-delete" data-sort-delete aria-label="删除第 ${n+1} 条排序规则" title="删除排序规则"><span aria-hidden="true">−</span></button></div>`).join(''):'<p class="hint">暂无排序规则；组合按固定顺序排列。</p>';
  $('#sort-rules').setAttribute('role','list');
 }
 function saveRules(rules){current().sort??={};current().sort.rules=rules;renderSortRules();save();}
 function openSortEditor(index=null){
  sortEdit={characterId:current().id,index};
  const r=index===null?{type:'stat',stat:'main',direction:'desc'}:S.sortRules(current())[index];
  const options=[...M.itemStats,...countColumns].map(([k])=>`<option value="${k}">${escape(statLabel(k))}</option>`).join('');
  $('#sort-field').innerHTML=options+'<option value="formula">ƒ 自定义计算</option>';
  $('#sort-field').value=r.type==='stat'?r.stat:'formula';$('#sort-expression').value=index===null?'':r.expression||`${statLabel(r.left||'crit')}${formulaSigns[r.operator||'-']}${statLabel(r.right||'mastery')}`;$('#sort-direction').value=r.direction;
  $('#sort-formula').hidden=r.type!=='formula';$('#sort-error').textContent='';$('#sort-dialog-title').textContent=index===null?'添加排序规则':'编辑排序规则';$('#sort-dialog').showModal();$('#sort-field').focus();
 }
 function moveRule(from,to){
  const rules=[...S.sortRules(current())];if(from<0||to<0||from>=rules.length||to>=rules.length||from===to)return;
  rules.splice(to,0,rules.splice(from,1)[0]);saveRules(rules);$(`[data-sort-index="${to}"] [data-sort-drag]`).focus();
 }
 $('#add-sort-rule').addEventListener('click',()=>openSortEditor());
 $('#sort-field').addEventListener('change',()=>{$('#sort-formula').hidden=$('#sort-field').value!=='formula';});
 $('#sort-form').addEventListener('submit',e=>{
  e.preventDefault();if(!sortEdit||sortEdit.characterId!==current().id){$('#sort-dialog').close();return;}
  const field=$('#sort-field').value,direction=$('#sort-direction').value;
  const rule=field==='formula'?{type:'formula',expression:$('#sort-expression').value.trim(),direction}:{type:'stat',stat:field,direction};
  try{S.validateRules([rule]);const rules=[...S.sortRules(current())];if(sortEdit.index===null)rules.push(rule);else rules[sortEdit.index]=rule;saveRules(rules);$('#sort-dialog').close();}catch(error){$('#sort-error').textContent=error.message;}
 });
 $('#sort-rules').addEventListener('click',e=>{const card=e.target.closest('[data-sort-index]');if(!card)return;const n=Number(card.dataset.sortIndex);if(e.target.closest('[data-sort-edit]'))openSortEditor(n);if(e.target.closest('[data-sort-delete]')){const rules=[...S.sortRules(current())];rules.splice(n,1);saveRules(rules);}});
 $('#sort-rules').addEventListener('keydown',e=>{if(!e.target.closest('[data-sort-drag]')||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const n=Number(e.target.closest('[data-sort-index]').dataset.sortIndex);moveRule(n,n+(e.key==='ArrowUp'?-1:1));});
 Sortable.create($('#sort-rules'),{
  handle:'[data-sort-drag]',draggable:'.sort-card',animation:180,forceFallback:true,fallbackOnBody:true,fallbackTolerance:3,
  ghostClass:'sort-ghost',chosenClass:'sort-chosen',fallbackClass:'sort-floating',
  onStart(){dragCharacterId=current().id;},
  onEnd({oldDraggableIndex,newDraggableIndex}){if(dragCharacterId===current().id)moveRule(oldDraggableIndex,newDraggableIndex);else renderSortRules();dragCharacterId=null;}
 });
 $('#result-column-options').addEventListener('change',e=>{if(!e.target.matches('[data-result-column]'))return;current().resultColumns=[...document.querySelectorAll('[data-result-column]:checked')].map(e=>e.dataset.resultColumn);save();});
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
 for(const key of ['tier','embellishment','boe'])for(const bound of ['min','max']){
  const e=$(`#filter-${key}-${bound}`),update=()=>{const c=current();c.filters??={};c.filters.counts??={};if(!c.filters.counts[key]){const old=c.filters[key];c.filters.counts[key]=key==='tier'?(old==null||old===''||Number(old)===0?{}:{min:old}):(old==null||old===''?{}:{min:old,max:old});}c.filters.counts[key][bound]=e.validity.badInput?'无效数值':e.value;delete c.filters[key];save();};e.addEventListener('input',update);e.addEventListener('change',update);
 }
 $('#filter-section .search-options').addEventListener('click',e=>{const key=e.target.closest('[data-reset-count]')?.dataset.resetCount;if(!key)return;delete current().filters.counts?.[key];delete current().filters[key];renderSettings();save();});
 $('#reset-filters').addEventListener('click',()=>{current().filters={};renderSettings();save();});
 $('#stop-search').addEventListener('click',stop);
 $('#run-search').addEventListener('click',()=>{const c=current();try{S.validate(c);$('#results-section').open=true;const snapshot=structuredClone(c),sig=signature(c);stop();const worker=new Worker('search-worker.js');errors.delete(c.id);records.set(c.id,{signature:sig,status:'running',snapshot});running={id:c.id,signature:sig,worker};renderResults();
  worker.onmessage=({data})=>{if(running?.worker!==worker)return;const record=records.get(c.id);if(data.type==='error'){record.status='error';record.error=data.message;worker.terminate();running=null;}else{record.data=data;if(data.done){record.status='done';worker.terminate();running=null;}}if(current().id===c.id)renderResults();};
  worker.onerror=e=>{if(running?.worker!==worker)return;records.set(c.id,{signature:sig,status:'error',snapshot,error:e.message||'后台计算失败'});worker.terminate();running=null;renderResults();};worker.postMessage(snapshot);
 }catch(error){errors.set(c.id,error.message);renderResults();}});
 window.searchUI={invalidate,renderSettings,stop};if(state)renderSettings();
})();
