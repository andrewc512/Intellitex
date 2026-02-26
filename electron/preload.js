const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openFile: () => ipcRenderer.invoke("dialog:openFile"),
  openPath: (filePath) => ipcRenderer.invoke("file:openPath", filePath),
  chooseDirectory: () => ipcRenderer.invoke("file:chooseDirectory"),
  newFile: (directory) => ipcRenderer.invoke("file:new", directory),
  getRecents: () => ipcRenderer.invoke("file:getRecents"),
  saveFile: (filePath, content) => ipcRenderer.invoke("file:save", filePath, content),
  renameFile: (oldPath, newName) => ipcRenderer.invoke("file:rename", oldPath, newName),
  onMenuSave: (callback) => ipcRenderer.on("menu:save", callback)
});
