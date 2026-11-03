const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{dialog}=require('electron');
module.exports=async({win,output})=>{
 const js=code=>win.webContents.executeJavaScript(code);
 const wait=async code=>{for(let n=0;n<250;n++){if(await js(code))return;await new Promise(r=>setTimeout(r,40));}throw Error('UI wait: '+code);};
 await wait(`state&&!document.querySelector('#app').hidden`);
 assert(await js(`document.querySelector('#export-results').disabled&&document.querySelector('#export-selected-results').disabled`));
 await js(`{const c=current();c.name='导出模式';c.baseStats=Object.fromEntries(M.itemStats.map(([k])=>[k,0]));c.basePercents=Object.fromEntries(RatingConversion.keys.map(k=>[k,0]));c.items=Array.from({length:60},(_,n)=>({id:'head-'+n,slot:'head',name:'测试头部 '+n,origin:'custom',source:'custom',selected:true,ilevel:300,mainType:'strength',stats:{...Object.fromEntries(M.itemStats.map(([k])=>[k,100])),crit:n+1},socket:false,set:false,embellishment:false}));c.filters={};c.sort={limit:100,rules:[{type:'formula',expression:'暴击-精通',direction:'desc'}]};c.resultPercent=false;c.resultColumns=['crit'];c.resultSlotVisibility={'slot:head:1':false,'slot:neck:1':true};render();save();document.querySelector('#run-search').click();}`);
 await wait(`document.querySelector('#search-status').textContent.startsWith('计算完成')`);
 assert.equal(await js(`document.querySelectorAll('.result-row').length`),50);
 await js(`document.querySelector('#page-next').click()`);
 const original=dialog.showSaveDialog;let calls=0,lastPath;
 const target=path.join(output,'mode.csv');
 dialog.showSaveDialog=async(_win,opts)=>{calls++;lastPath=opts.defaultPath;assert.match(path.basename(lastPath),/^导出模式-[0-9]{12}[.]csv$/);if(calls>1)assert.equal(path.dirname(lastPath),output);return {canceled:false,filePath:target};};
 const exportFile=async id=>{const before=calls;await js(`document.querySelector('#${id}').click()`);await wait(`!document.querySelector('#export-results').disabled&&!document.querySelector('#export-selected-results').disabled`);assert.equal(calls,before+1);assert.equal(await js(`document.querySelector('#page-number').value`),'2');return fs.readFileSync(target,'utf8');};
 const header=csv=>csv.split('\r\n')[0].replace(/^\uFEFF/,'').split(',').map(s=>s.slice(1,-1));
 const rowCount=csv=>csv.split('\r\n').filter(line=>/^[0-9]+,/.test(line)).length;
 try{
 const selected=await exportFile('export-selected-results');assert.deepEqual(header(selected),['序号','暴击','暴击-精通','项链']);assert.equal(rowCount(selected),60);assert(selected.includes('"-"'));assert(!selected.includes('测试头部'));
 const all=await exportFile('export-results'),labels=header(all);
 const stats=['暴击','急速','精通','全能','暴击 (%)','急速 (%)','精通 (%)','全能 (%)','闪避','吸血','加速','闪避 (%)','吸血 (%)','加速 (%)'];
 assert.deepEqual(labels.slice(labels.indexOf('暴击'),labels.indexOf('暴击')+14),stats);for(const label of ['耐力','护甲','力量','孔','套装','美化','头部','项链','戒指2附魔','宝石','食物','合剂','暴击-精通'])assert(labels.includes(label));assert.equal(rowCount(all),60);assert(all.includes('测试头部'));assert.equal((all.split('\r\n')[1].match(/"[0-9.]+%"/g)||[]).length,7);
 await js(`document.querySelector('#result-percent').click()`);
 const percent=await exportFile('export-selected-results');assert.deepEqual(header(percent),['序号','暴击','暴击 (%)','暴击-精通','项链']);assert.equal(rowCount(percent),60);assert.equal((percent.split('\r\n')[1].match(/"[0-9.]+%"/g)||[]).length,1);
 for(const [width,height]of [[950,650],[1440,1000]]){
 win.setSize(width,height);await js(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
 assert(await js(`(()=>{const a=document.querySelector('#export-results').getBoundingClientRect(),b=document.querySelector('#export-selected-results').getBoundingClientRect(),o=document.querySelector('.result-options').getBoundingClientRect();return [a,b].every(r=>r.width>0&&r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight)&&(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top)&&[a,b].every(r=>r.left>=o.right||r.right<=o.left||r.top>=o.bottom||r.bottom<=o.top);})()`));
 }
 let finish;dialog.showSaveDialog=()=>new Promise(resolve=>finish=resolve);await js(`document.querySelector('#export-selected-results').click()`);await wait(`document.querySelector('#export-results').disabled&&document.querySelector('#export-selected-results').disabled`);assert(finish);finish({canceled:true});await wait(`!document.querySelector('#export-results').disabled&&!document.querySelector('#export-selected-results').disabled`);
 fs.writeFileSync(path.join(output,'export-modes-pass.txt'),'PASS: both export modes retain all 60 rows across pages; all exports all attributes, seven percentages, counts and slots; selected exports checked columns and follows percentage toggle; filenames, remembered path, empty placeholders, both-button lock, and 950/1440 layouts passed.');
 }finally{dialog.showSaveDialog=original;}
};
