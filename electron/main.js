require("dotenv").config();
const { app, BrowserWindow, dialog, ipcMain, Menu } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const { compile } = require("./compiler");
const { processAgentRequest, checkApiKey, getApiKey } = require("./agent/index");
const settings = require("./settings");

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

const RECENTS_PATH = () =>
  path.join(app.getPath("userData"), "recent-files.json");

const RECENT_PROJECTS_PATH = () =>
  path.join(app.getPath("userData"), "recent-projects.json");

function createMenu( win ) {
  const menu = Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
        {
          label: "New…",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            win.webContents.send("menu:new");
          },
        },
        {
          label: "Open…",
          accelerator: "CmdOrCtrl+O",
          click: () => {
            win.webContents.send("menu:open");
          },
        },
        {
          label: "Save & Compile",
          accelerator: "CmdOrCtrl+S",
          click: () => {
            win.webContents.send("menu:compile");
          },
        },
        {
          type: "separator",
        },
        {
          label: "Compile",
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

async function readRecentProjects() {
  try {
    const data = await fs.readFile(RECENT_PROJECTS_PATH(), "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function addRecentProject(dirPath) {
  const recents = await readRecentProjects();
  const updated = [dirPath, ...recents.filter((p) => p !== dirPath)].slice(0, 10);
  await fs.writeFile(RECENT_PROJECTS_PATH(), JSON.stringify(updated), "utf-8");
  return updated;
}

async function readDirTree(dirPath, depth = 0, maxDepth = 5) {
  if (depth >= maxDepth) return [];
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
  const sorted = entries
    .filter((e) => !e.name.startsWith("."))
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  const nodes = [];
  for (const entry of sorted) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const children = await readDirTree(fullPath, depth + 1, maxDepth);
      nodes.push({ name: entry.name, path: fullPath, type: "directory", children });
    } else {
      nodes.push({ name: entry.name, path: fullPath, type: "file" });
    }
  }
  return nodes;
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
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

ipcMain.handle("dialog:openFile", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      { name: "IntelliTex Files", extensions: ["itek", "tex", "bib", "cls", "sty"] },
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
    filters: [{ name: "LaTeX Files", extensions: ["tex"] }],
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

const ITEK_TEMPLATE = `@resume Your Name

#socials
  number: 1234567890
  email: <your@email.com>
  linkedin: <https://linkedin.com/in/yourprofile>
  github: <https://github.com/yourusername>

#education
  school: "University Name"
  loc: "City, State"
  degree: "B.S. Your Major"
  gpa: 4.00
  grad: "Month Year"

#experience
  company Company Name
    role: "Your Role"
    loc: "City, State"
    date: "Start – End"
    * Your accomplishment here

#skills
  languages: Language1, Language2, Language3
  frameworks: Framework1, Framework2
  technologies: Tool1, Tool2, Tool3

#projects
  project Project Name
    stack: "Tech1, Tech2, Tech3"
    date: "Month Year"
    * What you built and its impact

#leadership
  organization Organization Name
    role: "Your Role"
    loc: "City, State"
    date: "Start – Present"
    * Your contribution or initiative here
`;

ipcMain.handle("file:newItek", async () => {
  const { canceled, filePath: rawPath } = await dialog.showSaveDialog({
    title: "New itek Resume",
    defaultPath: "resume.itek",
    filters: [{ name: "itek Resume", extensions: ["itek"] }],
  });
  if (canceled || !rawPath) return null;

  const filePath = rawPath.endsWith(".itek") ? rawPath : rawPath + ".itek";
  await fs.writeFile(filePath, ITEK_TEMPLATE, "utf-8");
  await addRecent(filePath);
  return { filePath, content: ITEK_TEMPLATE };
});

ipcMain.handle("file:save", async (_event, filePath, content) => {
  await fs.writeFile(filePath, content, "utf-8");
});

ipcMain.handle("file:rename", async (_event, oldPath, newName) => {
  const dir = path.dirname(oldPath);
  const oldExt = path.extname(oldPath).toLowerCase();
  const hasKnownExt = [".tex", ".itek", ".bib", ".cls", ".sty"].includes(
    path.extname(newName).toLowerCase()
  );
  const newPath = path.join(dir, hasKnownExt ? newName : newName + oldExt);

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
  const recents = await readRecents();
  const existing = [];
  for (const p of recents) {
    try {
      await fs.access(p);
      existing.push(p);
    } catch {
      // file no longer exists — skip
    }
  }
  if (existing.length !== recents.length) {
    await fs.writeFile(RECENTS_PATH(), JSON.stringify(existing), "utf-8");
  }
  return existing;
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

// ── Project operations ────────────────────────

ipcMain.handle("project:open", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  if (canceled || filePaths.length === 0) return null;
  const rootDir = filePaths[0];
  await addRecentProject(rootDir);
  return { rootDir, name: path.basename(rootDir) };
});

ipcMain.handle("project:openPath", async (_event, dirPath) => {
  await addRecentProject(dirPath);
  return { rootDir: dirPath, name: path.basename(dirPath) };
});

ipcMain.handle("project:new", async () => {
  const { canceled, filePath: rawPath } = await dialog.showSaveDialog({
    title: "Create New Project",
    defaultPath: "Untitled_Project",
    buttonLabel: "Create",
  });
  if (canceled || !rawPath) return null;

  await fs.mkdir(rawPath, { recursive: true });

  const mainPath = path.join(rawPath, "main.tex");
  const template = [
    "\\documentclass{article}",
    "\\usepackage{graphicx}",
    "",
    "\\begin{document}",
    "",
    "Hello, world!",
    "",
    "\\end{document}",
  ].join("\n");
  await fs.writeFile(mainPath, template, "utf-8");

  await addRecentProject(rawPath);
  return { rootDir: rawPath, name: path.basename(rawPath) };
});

ipcMain.handle("project:readTree", async (_event, rootDir) => {
  return readDirTree(rootDir);
});

ipcMain.handle("project:getRecents", async () => {
  const recents = await readRecentProjects();
  const existing = [];
  for (const p of recents) {
    try {
      const stat = await fs.stat(p);
      if (stat.isDirectory()) existing.push(p);
    } catch {
      // directory no longer exists — skip
    }
  }
  if (existing.length !== recents.length) {
    await fs.writeFile(RECENT_PROJECTS_PATH(), JSON.stringify(existing), "utf-8");
  }
  return existing;
});

ipcMain.handle("project:removeRecent", async (_event, dirPath) => {
  const recents = await readRecentProjects();
  const updated = recents.filter((p) => p !== dirPath);
  await fs.writeFile(RECENT_PROJECTS_PATH(), JSON.stringify(updated), "utf-8");
  return updated;
});

ipcMain.handle("project:newFile", async (_event, rootDir) => {
  const { canceled, filePath: rawPath } = await dialog.showSaveDialog({
    title: "New File",
    defaultPath: path.join(rootDir, "untitled.tex"),
    filters: [
      { name: "LaTeX Files", extensions: ["tex"] },
      { name: "BibTeX Files", extensions: ["bib"] },
      { name: "itek Files", extensions: ["itek"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  if (canceled || !rawPath) return null;

  let template = "";
  if (rawPath.endsWith(".tex")) template = "% New file\n";
  else if (rawPath.endsWith(".itek")) template = ITEK_TEMPLATE;
  await fs.writeFile(rawPath, template, "utf-8");
  return { filePath: rawPath, content: template };
});

ipcMain.handle("project:createFile", async (_event, parentDir, fileName) => {
  const filePath = path.join(parentDir, fileName);
  try {
    await fs.access(filePath);
    return { error: "A file with that name already exists." };
  } catch {
    // does not exist — safe to create
  }
  let template = "";
  if (fileName.endsWith(".tex")) template = "% New file\n";
  else if (fileName.endsWith(".itek")) template = ITEK_TEMPLATE;
  await fs.writeFile(filePath, template, "utf-8");
  return { filePath, content: template };
});

ipcMain.handle("project:createFolder", async (_event, parentDir, folderName) => {
  const folderPath = path.join(parentDir, folderName);
  try {
    await fs.access(folderPath);
    return { error: "A folder with that name already exists." };
  } catch {
    // does not exist — safe to create
  }
  await fs.mkdir(folderPath, { recursive: true });
  return { folderPath };
});

ipcMain.handle("project:deleteFile", async (_event, filePath) => {
  const stat = await fs.stat(filePath);
  if (stat.isDirectory()) {
    await fs.rm(filePath, { recursive: true, force: true });
  } else {
    await fs.unlink(filePath);
  }
});

ipcMain.handle("project:renameEntry", async (_event, oldPath, newName) => {
  const dir = path.dirname(oldPath);
  const newPath = path.join(dir, newName);
  if (newPath === oldPath) return oldPath;
  try {
    await fs.access(newPath);
    return { error: "An item with that name already exists." };
  } catch {
    // does not exist — safe to rename
  }
  await fs.rename(oldPath, newPath);
  return { newPath };
});

// ── Image operations ──────────────────────────

ipcMain.handle("project:readImage", async (_event, filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
  };
  const mime = mimeMap[ext];
  if (!mime) return { error: "Unsupported image format" };
  const buffer = await fs.readFile(filePath);
  const base64 = buffer.toString("base64");
  return { dataUrl: `data:${mime};base64,${base64}` };
});

ipcMain.handle("project:copyFileIn", async (_event, sourcePath, destDir) => {
  const name = path.basename(sourcePath);
  const destPath = path.join(destDir, name);
  try {
    await fs.access(destPath);
    const win = BrowserWindow.getFocusedWindow();
    const { response } = await dialog.showMessageBox(win, {
      type: "warning",
      title: "File already exists",
      message: `"${name}" already exists in this folder.`,
      detail: "Copying will replace the existing file.",
      buttons: ["Replace", "Cancel"],
      defaultId: 1,
      cancelId: 1,
    });
    if (response === 1) return { error: "cancelled" };
  } catch {
    // does not exist — safe to copy
  }
  await fs.copyFile(sourcePath, destPath);
  return { destPath };
});

// ── Agent operations ──────────────────────────

ipcMain.handle("agent:process", async (event, context, userPrompt, history) => {
  const apiKey = await getApiKey();
  if (!apiKey) return { error: "No API key configured. Open Settings to add one." };
  const s = await settings.loadSettings();
  const sender = event.sender;
  try {
    return await processAgentRequest(context, userPrompt, apiKey, (status) => {
      sender.send("agent:progress", status);
    }, history, { model: s.model });
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("agent:checkApiKey", () => checkApiKey());

ipcMain.handle("settings:get", () => settings.getPublicSettings());
ipcMain.handle("settings:save", (_event, patch) => settings.saveSettings(patch));
ipcMain.handle("settings:setApiKey", (_event, provider, key) => settings.setApiKey(provider, key));

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
