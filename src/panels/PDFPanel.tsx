import type { CompileStatus, CompileError } from "../compiler/types";

interface PDFPanelProps {
  compileState: CompileStatus;
}

function ErrorRow({ err }: { err: CompileError }) {
  const isError = err.type === "error";
  return (
    <div
      style={{
        padding: "6px 12px",
        borderBottom: "1px solid #e8e8e8",
        display: "flex",
        gap: 8,
        alignItems: "baseline",
        fontSize: 12,
        fontFamily: "monospace",
      }}
    >
      <span
        style={{
          color: isError ? "#c0392b" : "#e67e22",
          fontWeight: 600,
          flexShrink: 0,
          minWidth: 52,
        }}
      >
        {isError ? "error" : "warning"}
      </span>
      {err.line != null && (
        <span style={{ color: "#888", flexShrink: 0 }}>l.{err.line}</span>
      )}
      <span style={{ color: "#333" }}>{err.message}</span>
    </div>
  );
}

export function PDFPanel({ compileState }: PDFPanelProps) {
  const errors =
    compileState.status === "done"
      ? compileState.result.errors.filter((e) => e.type === "error")
      : [];
  const warnings =
    compileState.status === "done"
      ? compileState.result.errors.filter((e) => e.type === "warning")
      : [];

  const statusLabel = () => {
    if (compileState.status === "idle") return null;
    if (compileState.status === "compiling") return "Compiling…";
    const { success } = compileState.result;
    if (success) return `Done — ${errors.length} errors, ${warnings.length} warnings`;
    return `Failed — ${errors.length} errors, ${warnings.length} warnings`;
  };

  const statusColor = () => {
    if (compileState.status === "compiling") return "#888";
    if (compileState.status === "done")
      return compileState.result.success ? "#27ae60" : "#c0392b";
    return "#888";
  };

  return (
    <div className="panel" role="region" aria-label="PDF Preview">
      <div className="panel-header">
        <svg className="panel-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span className="panel-header-title">Preview</span>

        {statusLabel() && (
          <span style={{ color: statusColor(), marginLeft: "auto", fontSize: 12 }}>
            {statusLabel()}
          </span>
        )}

        <div className="pdf-toolbar" role="toolbar" aria-label="PDF controls">
          <button className="btn-icon" type="button" disabled aria-label="Zoom out">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button className="btn-icon" type="button" disabled aria-label="Zoom in">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>

      <div className="pdf-body" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="pdf-placeholder" style={{ flex: compileState.status === "done" && !compileState.result.success ? "0 0 40%" : 1 }}>
          {compileState.status === "idle" && (
            <>
              <svg className="pdf-placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="8" y1="13" x2="16" y2="13" />
                <line x1="8" y1="17" x2="13" y2="17" />
                <line x1="8" y1="9" x2="11" y2="9" />
              </svg>
              <p className="pdf-placeholder-text">
                Compile your document to see a live preview here
              </p>
              <span className="pdf-placeholder-hint">
                <kbd className="kbd">⌘</kbd>
                <kbd className="kbd">B</kbd>
                <span>to compile</span>
              </span>
            </>
          )}
          {compileState.status === "compiling" && (
            <p className="pdf-placeholder-text">Compiling…</p>
          )}
          {compileState.status === "done" && compileState.result.success && (
            <div style={{ textAlign: "center", padding: 16 }}>
              <p className="pdf-placeholder-text">PDF compiled successfully.</p>
              <span style={{ fontSize: 11, color: "#999", wordBreak: "break-all" }}>
                {compileState.result.pdfPath}
              </span>
              <br />
              <span style={{ fontSize: 11, color: "#aaa" }}>
                (pdf.js rendering coming soon)
              </span>
            </div>
          )}
          {compileState.status === "done" && !compileState.result.success && (
            <p style={{ margin: 0, color: "#c0392b", fontSize: 13 }}>
              Compilation failed — see errors below.
            </p>
          )}
        </div>

        {compileState.status === "done" && compileState.result.errors.length > 0 && (
          <div
            style={{
              flex: 1,
              overflow: "auto",
              borderTop: "1px solid var(--border-color, #e0e0e0)",
              background: "var(--bg-primary, #fff)",
              minHeight: 0,
            }}
          >
            <div
              style={{
                padding: "4px 12px",
                fontSize: 11,
                color: "#999",
                borderBottom: "1px solid var(--border-color, #f0f0f0)",
                background: "var(--bg-secondary, #fafafa)",
              }}
            >
              {errors.length > 0 && `${errors.length} error${errors.length !== 1 ? "s" : ""}`}
              {errors.length > 0 && warnings.length > 0 && "  ·  "}
              {warnings.length > 0 && `${warnings.length} warning${warnings.length !== 1 ? "s" : ""}`}
            </div>
            {compileState.result.errors.map((err, i) => (
              <ErrorRow key={i} err={err} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
