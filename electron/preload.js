const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openFile: () => ipcRenderer.invoke("dialog:openFile"),
  openPath: (filePath) => ipcRenderer.invoke("file:openPath", filePath),
  newFile: () => ipcRenderer.invoke("file:new"),
  getRecents: () => ipcRenderer.invoke("file:getRecents"),
});
