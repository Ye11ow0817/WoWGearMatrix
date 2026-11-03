const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({win,output})=>{
 win.webContents.setBackgroundThrottling(false);
 const js=code=>win.webContents.executeJavaScript(code);
 const wait=async code=>{for(let i=0;i<200;i++){if(await js(code))return;await new Promise(r=>setTimeout(r,50));}throw Error('UI wait: '+code);};
 await wait(`state&&!document.querySelector('#app').hidden`);
 await js(`{const c=current();c.baseStats=Object.fromEntries(M.itemStats.map(([k])=>[k,0]));c.basePercents=Object.fromEntries(RatingConversion.keys.map(k=>[k,0]));c.items=[{id:M.id(),slot:'head',name:'加速回归',origin:'custom',source:'custom',selected:true,ilevel:300,boe:false,mainType:'strength',stats:{...c.baseStats,speed:100},socket:false,set:false,embellishment:false}];c.filters={};c.sort={limit:50};c.resultPercent=true;c.resultColumns=['speed'];render();save();document.querySelector('#run-search').click();}`);
 await wait(`document.querySelector('#search-status').textContent.startsWith('计算完成')`);
 assert.equal(await js(`document.querySelector('[data-result-cell="speed"]').textContent`),'100 (8.44%)');
 await js(`document.querySelector('.result-row').click()`);
 assert((await js(`document.querySelector('#result-drawer').textContent`)).includes('100 (8.44%)'));
 await js(`document.querySelector('#drawer-close').click();document.querySelector('#tab-filters').click();{const e=document.querySelector('[data-range="speed"][data-bound="min"][data-unit="percent"]');e.value='8';e.dispatchEvent(new Event('input',{bubbles:true}));}`);
 assert.equal(await js(`document.querySelector('[data-range="speed"][data-bound="min"]:not([data-unit])').value`),'95');
 await js(`document.querySelector('#run-search').click()`);
 await wait(`document.querySelector('#search-status').textContent.startsWith('计算完成')`);
 assert.equal(await js(`document.querySelector('[data-result-cell="speed"]').textContent`),'100 (8.44%)');
 fs.writeFileSync(path.join(output,'speed-percent-pass.txt'),'PASS: result and drawer show 100 (8.44%); 8% minimum converts to 95 rating and retains the result.');
};
