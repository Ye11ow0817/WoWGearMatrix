const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({win,storage,output})=>{
 win.webContents.setBackgroundThrottling(false);
 const js=code=>win.webContents.executeJavaScript(code);
 const wait=async code=>{for(let i=0;i<1200;i++){if(await js(code))return;await new Promise(r=>setTimeout(r,50));}throw Error('UI timeout: '+code);};
 await wait(`!document.querySelector('#app').hidden`);
 const input='warrior="Names"\nlevel=90\nrace=human\nspec=arms\nhead=original_export_token,id=271456\nmain_hand=original_weapon_token,id=5549\nmain_hand=,id=5549\n';
 await js(`{const input=document.querySelector('#input');input.value=${JSON.stringify(input)};input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#parse').click();}`);
 await wait(`!document.querySelector('#parse').disabled&&document.querySelector('#save-status').textContent==='已保存到本机'`);
 const state=storage.load(),character=state.characters.find(c=>c.id===state.activeId);
 assert.equal(character.attributeContext.dataVersion,require('./engine/manifest.json').gameData);
 const names=character.items.filter(i=>i.origin==='import').map(i=>i.name);
 assert.deepEqual(names,['翡翠督军的淬火战角','original_weapon_token','Fast Test Dagger']);
 const displayed=await js(`[...document.querySelectorAll('.item-name')].map(e=>e.textContent)`);
 for(const name of names)assert(displayed.includes(name),`Missing displayed item name: ${name}`);
 const evidence={dataVersion:character.attributeContext.dataVersion,names,dictionaryVersion:require('./data/item-names.source.json').extensionVersion};
 fs.writeFileSync(path.join(output,'engine-update-ui.json'),JSON.stringify(evidence,null,2));
 console.log('PASS: Electron worker, JSON dictionary loading, three name priorities, displayed cards and saved character.');
};
