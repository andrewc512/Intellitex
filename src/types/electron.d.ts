interface ElectronAPI {
  openFile: () => Promise<{ filePath: string; content: string } | null>;
  openPath: (filePath: string) => Promise<{ filePath: string; content: string }>;
  newFile: (directory: string) => Promise<{ filePath: string; content: string }>;
  saveFile: (filePath: string, content: string) => Promise<void>;
  renameFile: (oldPath: string, newName: string) => Promise<string>;
  getRecents: () => Promise<string[]>;
  chooseDirectory: () => Promise<string | null>;
}

interface Window {
  electronAPI: ElectronAPI;
}
