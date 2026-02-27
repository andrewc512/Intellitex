const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openFile: () => ipcRenderer.invoke("dialog:openFile"),
  openPath: (filePath) => ipcRenderer.invoke("file:openPath", filePath),
  chooseDirectory: () => ipcRenderer.invoke("file:chooseDirectory"),
  newFile: () => ipcRenderer.invoke("file:new"),
  getRecents: () => ipcRenderer.invoke("file:getRecents"),
  removeRecent: (filePath) => ipcRenderer.invoke("file:removeRecent", filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke("file:save", filePath, content),
  renameFile: (oldPath, newName) => ipcRenderer.invoke("file:rename", oldPath, newName),
  onMenuSave: (callback) => {
    ipcRenderer.on("menu:save", callback);
    return () => ipcRenderer.removeListener("menu:save", callback);
  },
  onMenuOpen: (callback) => {
    ipcRenderer.on("menu:open", callback);
    return () => ipcRenderer.removeListener("menu:open", callback);
  },
  onMenuNew: (callback) => {
    ipcRenderer.on("menu:new", callback);
    return () => ipcRenderer.removeListener("menu:new", callback);
  },
  onMenuCompile: (callback) => {
    ipcRenderer.on("menu:compile", callback);
    return () => ipcRenderer.removeListener("menu:compile", callback);
  },
  compileFile: (filePath) => ipcRenderer.invoke("compile:file", filePath),
  readPDF: (pdfPath) => ipcRenderer.invoke("pdf:read", pdfPath),
  agentProcess: (context, userPrompt) => ipcRenderer.invoke("agent:process", context, userPrompt),
  agentCheckApiKey: () => ipcRenderer.invoke("agent:checkApiKey"),
  onAgentProgress: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on("agent:progress", handler);
    return () => ipcRenderer.removeListener("agent:progress", handler);
  },
});
