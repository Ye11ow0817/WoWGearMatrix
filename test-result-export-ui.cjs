const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{dialog}=require('electron');
const E=require('./result-export.js');
module.exports=async({win,output})=>{
 const js=code=>win.webContents.executeJavaScript(code);
 const wait=async code=>{for(let i=0;i<250;i++){if(await js(code))return;await new Promise(r=>setTimeout(r,40));}throw Error('UI wait: '+code);};
 await wait(`state&&!document.querySelector('#app').hidden`);
 assert(await js(`document.querySelector('#export-results').disabled`));
 await js(`{const c=current();c.name='导出测试';c.baseStats=Object.fromEntries(M.itemStats.map(([k])=>[k,0]));c.basePercents=Object.fromEntries(RatingConversion.keys.map(k=>[k,0]));c.items=Array.from({length:60},(_,n)=>({id:'head-'+n,slot:'head',name:n===59?'=中文,"装备"\\n换行':'头部 '+n,origin:'custom',source:'custom',selected:true,ilevel:300,mainType:'strength',stats:{...c.baseStats,crit:n+1,mastery:100},socket:false,set:false,embellishment:false}));c.filters={};c.sort={limit:100,rules:[{type:'formula',expression:'暴击-精通',direction:'desc'}]};c.resultPercent=true;c.resultColumns=['crit'];render();save();document.querySelector('#run-search').click();}`);
 await wait(`document.querySelector('#search-status').textContent.startsWith('计算完成')`);
 assert.equal(await js(`document.querySelectorAll('.result-row').length`),50);
 assert.equal(await js(`document.querySelector('[data-result-column="slot:head:1"]').checked`),true);
 assert(await js(`document.querySelector('[data-result-header="slot:head:1"]')`));
 await js(`current().resultColumns.push('slot:head:1');current().items.forEach((i,n)=>i.selected=n===0);searchUI.renderSettings();`);
 assert.equal(await js(`document.querySelector('[data-result-column="slot:head:1"]').checked`),false);
 await js(`current().items.forEach(i=>i.selected=true);searchUI.renderSettings();`);
 assert.equal(await js(`document.querySelector('[data-result-column="slot:head:1"]').checked`),true);
 await js(`document.querySelector('[data-result-column="slot:head:1"]').click();current().items.forEach((i,n)=>i.selected=n===0);searchUI.renderSettings();current().items.forEach(i=>i.selected=true);searchUI.renderSettings();`);
 assert.equal(await js(`document.querySelector('[data-result-column="slot:head:1"]').checked`),false);
 assert.equal(await js(`document.querySelector('[data-result-header="slot:head:1"]')`),null);
 assert.equal(await js(`document.querySelector('[data-result-column="loadout"]')`),null);
 assert.equal(await js(`document.querySelectorAll('[data-result-column^="slot:"]:checked').length`),0);
 assert.equal(await js(`document.querySelector('[data-result-column="slot:finger:2"]').parentElement.textContent`),'戒指2');
 assert.equal(await js(`document.querySelector('#export-results').disabled`),false);
 for(const [width,height]of [[950,650],[1440,1000]]){
  win.setSize(width,height);await js(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  assert(await js(`(()=>{const groups=[...document.querySelectorAll('[data-slot-group]')];return groups.length===3&&groups.every(g=>{const labels=[...g.querySelectorAll('label')];return labels.every(l=>Math.abs(l.getBoundingClientRect().top-labels[0].getBoundingClientRect().top)<1);})&&groups.every((g,n)=>!n||g.getBoundingClientRect().top>=groups[n-1].getBoundingClientRect().bottom);})()`));
  assert(await js(`(()=>{const b=document.querySelector('#export-results').getBoundingClientRect(),o=document.querySelector('.result-options').getBoundingClientRect();return b.width>0&&b.right<=innerWidth&&b.bottom<=innerHeight&&(b.left>=o.right||b.right<=o.left||b.top>=o.bottom||b.bottom<=o.top);})()`));
 }
 fs.writeFileSync(path.join(output,'export-preview.png'),(await win.webContents.capturePage()).toPNG());
 const firstFormula=await js(`document.querySelector('[data-result-cell="formula-0"]').textContent`);
 await js(`document.querySelector('#page-next').click();current().items[59].name='已修改候选';current().sort.rules=[];save();`);
 await wait(`!document.querySelector('#results-dirty').hidden`);
 await js(`current().resultPercent=false;document.querySelector('#result-percent').checked=false;save();`);
 assert(await js(`(()=>{const empty=[...document.querySelector('template[data-detail]').content.querySelectorAll('.result-part-empty')];return empty.length>0&&empty.every(e=>e.textContent.endsWith('-'));})()`));
 const target=path.join(output,'导出测试.csv');let calls=0;
 const original=dialog.showSaveDialog;
 dialog.showSaveDialog=async(_win,opts)=>{calls++;assert.match(path.basename(opts.defaultPath),/^导出测试-\d{12}\.csv$/);return {canceled:false,filePath:target};};
 try{
  await js(`document.querySelector('#export-results').click()`);
  await wait(`document.querySelector('#toast').textContent==='已导出 60 条结果'&&!document.querySelector('#export-results').disabled`);
  const csv=fs.readFileSync(target,'utf8');assert(csv.startsWith('\uFEFF'));assert(csv.includes('"暴击-精通"'));assert(csv.includes('"暴击 (%)"'));assert.equal(csv.split('\r\n').filter(line=>/^\d+,/.test(line)).length,60);assert(csv.includes(',"-"'));assert(!csv.includes(`"'-"`));assert(csv.includes(','+Number(firstFormula.replaceAll(',',''))+','));assert(csv.includes('中文,""装备""\n换行'));assert(!csv.includes('已修改候选'));
  assert.equal(await js(`document.querySelector('#page-number').value`),'2');assert.equal(calls,1);
  await js(`document.querySelector('[data-result-column="slot:head:1"]').click()`);
  await wait(`document.querySelector('[data-result-header="slot:head:1"]')?.textContent==='头部'`);
  assert((await js(`document.querySelector('[data-result-cell="slot:head:1"]').textContent`)).includes('头部 '));
  assert.equal(await js(`document.querySelector('#page-number').value`),'2');
  await js(`document.querySelector('#page-prev').click()`);
  assert((await js(`document.querySelector('[data-result-cell="slot:head:1"]').textContent`)).includes('=中文,"装备"'));
  assert.equal(await js(`document.querySelector('[data-result-cell="slot:head:1"]').children.length`),0);
  let wrapTableWidth;
  for(const [width,height]of [[950,650],[1440,1000]]){
   win.setSize(width,height);await js(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
   assert(await js(`(()=>{const headers=[...document.querySelectorAll('[data-result-header]')],row=document.querySelector('.result-row');return headers.every(h=>{const cell=row.querySelector('[data-result-cell="'+h.dataset.resultHeader+'"]'),a=h.getBoundingClientRect(),b=cell.getBoundingClientRect();return getComputedStyle(h).textAlign==='center'&&getComputedStyle(cell).textAlign==='center'&&Math.abs((a.left+a.right)-(b.left+b.right))<1;})&&Math.abs(row.lastElementChild.getBoundingClientRect().right-(row.getBoundingClientRect().right-12))<2;})()`));
   const tableWidth=await js(`document.querySelector('.result-row').getBoundingClientRect().width`);if(wrapTableWidth!==undefined)assert(Math.abs(tableWidth-wrapTableWidth)<1);wrapTableWidth=tableWidth;assert(await js(`document.querySelector('.result-row').getBoundingClientRect().width<document.querySelector('#search-results').clientWidth`));
  }
  fs.writeFileSync(path.join(output,'alignment-preview.png'),(await win.webContents.capturePage()).toPNG());
  await js(`document.querySelector('#export-results').click()`);await wait(`!document.querySelector('#export-results').disabled`);
  assert(fs.readFileSync(target,'utf8').includes('"头部"'));assert(!fs.readFileSync(target,'utf8').includes('已修改候选'));
  await js(`document.querySelector('[data-result-column="slot:head:1"]').click()`);
  await wait(`!document.querySelector('[data-result-header="slot:head:1"]')`);
  const beforeCancel=fs.readFileSync(target,'utf8');
  dialog.showSaveDialog=async()=>({canceled:true});await js(`document.querySelector('#export-results').click()`);await wait(`!document.querySelector('#export-results').disabled`);assert.equal(fs.readFileSync(target,'utf8'),beforeCancel);
  dialog.showSaveDialog=async()=>({canceled:false,filePath:path.join(output,'missing-directory','results.csv')});await js(`document.querySelector('#export-results').click()`);await wait(`document.querySelector('#toast').textContent.startsWith('导出失败：')&&!document.querySelector('#export-results').disabled`);
  await js(`document.querySelector('#new-tab').click()`);assert.equal(await js(`document.querySelector('[data-result-column="slot:head:1"]').checked`),false);assert(await js(`document.querySelector('#export-results').disabled`));
  assert.equal(E.csv([['中文,引号"\n换行','=1+1','\t@SUM(A1)',-2,1.25]]),'\uFEFF"中文,引号""\n换行","\'=1+1","\'\t@SUM(A1)",-2,1.25\r\n');
  const fixture={items:[{id:'r1',slot:'finger',name:'戒指 A'},{id:'r2',slot:'finger',name:'戒指 B'},{id:'t1',slot:'trinket',name:'饰品 A'},{id:'t2',slot:'trinket',name:'饰品 B'},{id:'gem',slot:'gem',name:'宝石 A'},{id:'ench',slot:'enchant',name:'附魔 A'},{id:'buff',slot:'custom_buff',name:'增益 A'}],customSlots:[{id:'custom_buff',name:'增益'}]};
  const row={gear:['r1','r2','t1','t2'],consumables:['buff'],gems:[{id:'gem',count:2}],enchants:[{id:'ench',target:'r2'}],stats:{}};
  const values=E.slotValues(fixture,row);assert.equal(values['slot:finger:1'],'戒指 A');assert.equal(values['slot:finger:2'],'戒指 B');assert.equal(values['slot:trinket:1'],'饰品 A');assert.equal(values['slot:trinket:2'],'饰品 B');assert.equal(values['slot:gem:1'],'宝石 A × 2');assert.equal(values['slot:enchant:finger:1'],'');assert.equal(values['slot:enchant:finger:2'],'附魔 A');assert.equal(values['slot:custom_buff:1'],'增益 A');assert.equal(values['slot:off_hand:1'],'');
  const table=E.table(fixture,[row],[['slot:finger:1','戒指1']]);assert.equal(table[0].filter(label=>label==='戒指1').length,1);assert(table[0].includes('戒指2'));assert(table[0].includes('饰品2'));assert(!table[0].includes('配装'));assert.equal(table[1][table[0].indexOf('增益')],'增益 A');assert.equal(table[1][table[0].indexOf('戒指2附魔')],'附魔 A');assert(!table[0].includes('附魔'));
  assert.deepEqual(E.defaultSlotColumns({...fixture,items:fixture.items.map(i=>({...i,selected:true}))}),[]);
  assert.deepEqual(E.defaultSlotColumns({...fixture,items:[...fixture.items.map(i=>({...i,selected:true})),{id:'r3',slot:'finger',selected:true},{id:'t3',slot:'trinket',selected:true}]}),['slot:finger:1','slot:finger:2','slot:trinket:1','slot:trinket:2']);
  const weapons={...fixture,items:[...fixture.items,{id:'mh',slot:'main_hand',name:'主手武器'},{id:'oh',slot:'off_hand',name:'副手武器'},{id:'ench2',slot:'enchant',name:'附魔 B'}]};
  const weaponValues=E.slotValues(weapons,{...row,gear:[...row.gear,'mh','oh'],enchants:[{target:'r1',id:'ench2'},{target:'r2',id:'ench'},{target:'mh',id:'ench'},{target:'oh',id:'ench2'}]});assert.equal(weaponValues['slot:enchant:finger:1'],'附魔 B');assert.equal(weaponValues['slot:enchant:finger:2'],'附魔 A');assert.equal(weaponValues['slot:enchant:main_hand:1'],'附魔 A');assert.equal(weaponValues['slot:enchant:off_hand:1'],'附魔 B');
  fs.writeFileSync(path.join(output,'export-pass.txt'),'PASS: 60 retained results across pages; snapshot names and formula values; numeric percentages; UTF-8 BOM; CSV escaping; save, cancellation and write failure; empty character disabled; three option rows; multiple equipment candidates auto-show; manual choices persist; enchants split by exact ring and weapon target; header and cells centered at 950 and 1440, content-wrapped width stays stable across window sizes, rings and trinkets show automatically only above two candidates; snapshot and CSV regression passed.');
 }finally{dialog.showSaveDialog=original;}
};
