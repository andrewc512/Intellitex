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
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid #e0e0e0",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #e0e0e0",
          fontSize: 12,
          color: "#666",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span>PDF PREVIEW</span>
        {statusLabel() && (
          <span style={{ color: statusColor(), marginLeft: "auto" }}>
            {statusLabel()}
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* PDF area (placeholder until pdf.js) */}
        <div
          style={{
            flex: compileState.status === "done" && !compileState.result.success ? "0 0 40%" : 1,
            background: "#f5f5f5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {compileState.status === "idle" && (
            <p style={{ margin: 0, color: "#888", fontSize: 13 }}>
              Press <strong>Compile</strong> to build the PDF.
            </p>
          )}
          {compileState.status === "compiling" && (
            <p style={{ margin: 0, color: "#888", fontSize: 13 }}>Compiling…</p>
          )}
          {compileState.status === "done" && compileState.result.success && (
            <p style={{ margin: 0, color: "#555", fontSize: 13, textAlign: "center", padding: 16 }}>
              PDF compiled successfully.
              <br />
              <span style={{ fontSize: 11, color: "#999", wordBreak: "break-all" }}>
                {compileState.result.pdfPath}
              </span>
              <br />
              <span style={{ fontSize: 11, color: "#aaa" }}>
                (pdf.js rendering coming soon)
              </span>
            </p>
          )}
          {compileState.status === "done" && !compileState.result.success && (
            <p style={{ margin: 0, color: "#c0392b", fontSize: 13 }}>
              Compilation failed — see errors below.
            </p>
          )}
        </div>

        {/* Error / warning list */}
        {compileState.status === "done" && compileState.result.errors.length > 0 && (
          <div
            style={{
              flex: 1,
              overflow: "auto",
              borderTop: "1px solid #e0e0e0",
              background: "#fff",
              minHeight: 0,
            }}
          >
            <div
              style={{
                padding: "4px 12px",
                fontSize: 11,
                color: "#999",
                borderBottom: "1px solid #f0f0f0",
                background: "#fafafa",
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
