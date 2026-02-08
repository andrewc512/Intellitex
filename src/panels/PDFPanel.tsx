export function PDFPanel() {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid #e0e0e0",
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #e0e0e0",
          fontSize: 12,
          color: "#666",
        }}
      >
        PDF PREVIEW
      </div>
      <div
        style={{
          flex: 1,
          padding: 16,
          background: "#f5f5f5",
          overflow: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ margin: 0, color: "#888" }}>
          Compiled PDF (pdf.js) will go here.
        </p>
      </div>
    </div>
  );
}
