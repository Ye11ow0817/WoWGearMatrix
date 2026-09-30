const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({win,storage,output})=>{
 const js=code=>win.webContents.executeJavaScript(code);
 const wait=async code=>{for(let n=0;n<1500;n++){if(await js(code))return;await new Promise(r=>setTimeout(r,40));}throw Error('UI wait: '+code);};
 const click=selector=>js(`document.querySelector(${JSON.stringify(selector)}).click()`);
 const saved=()=>wait(`document.querySelector('#save-status').textContent==='已保存到本机'`);
 const character=()=>{const s=storage.load();return s.characters.find(c=>c.id===s.activeId);};
 const fill=async(selector,value,event='input')=>{await js(`{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));}`);};
 const frame=()=>js(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
 const screenshot=async name=>{await frame();fs.writeFileSync(path.join(output,name),(await win.webContents.capturePage()).toPNG());};
 await wait(`state&&!document.querySelector('#app').hidden`);await saved();
 assert.equal(await js(`document.querySelector('#tab-candidates').textContent`),'配装设置');
 assert.equal(await js(`document.querySelector('#new-tab').textContent`),'＋');
 assert.deepEqual(await js(`[...document.querySelectorAll('[data-candidate]')].map(b=>b.textContent.trim().replace(/\\d+$/,''))`),['角色信息','装备','附魔','宝石','消耗品']);
 assert.equal(await js(`document.querySelector('#tab-candidates').getAttribute('aria-selected')`),'true');
 assert.equal(await js(`workspaceUI.view().category`),'import-section');
 assert(await js(`document.querySelector('#input').getClientRects().length>0`));
 assert(await js(`document.querySelector('.profile-effects').parentElement===document.querySelector('.base-attributes').parentElement`));
 assert.equal(await js(`[...document.querySelectorAll('#equipment-section h2,#equipment-section h3,#enchant-section h2,#enchant-section h3,#gem-section h2,#gem-section h3,#consumable-section h2,#consumable-section h3')].filter(e=>['装备','附魔','宝石','消耗品'].includes(e.textContent.trim())).length`),0);
 const first=character().id;
 await fill('#character-name','星火','change');await saved();assert.equal(character().name,'星火');assert(character().renamed);
 assert.equal(await js(`document.querySelector('.tab[aria-selected=true]').textContent`),'星火');
 await js(`document.querySelector('.tab[aria-selected=true]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`);
 assert.equal(await js(`document.activeElement.className`),'tab-rename');
 await fill('.tab-rename','霜火');await js(`document.querySelector('.tab-rename').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);await saved();assert.equal(character().name,'霜火');
 assert.equal(await js(`document.querySelector('#character-name').value`),'霜火');
 await js(`document.querySelector('.tab[aria-selected=true]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`);await fill('.tab-rename','应取消');await js(`document.querySelector('.tab-rename').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);assert.equal(character().name,'霜火');
 await fill('#character-name','   ','change');assert.equal(await js(`document.querySelector('#character-name').value`),'霜火');
 const sample=fs.readFileSync(path.join(__dirname,'engine/sample.simc'),'utf8');await fill('#input',sample);await click('#parse');await wait(`!document.querySelector('#parse').disabled`);await saved();
 assert.equal(character().name,'霜火');assert.equal(character().baseStats.main,618);assert.equal(character().items.filter(i=>i.origin==='import').length,25);
 assert.equal(await js(`document.querySelector('#parse').textContent`),'导入');
 await screenshot('character-info.png');
 await click('[data-candidate="equipment-section"]');assert.equal(await js(`document.querySelector('#input').getClientRects().length`),0);
 const selectedCount=character().items.filter(i=>i.selected&&!['enchant','gem','food','flask'].includes(i.slot)&&!i.slot.startsWith('custom_')).length;
 assert.equal(Number(await js(`document.querySelector('[data-category-count="equipment-section"]').textContent`)),selectedCount);
 const selected=character().items.find(i=>i.slot==='head'&&i.selected);await click(`[data-item="${selected.id}"]`);await saved();
 assert.equal(Number(await js(`document.querySelector('[data-category-count="equipment-section"]').textContent`)),selectedCount-1);
 await click(`[data-item="${selected.id}"]`);await saved();
 const top=await js(`{const el=document.querySelector('#page-candidates .page-scroll');el.scrollTop=230;el.scrollTop}`);
 await click('[data-candidate="gem-section"]');assert.equal(await js(`document.querySelector('#page-candidates .page-scroll').scrollTop`),0);
 await click('[data-candidate="equipment-section"]');assert.equal(await js(`document.querySelector('#page-candidates .page-scroll').scrollTop`),top);
 await click('#tab-filters');await click('#tab-candidates');assert.equal(await js(`workspaceUI.view().category`),'equipment-section');assert.equal(await js(`document.querySelector('#page-candidates .page-scroll').scrollTop`),top);
 await click('#new-tab');await saved();const second=character().id;assert.equal(await js(`workspaceUI.view().category`),'import-section');assert(await js(`document.querySelector('#input').getClientRects().length>0`));
 await click('[data-candidate="consumable-section"]');await click(`[data-tab="${first}"]`);await saved();assert.equal(await js(`workspaceUI.view().category`),'equipment-section');assert.equal(character().name,'霜火');
 await click(`[data-tab="${second}"]`);await saved();assert.equal(await js(`workspaceUI.view().category`),'consumable-section');
 await click(`[data-close-tab="${second}"]`);await saved();assert.equal(character().id,first);
 await js(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'t',ctrlKey:true,shiftKey:true,bubbles:true}))`);await saved();assert.equal(character().id,second);assert.equal(await js(`workspaceUI.view().category`),'consumable-section');
 await click(`[data-tab="${first}"]`);await saved();await click('[data-candidate="import-section"]');
 await js(`document.querySelector('[data-candidate="import-section"]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))`);assert.equal(await js(`document.activeElement.dataset.candidate`),'equipment-section');
 await click('#tab-filters');const filterBefore=await js(`JSON.stringify(current().filters)`),sortBefore=await js(`JSON.stringify(current().sort)`);await click('#tab-candidates');
 for(const [width,height,zoom] of [[1440,1000,1],[950,650,1],[950,650,1.25],[950,650,1.5]]){
  win.setSize(width,height);win.webContents.setZoomFactor(zoom);await frame();
  for(const category of ['import-section','equipment-section','enchant-section','gem-section','consumable-section']){
   await click(`[data-candidate="${category}"]`);await js(`document.querySelector('#page-candidates .page-scroll').scrollTop=0;document.querySelector('#toast').hidden=true`);await frame();
   const geometry=await js(`(()=>{const scroll=document.querySelector('#page-candidates .page-scroll'),bar=document.querySelector('#combination-bar'),tab=document.querySelector('.tab-shell.active'),nav=document.querySelector('#workspace-tabs');return {height:scroll.clientHeight,overflow:document.documentElement.scrollWidth>innerWidth,contentOverflow:scroll.scrollWidth>scroll.clientWidth,barOverlap:scroll.getBoundingClientRect().bottom>bar.getBoundingClientRect().top+1,tabGap:Math.abs(tab.getBoundingClientRect().bottom-nav.getBoundingClientRect().top),surface:getComputedStyle(tab).backgroundColor===getComputedStyle(document.querySelector('#app')).backgroundColor};})()`);
   assert(geometry.height>45,JSON.stringify({width,height,zoom,category,geometry}));assert(!geometry.overflow);assert(!geometry.contentOverflow,JSON.stringify({zoom,category,geometry}));assert(!geometry.barOverlap);assert(geometry.tabGap<=2,JSON.stringify(geometry));assert(geometry.surface);
   if(category==='import-section'){
    const profile=await js(`(()=>{const rect=s=>document.querySelector(s).getBoundingClientRect(),table=rect('.attributes-table'),role=rect('.profile-controls'),effects=rect('.profile-effects');return {width:table.width,roleAbove:role.bottom<=table.top,arranged:innerWidth<=760?effects.top>=rect('.base-attributes').bottom:effects.left>=table.right};})()`);
    assert(profile.width<=321,JSON.stringify(profile));assert(profile.roleAbove);assert(profile.arranged,JSON.stringify(profile));
   }
   await screenshot(`${category}-${width}-${zoom}.png`);
  }
 }
 assert.equal(await js(`JSON.stringify(current().filters)`),filterBefore);assert.equal(await js(`JSON.stringify(current().sort)`),sortBefore);
 win.webContents.setZoomFactor(1);win.setSize(1440,1000);await click('[data-candidate="import-section"]');
 await saved();const loaded=new Promise(resolve=>win.webContents.once('did-finish-load',resolve));win.webContents.reload();await loaded;await wait(`state&&!document.querySelector('#app').hidden`);await saved();assert.equal(character().name,'霜火');assert.equal(await js(`document.querySelector('.tab[aria-selected=true]').textContent`),'霜火');
 fs.writeFileSync(path.join(output,'config-layout-test.txt'),'PASS: real SimC import, role rename/save/cancel/reload, plus creation, close/reopen, independent category/scroll state, candidate counters, keyboard navigation, connected tabs, five categories at 950x650 and 125%/150% zoom; filter/sort state unchanged.');
};
