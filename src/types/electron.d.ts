import type { CompileResult } from "../compiler/types";

interface AppSettings {
  provider: string;
  model: string;
  hasKeys: { openai: boolean; anthropic: boolean; google: boolean };
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
}

export interface ProjectInfo {
  rootDir: string;
  name: string;
}

interface ElectronAPI {
  // File operations
  openFile: () => Promise<{ filePath: string; content: string } | null>;
  openPath: (filePath: string) => Promise<{ filePath: string; content: string }>;
  newFile: () => Promise<{ filePath: string; content: string } | null>;
  newItekFile: () => Promise<{ filePath: string; content: string } | null>;
  saveFile: (filePath: string, content: string) => Promise<void>;
  renameFile: (oldPath: string, newName: string) => Promise<string>;
  getRecents: () => Promise<string[]>;
  removeRecent: (filePath: string) => Promise<string[]>;
  chooseDirectory: () => Promise<string | null>;

  // Project operations
  openProject: () => Promise<ProjectInfo | null>;
  openProjectPath: (dirPath: string) => Promise<ProjectInfo>;
  newProject: () => Promise<ProjectInfo | null>;
  readProjectTree: (rootDir: string) => Promise<FileTreeNode[]>;
  getRecentProjects: () => Promise<string[]>;
  removeRecentProject: (dirPath: string) => Promise<string[]>;
  newProjectFile: (rootDir: string) => Promise<{ filePath: string; content: string } | null>;

  // Menu events
  onMenuSave: (callback: () => void) => () => void;
  onMenuOpen: (callback: () => void) => () => void;
  onMenuNew: (callback: () => void) => () => void;
  onMenuCompile: (callback: () => void) => () => void;

  // Compile & PDF
  compileFile: (filePath: string) => Promise<CompileResult>;
  readPDF: (pdfPath: string) => Promise<ArrayBuffer>;

  // Agent
  agentProcess: (context: import("../agent/types").AgentContext, userPrompt: string, history: { role: string; content: string }[]) => Promise<import("../agent/types").AgentResponse>;
  agentCheckApiKey: () => Promise<boolean>;

  // Settings
  getSettings: () => Promise<AppSettings>;
  saveSettings: (patch: { provider?: string; model?: string }) => Promise<AppSettings>;
  setApiKey: (provider: string, key: string) => Promise<void>;
  onAgentProgress: (callback: (status: import("../agent/types").AgentProgress) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
