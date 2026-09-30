importScripts('presets.js','model.js','rating-data.js','mastery-data.js','rating.js','search.js');
onmessage=async({data})=>{
 try{const task=GearSearch.createSearch(data);let last=0;while(true){const done=task.step(500),now=Date.now();if(done||now-last>=250){postMessage({type:'progress',...task.snapshot()});last=now;}if(done)return;await new Promise(r=>setTimeout(r,0));}}
 catch(error){postMessage({type:'error',message:error.message});}
};
