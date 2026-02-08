/**
 * Agent types (placeholder for future IPC / API contracts).
 */

export interface AgentContext {
  filePath?: string;
  content?: string;
  selection?: { startLine: number; endLine: number };
  compileErrors?: Array<{ file: string; line: number; message: string }>;
}

export interface AgentEdit {
  filePath: string;
  range: { startLine: number; startCol: number; endLine: number; endCol: number };
  newText: string;
}
