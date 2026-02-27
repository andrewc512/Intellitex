import type { CompileResult } from "../compiler/types";

interface ElectronAPI {
  openFile: () => Promise<{ filePath: string; content: string } | null>;
  openPath: (filePath: string) => Promise<{ filePath: string; content: string }>;
  newFile: (directory: string) => Promise<{ filePath: string; content: string }>;
  saveFile: (filePath: string, content: string) => Promise<void>;
  renameFile: (oldPath: string, newName: string) => Promise<string>;
  getRecents: () => Promise<string[]>;
  removeRecent: (filePath: string) => Promise<string[]>;
  chooseDirectory: () => Promise<string | null>;
  onMenuSave: (callback: () => void) => void;
  onMenuOpen: (callback: () => void) => void;
  onMenuNew: (callback: () => void) => void;
  compileFile: (filePath: string) => Promise<CompileResult>;
  readPDF: (pdfPath: string) => Promise<ArrayBuffer>;
  agentProcess: (context: import("../agent/types").AgentContext, userPrompt: string) => Promise<import("../agent/types").AgentResponse>;
  agentCheckApiKey: () => Promise<boolean>;
}
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
