const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Placeholder for future IPC: file, compile, agent
  // on: (channel, fn) => ipcRenderer.on(channel, (_, ...args) => fn(...args)),
  // invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
});
