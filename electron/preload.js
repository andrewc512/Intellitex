const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // File operations
  openFile: () => ipcRenderer.invoke("dialog:openFile"),
  openPath: (filePath) => ipcRenderer.invoke("file:openPath", filePath),
  chooseDirectory: () => ipcRenderer.invoke("file:chooseDirectory"),
  newFile: () => ipcRenderer.invoke("file:new"),
  newItekFile: () => ipcRenderer.invoke("file:newItek"),
  getRecents: () => ipcRenderer.invoke("file:getRecents"),
  removeRecent: (filePath) => ipcRenderer.invoke("file:removeRecent", filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke("file:save", filePath, content),
  renameFile: (oldPath, newName) => ipcRenderer.invoke("file:rename", oldPath, newName),

  // Project operations
  openProject: () => ipcRenderer.invoke("project:open"),
  openProjectPath: (dirPath) => ipcRenderer.invoke("project:openPath", dirPath),
  newProject: () => ipcRenderer.invoke("project:new"),
  readProjectTree: (rootDir) => ipcRenderer.invoke("project:readTree", rootDir),
  getRecentProjects: () => ipcRenderer.invoke("project:getRecents"),
  removeRecentProject: (dirPath) => ipcRenderer.invoke("project:removeRecent", dirPath),
  newProjectFile: (rootDir) => ipcRenderer.invoke("project:newFile", rootDir),
  createFile: (parentDir, fileName) => ipcRenderer.invoke("project:createFile", parentDir, fileName),
  createFolder: (parentDir, folderName) => ipcRenderer.invoke("project:createFolder", parentDir, folderName),
  deleteFile: (filePath) => ipcRenderer.invoke("project:deleteFile", filePath),
  renameEntry: (oldPath, newName) => ipcRenderer.invoke("project:renameEntry", oldPath, newName),
  readImage: (filePath) => ipcRenderer.invoke("project:readImage", filePath),
  copyFileIn: (sourcePath, destDir) => ipcRenderer.invoke("project:copyFileIn", sourcePath, destDir),
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
  agentProcess: (context, userPrompt, history) => ipcRenderer.invoke("agent:process", context, userPrompt, history),
  agentCheckApiKey: () => ipcRenderer.invoke("agent:checkApiKey"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (patch) => ipcRenderer.invoke("settings:save", patch),
  setApiKey: (provider, key) => ipcRenderer.invoke("settings:setApiKey", provider, key),
  onAgentProgress: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on("agent:progress", handler);
    return () => ipcRenderer.removeListener("agent:progress", handler);
  },
});
