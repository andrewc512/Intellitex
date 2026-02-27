const { app, BrowserWindow, dialog, ipcMain, Menu } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const { compile } = require("./compiler");

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

const RECENTS_PATH = () =>
  path.join(app.getPath("userData"), "recent-files.json");

function createMenu( win ) {
  const menu = Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
        {
          label: "New File",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            win.webContents.send("menu:new");
          },
        },
        {
          label: "Open File…",
          accelerator: "CmdOrCtrl+O",
          click: () => {
            win.webContents.send("menu:open");
          },
        },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => {
            win.webContents.send("menu:save");
          },
        },
        {
          type: "separator",
        },
        {
          label: "Compile",
          accelerator: "CmdOrCtrl+B",
          click: () => {
            win.webContents.send("menu:compile");
          },
        },
        {
          type: "separator",
        },
        {
          role: "quit",
        }
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

async function readRecents() {
  try {
    const data = await fs.readFile(RECENTS_PATH(), "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function addRecent(filePath) {
  const recents = await readRecents();
  const updated = [filePath, ...recents.filter((p) => p !== filePath)].slice(
    0,
    10
  );
  await fs.writeFile(RECENTS_PATH(), JSON.stringify(updated), "utf-8");
  return updated;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  createMenu(win);

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

ipcMain.handle("dialog:openFile", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      { name: "LaTeX Files", extensions: ["tex", "bib", "cls", "sty"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  if (canceled || filePaths.length === 0) return null;
  const filePath = filePaths[0];
  const content = await fs.readFile(filePath, "utf-8");
  await addRecent(filePath);
  return { filePath, content };
});

ipcMain.handle("file:openPath", async (_event, filePath) => {
  const content = await fs.readFile(filePath, "utf-8");
  await addRecent(filePath);
  return { filePath, content };
});

ipcMain.handle("file:new", async () => {
  const { canceled, filePath: rawPath } = await dialog.showSaveDialog({
    title: "New IntelliTex File",
    defaultPath: "untitled.tex",
    filters: [{ name: "IntelliTex Files", extensions: ["tex"] }],
  });
  if (canceled || !rawPath) return null;

  const filePath = rawPath.endsWith(".tex") ? rawPath : rawPath + ".tex";
  const template = [
    "\\documentclass{article}",
    "",
    "\\begin{document}",
    "",
    "Hello, world!",
    "",
    "\\end{document}",
  ].join("\n");
  await fs.writeFile(filePath, template, "utf-8");
  await addRecent(filePath);
  return { filePath, content: template };
});

ipcMain.handle("file:save", async (_event, filePath, content) => {
  await fs.writeFile(filePath, content, "utf-8");
});

ipcMain.handle("file:rename", async (_event, oldPath, newName) => {
  const dir = path.dirname(oldPath);
  const newPath = path.join(dir, newName.endsWith(".tex") ? newName : newName + ".tex");

  if (newPath === oldPath) return oldPath;

  let targetExists = false;
  try {
    await fs.access(newPath);
    targetExists = true;
  } catch {
    // file doesn't exist, safe to proceed
  }

  if (targetExists) {
    const win = BrowserWindow.getFocusedWindow();
    const { response } = await dialog.showMessageBox(win, {
      type: "warning",
      title: "File already exists",
      message: `"${path.basename(newPath)}" already exists in this directory.`,
      detail: "Renaming will replace the existing file. This cannot be undone.",
      buttons: ["Replace", "Cancel"],
      defaultId: 1,
      cancelId: 1,
    });
    if (response === 1) return oldPath;
  }

  await fs.rename(oldPath, newPath);

  const recents = await readRecents();
  const filtered = recents.filter((p) => p !== oldPath);
  const updated = [newPath, ...filtered].slice(0, 10);
  await fs.writeFile(RECENTS_PATH(), JSON.stringify(updated), "utf-8");

  return newPath;
});

ipcMain.handle("file:getRecents", async () => {
  return readRecents();
});

ipcMain.handle("compile:file", async (_event, filePath) => {
  return compile(filePath);
});

ipcMain.handle("pdf:read", async (_event, pdfPath) => {
  const buffer = await fs.readFile(pdfPath);
  return buffer;
});

ipcMain.handle("file:removeRecent", async (_event, filePath) => {
  const recents = await readRecents();
  const updated = recents.filter((p) => p !== filePath);
  await fs.writeFile(RECENTS_PATH(), JSON.stringify(updated), "utf-8");
  return updated;
});

ipcMain.handle("file:chooseDirectory", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  if (canceled || filePaths.length === 0) return null;
  return filePaths[0];
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
