const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('omnia', {
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  saveFiles: (dir, files) => ipcRenderer.invoke('save-files', dir, files),
  revealFile: (p) => ipcRenderer.invoke('reveal-file', p),
  videoStart: (dir, name, fps, w, h, audio) => ipcRenderer.invoke('video-start', dir, name, fps, w, h, audio || null),
  videoFrame: (id, dataUrl) => ipcRenderer.invoke('video-frame', id, dataUrl),
  videoFinish: (id) => ipcRenderer.invoke('video-finish', id),
  videoCancel: (id) => ipcRenderer.invoke('video-cancel', id),
  audioSave: (name, data) => ipcRenderer.invoke('audio-save', name, data),
  audioClear: (id) => ipcRenderer.invoke('audio-clear', id)
});
