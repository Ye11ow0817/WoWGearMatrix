const fs=require('node:fs');
const path=require('node:path');
const {validateState}=require('../shared/model.js');
module.exports = directory => {
  const file=path.join(directory,'characters-v2.json');
  let blocked=false;
  return {
    load() {
      if(!fs.existsSync(file))return null;
      try { return validateState(JSON.parse(fs.readFileSync(file,'utf8'))); }
      catch(e) { blocked=true; throw Error('本地角色文件读取失败，已停止自动保存以保护原文件。'+e.message); }
    },
    save(state) {
      if(blocked)throw Error('角色文件读取失败，不能覆盖原文件。');
      validateState(state);
      const json=JSON.stringify(state);
      if(Buffer.byteLength(json)>64*1024*1024)throw Error('角色数据超过 64 MiB，未保存。');
      fs.mkdirSync(directory,{recursive:true});
      const temp=file+'.tmp';
      fs.writeFileSync(temp,json,'utf8');
      if(fs.existsSync(file))fs.copyFileSync(file,file+'.bak');
      fs.renameSync(temp,file);
      return true;
    }
  };
};
