const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('omnia', {
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  saveFiles: (dir, files) => ipcRenderer.invoke('save-files', dir, files),
  revealFile: (p) => ipcRenderer.invoke('reveal-file', p)
});
