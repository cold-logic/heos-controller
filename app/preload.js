const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('heosAPI', {
  discover: () => ipcRenderer.invoke('heos:discover'),
  getPlayers: () => ipcRenderer.invoke('heos:getPlayers'),
  getVolume: (pid) => ipcRenderer.invoke('heos:getVolume', pid),
  getState: (pid) => ipcRenderer.invoke('heos:getState', pid),
  setVolume: (pid, level) => ipcRenderer.invoke('heos:setVolume', pid, level),
  setState: (pid, state) => ipcRenderer.invoke('heos:setState', pid, state),
  playPrev: (pid) => ipcRenderer.invoke('heos:playPrev', pid),
  playNext: (pid) => ipcRenderer.invoke('heos:playNext', pid),
  
  onPlayers: (callback) => ipcRenderer.on('heos:players', (_event, value) => callback(value)),
  onState: (callback) => ipcRenderer.on('heos:state', (_event, value) => callback(value)),
  onVolume: (callback) => ipcRenderer.on('heos:volume', (_event, value) => callback(value))
});