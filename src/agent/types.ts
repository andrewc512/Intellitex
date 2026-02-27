export interface AgentContext {
  filePath?: string;
  content?: string;
  selection?: { startLine: number; endLine: number };
  compileErrors?: Array<{ file: string; line: number; message: string }>;
}

export interface AgentResponse {
  message: string;
  error?: string;
  /** Files the agent wrote: absolute path → new content. */
  editedFiles?: Record<string, string>;
}

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
  requestId?: number;
}

export type AgentProgress =
  | { type: "status"; message: string }
  | { type: "delta"; content: string }
  | { type: "reset" };
