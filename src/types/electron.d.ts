interface ElectronAPI {
  openFile: () => Promise<{ filePath: string; content: string } | null>;
  openPath: (filePath: string) => Promise<{ filePath: string; content: string }>;
  newFile: () => Promise<{ filePath: null; content: string }>;
  getRecents: () => Promise<string[]>;
}

interface Window {
  electronAPI: ElectronAPI;
}
