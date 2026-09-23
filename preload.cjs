const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('simc', {parse: text => ipcRenderer.invoke('simc:parse', text), load: () => ipcRenderer.invoke('state:load'), save: state => ipcRenderer.invoke('state:save', state)});
