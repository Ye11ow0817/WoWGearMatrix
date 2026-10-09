const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('simc', {exportResults: (table,filename) => ipcRenderer.invoke('results:export',table,filename), parse: (text,profile) => ipcRenderer.invoke('simc:parse', text, profile), load: () => ipcRenderer.invoke('state:load'), save: state => ipcRenderer.invoke('state:save', state)});
