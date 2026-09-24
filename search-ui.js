'use strict';
(()=>{
 const S=window.GearSearch,records=new Map(),errors=new Map();let running=null,renderedData=null,renderedId=null,renderedColumns=null,boundsKey=null,bounds={};
 const columnDefs=[['main','主属性'],...M.stats.slice(1),['tier','套装'],['embellishments','美化'],['armor','护甲'],['stamina','耐力'],['avoidance','闪避'],['leech','吸血'],['speed','加速']];
 const defaultColumns=columnDefs.slice(0,7).map(([k])=>k);
 const visibleColumns=c=>columnDefs.filter(([k])=>(Array.isArray(c.resultColumns)?c.resultColumns:defaultColumns).includes(k));
 function renderColumnChoices(){const selected=new Set(visibleColumns(current()).map(([k])=>k));$('#result-column-options').innerHTML=columnDefs.map(([k,label])=>`<label><input type="checkbox" data-result-column="${k}" ${selected.has(k)?'checked':''}>${label}</label>`).join('');}
 const cellText=(row,key)=>key==='tier'?`${row.tier} 件`:key==='embellishments'?`${row.embellishments} 件`:format(row.stats[key]);
 const sourceKey=c=>JSON.stringify([c.items,c.baseStats,c.rawBaseStats,c.attributeFactors,c.attributeResponse,c.attributeContext,c.traits?.map(t=>[t.id,t.enabled,t.rank]),c.mainType,c.customSlots]);
 const defaults=c=>{const key=sourceKey(c);if(key!==boundsKey){boundsKey=key;bounds=S.defaultRanges(c);}return bounds;};
 const signature=c=>{let config;try{config=S.settings(c,defaults(c));}catch{config=[c.filters,c.sort];}return JSON.stringify([sourceKey(c),config]);};
 function refreshInputs(){const c=current(),initial=defaults(c);for(const e of document.querySelectorAll('[data-range]')){const v=initial[e.dataset.range]?.[e.dataset.bound];e.placeholder=v===undefined?'不限':String(v);e.title=v===undefined?'无可计算的初始范围':`初始值：${v}`;e.classList.toggle('manual-value',e.value!=='');e.removeAttribute('aria-invalid');}let message='';try{S.settings(c,initial);}catch(error){message=error.message;}
 for(const [k]of M.itemStats){const r=c.filters?.ranges?.[k]||{},lo=r.min===''||r.min==null?initial[k]?.min:Number(r.min),hi=r.max===''||r.max==null?initial[k]?.max:Number(r.max);if(lo>hi)document.querySelectorAll(`[data-range="${k}"]`).forEach(e=>e.setAttribute('aria-invalid','true'));}
 return message;
 }
 const format=n=>Number.isInteger(n)?n.toLocaleString('zh-CN'):Number(n.toFixed(3)).toLocaleString('zh-CN');
 const count=n=>BigInt(n||0).toLocaleString('zh-CN');
 function stop(){if(!running)return;running.worker.terminate();const record=records.get(running.id);if(record)record.status='stopped';running=null;renderResults();}
 function invalidate(){if(!state)return;const c=current();if(running&&running.id!==c.id)stop();errors.delete(c.id);renderResults();}
 function renderSettings(){if(!state)return;const c=current();c.filters??={};c.sort??={};
  $('#filter-ranges').innerHTML=M.itemStats.map(([k,label])=>`<label class="filter-range"><span>${escape(k==='main'?M.types[c.mainType]:label)}</span><input type="number" min="0" max="1000000000" step="any" data-range="${k}" data-bound="min" value="${escape(c.filters.ranges?.[k]?.min??'')}" placeholder="最低" aria-label="${label}最低值"><span>—</span><input type="number" min="0" max="1000000000" step="any" data-range="${k}" data-bound="max" value="${escape(c.filters.ranges?.[k]?.max??'')}" placeholder="最高" aria-label="${label}最高值"></label>`).join('');
  $('#filter-tier').value=c.filters.tier??0;$('#filter-embellishment').value=c.filters.embellishment??'';
  renderSortRules();renderColumnChoices();$('#result-limit').value=c.sort.limit||100;
  invalidate();
 }
 function renderResults(){if(!state)return;const active=current(),record=records.get(active.id),c=record?.snapshot||active,validationError=refreshInputs(),dirty=!!record&&record.signature!==signature(active);$('#run-search').disabled=!!running||importingId===active.id;$('#stop-search').hidden=!running;$('#search-error').textContent=validationError||errors.get(active.id)||record?.error||'';for(const id of ['#search-dirty','#results-dirty']){$(id).hidden=!dirty;$(id).textContent='筛选、排序或候选已修改，尚未重新计算；下方保留上一次筛选结果。';}
  if(!record){$('#search-status').textContent='设置条件后点击“计算并筛选”。';$('#search-results').innerHTML='';renderedData=null;renderedId=null;return;}
  const data=record.data;const prefix={running:'正在计算',done:'计算完成',stopped:'已停止 · 仅为已检查部分的结果',error:'计算失败'}[record.status];
  $('#search-status').textContent=prefix+(data?` · 已检查 ${count(data.visited)} / ${count(data.total)} · 符合 ${count(data.matched)} · 展示 ${data.rows.length} 条`:'');
  if(!data){$('#search-results').innerHTML='';renderedData=null;renderedId=null;return;}
  const columns=visibleColumns(active).map(([k,label])=>[k,k==='main'?M.types[c.mainType]:label]),columnKey=JSON.stringify(columns);
  if(renderedData===data&&renderedId===active.id&&renderedColumns===columnKey)return;
  const opened=renderedData===data&&renderedId===active.id?new Set([...document.querySelectorAll('.result-row[open]')].map(e=>Number(e.dataset.rowIndex))):new Set();
  renderedData=data;renderedId=active.id;renderedColumns=columnKey;
  if(!data.rows.length){$('#search-results').innerHTML=`<p class="hint">${escape(data.missing?.join('；')||(record.status==='done'?'没有符合条件的组合，请放宽条件或增加候选。':'目前尚未找到符合条件的组合。'))}</p>`;return;}
  const byId=new Map(c.items.map(i=>[i.id,i])),labels=new Map(M.getSlots(c).map(([k,n])=>[k,n]));
  const itemText=(id,n=1)=>{const i=byId.get(id);return `${escape(i?.name||'未知项目')}${n>1?' × '+n:''}`;};
  const measure=document.createElement('canvas').getContext('2d');measure.font='12px '+getComputedStyle($('#search-results')).fontFamily;
  const widths=[Math.max(52,measure.measureText(String(data.rows.length)).width+24),...columns.map(([key,label])=>Math.ceil(Math.max(52,measure.measureText(label).width+24,...data.rows.map(row=>measure.measureText(cellText(row,key)).width+24))))];
  $('#search-results').style.setProperty('--result-tracks',widths.map(n=>n+'px').join(' '));
  $('#search-results').innerHTML=`<div class="result-scroll"><div class="result-columns"><span>序号</span>${columns.map(([k,n])=>`<span data-result-header="${k}">${escape(n)}</span>`).join('')}</div>${data.rows.map((row,n)=>`<details class="result-row" data-row-index="${n}" ${opened.has(n)?'open':''}><summary><span>${n+1}</span>${columns.map(([k])=>`<span data-result-cell="${k}">${cellText(row,k)}</span>`).join('')}</summary><div class="result-detail"><p class="result-all-stats">${M.itemStats.map(([k,label])=>`${escape(k==='main'?M.types[c.mainType]:label)} ${format(row.stats[k])}`).join(' · ')}</p><div class="result-parts"><section><h4>装备</h4><ul>${row.gear.map(id=>`<li>${escape(labels.get(byId.get(id)?.slot))}：${itemText(id)}${byId.get(id)?.ilevel?' · '+byId.get(id).ilevel+' 装等':''}</li>`).join('')}</ul></section><section><h4>宝石 · ${row.sockets} 孔</h4><ul>${row.gems.length?row.gems.map(g=>`<li>${itemText(g.id,g.count)}</li>`).join(''):'<li>未选择宝石</li>'}</ul><h4>附魔</h4><ul>${row.enchants.length?row.enchants.map(e=>`<li>${escape(labels.get(byId.get(e.target)?.slot)||'未知部位')}：${itemText(e.id)}</li>`).join(''):'<li>未选择适用附魔</li>'}</ul></section><section><h4>食物、合剂与自定义项目</h4><ul>${row.consumables.length?row.consumables.map(id=>`<li>${itemText(id)}</li>`).join(''):'<li>未选择</li>'}</ul>${row.sets.length?`<h4>套装</h4><ul>${row.sets.map(([id,num])=>`<li>${escape(row.gear.filter(key=>{const i=byId.get(key);return i.set&&M.tierSlots.includes(i.slot)&&(S.tierGroup(i)||'unknown:'+key)===id;}).map(key=>labels.get(byId.get(key).slot)).join('、'))}：${num} 件</li>`).join('')}</ul>`:''}</section></div></div></details>`).join('')}</div>`;
 }
 let sortEdit=null,dragCharacterId=null;
 const statLabel=k=>k==='main'?M.types[current().mainType]:M.itemStats.find(([key])=>key===k)?.[1]||k;
 const formulaSigns={'+':'＋','-':'−','*':'×','/':'÷'};
 const ruleLabel=r=>r.type==='stat'?statLabel(r.stat):`${statLabel(r.left)} ${formulaSigns[r.operator]} ${statLabel(r.right)}`;
 function renderSortRules(){
  const rules=S.sortRules(current());
  $('#sort-rules').innerHTML=rules.length?rules.map((r,n)=>`<div class="sort-card" data-sort-index="${n}" role="listitem"><button type="button" class="sort-handle" data-sort-drag aria-label="第 ${n+1} 条规则，拖动或按上下方向键调整优先级" title="拖动调整；也可使用上下方向键">≡</button><span class="sort-priority">${n+1}</span><button type="button" class="sort-card-edit" data-sort-edit aria-label="编辑第 ${n+1} 条规则：${escape(ruleLabel(r))}"><strong>${escape(ruleLabel(r))}</strong><span>${r.direction==='asc'?'从低到高':'从高到低'}</span></button><button type="button" class="sort-delete" data-sort-delete aria-label="删除第 ${n+1} 条排序规则" title="删除排序规则"><span aria-hidden="true">−</span></button></div>`).join(''):'<p class="hint">暂无排序规则；组合按固定顺序排列。</p>';
  $('#sort-rules').setAttribute('role','list');
 }
 function saveRules(rules){current().sort??={};current().sort.rules=rules;renderSortRules();save();}
 function openSortEditor(index=null){
  sortEdit={characterId:current().id,index};
  const r=index===null?{type:'stat',stat:'main',direction:'desc'}:S.sortRules(current())[index];
  const options=M.itemStats.map(([k])=>`<option value="${k}">${escape(statLabel(k))}</option>`).join('');
  $('#sort-field').innerHTML=options+'<option value="formula">ƒ 自定义计算</option>';
  $('#sort-left').innerHTML=options;$('#sort-right').innerHTML=options;
  $('#sort-field').value=r.type==='stat'?r.stat:'formula';$('#sort-left').value=r.left||'crit';$('#sort-right').value=r.right||'mastery';$('#sort-operator').value=r.operator||'-';$('#sort-direction').value=r.direction;
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
  const rule=field==='formula'?{type:'formula',left:$('#sort-left').value,operator:$('#sort-operator').value,right:$('#sort-right').value,direction}:{type:'stat',stat:field,direction};
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
 $('#filter-ranges').addEventListener('input',e=>{const k=e.target.dataset.range;if(!k)return;const c=current();c.filters??={};c.filters.ranges??={};c.filters.ranges[k]??={};c.filters.ranges[k][e.target.dataset.bound]=e.target.validity.badInput?'无效数值':e.target.value;save();});
 for(const [selector,section,key]of [['#filter-tier','filters','tier'],['#result-limit','sort','limit']])$(selector).addEventListener('change',()=>{current()[section]??={};current()[section][key]=$(selector).value;save();});
 $('#filter-embellishment').addEventListener('input',()=>{current().filters??={};const e=$('#filter-embellishment');current().filters.embellishment=e.validity.badInput?'无效数值':e.value;save();});
 $('#filter-embellishment').addEventListener('change',()=>{current().filters??={};current().filters.embellishment=$('#filter-embellishment').value;save();});
 $('#reset-filters').addEventListener('click',()=>{current().filters={};renderSettings();save();});
 $('#stop-search').addEventListener('click',stop);
 $('#run-search').addEventListener('click',()=>{const c=current();try{S.validate(c);$('#results-section').open=true;const snapshot=structuredClone(c),sig=signature(c);stop();const worker=new Worker('search-worker.js');errors.delete(c.id);records.set(c.id,{signature:sig,status:'running',snapshot});running={id:c.id,signature:sig,worker};renderResults();
  worker.onmessage=({data})=>{if(running?.worker!==worker)return;const record=records.get(c.id);if(data.type==='error'){record.status='error';record.error=data.message;worker.terminate();running=null;}else{record.data=data;if(data.done){record.status='done';worker.terminate();running=null;}}if(current().id===c.id)renderResults();};
  worker.onerror=e=>{if(running?.worker!==worker)return;records.set(c.id,{signature:sig,status:'error',snapshot,error:e.message||'后台计算失败'});worker.terminate();running=null;renderResults();};worker.postMessage(snapshot);
 }catch(error){errors.set(c.id,error.message);renderResults();}});
 window.searchUI={invalidate,renderSettings,stop};if(state)renderSettings();
})();
