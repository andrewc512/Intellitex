export interface CompileError {
  message: string;
  line: number | null;
  type: "error" | "warning";
}

export interface CompileResult {
  success: boolean;
  pdfPath: string | null;
  errors: CompileError[];
  log: string;
}

export type CompileStatus =
  | { status: "idle" }
  | { status: "compiling" }
  | { status: "done"; result: CompileResult };
