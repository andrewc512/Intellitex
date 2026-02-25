const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs/promises");

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

const RECENTS_PATH = () =>
  path.join(app.getPath("userData"), "recent-files.json");

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
  return { filePath: null, content: "" };
});

ipcMain.handle("file:getRecents", async () => {
  return readRecents();
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
