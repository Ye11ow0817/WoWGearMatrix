const { app, BrowserWindow, ipcMain, utilityProcess } = require('electron');
const path = require('node:path');
app.setPath('userData',path.join(app.getPath('appData'),'WoWGearMatrix'));
const smoke=process.argv.includes('--smoke-test');
if(smoke) {
  if(!process.env.SIMC_TEST_OUTPUT)throw Error('SIMC_TEST_OUTPUT required for isolated smoke tests');
  app.setPath('userData',path.join(process.env.SIMC_TEST_OUTPUT,'test-user-data'));
}
let win, active;
const ownsLock=smoke||app.requestSingleInstanceLock();
if(!ownsLock)app.quit();
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
function parse(text,profile) {
  if (typeof text !== 'string' || (!text.trim()&&!profile)) return Promise.resolve({ code: 1, report: '请输入 SimC 导出字符串。' });
  if (Buffer.byteLength(text, 'utf8') > 4 * 1024 * 1024) return Promise.resolve({ code: 1, report: '输入不能超过 4 MiB。' });
  if(profile!==undefined){
    const M=require('./model.js');
    if(!profile||!M.classes[profile.class]||!M.classes[profile.class].includes(profile.spec)||!M.races.includes(profile.race)||!Array.isArray(profile.disabledTraits)||profile.disabledTraits.length>100||profile.disabledTraits.some(n=>!Number.isInteger(n)||n<1||n>10000000)||!Array.isArray(profile.enabledTraits||[])||(profile.enabledTraits||[]).length>100||(profile.enabledTraits||[]).some(n=>!Number.isInteger(n)||n<1||n>10000000))return Promise.resolve({code:1,report:'角色选项无效。'});
  }
  if (active) return Promise.resolve({ code: 1, report: '正在解析，请稍候。' });
  return new Promise(resolve => {
    const child = utilityProcess.fork(path.join(__dirname, 'worker.cjs'), [], { stdio: 'ignore', serviceName: 'SimC Gear Resolver' });
    active = child;
    let done = false;
    const finish = result => { if (done) return; done = true; clearTimeout(timer); active = null; child.kill(); resolve(result); };
    const timer = setTimeout(() => finish({ code: 1, report: '解析超时（60 秒），请检查输入后重试。' }), 60000);
    child.on('message', finish);
    child.on('exit', code => finish({ code: 1, report: `解析进程提前退出（${code}）。` }));
    child.postMessage({data:text,profile});
  });
}
if(ownsLock)app.whenReady().then(async () => {
  const storage=require('./storage.cjs')(app.getPath('userData'));
  win = new BrowserWindow({ width: 1440, height: 1000, minWidth: 950, minHeight: 650, backgroundColor: '#111821', autoHideMenuBar: true, show: !smoke, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
  const handle=(name,fn)=>ipcMain.handle(name,(event,...args)=>{if(event.sender!==win.webContents || event.senderFrame!==win.webContents.mainFrame)throw Error('Invalid sender');return fn(...args);});
  handle('simc:parse',parse);
  handle('state:load',()=>storage.load());
  handle('state:save',state=>storage.save(state));
  await win.loadFile(path.join(__dirname,'index.html'));
  if(smoke) {
    try { await require(process.env.SIMC_TEST_SCRIPT || './test-ui.cjs')({win,parse,storage,output:process.env.SIMC_TEST_OUTPUT});app.exit(0); }
    catch(e) { console.error(e);app.exit(1); }
  }
}).catch(e=>{console.error(e);app.exit(1);});
app.on('window-all-closed', () => { if (active) active.kill(); app.quit(); });
