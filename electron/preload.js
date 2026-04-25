const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  savePdf: (filename, buffer) =>
    ipcRenderer.invoke('dialog:save-pdf', { filename, buffer }),

  saveFile: (filename, content, filters) =>
    ipcRenderer.invoke('dialog:save-file', { filename, content, filters }),

  getVersion: () => ipcRenderer.invoke('app:get-version'),

  platform: process.platform,
});
