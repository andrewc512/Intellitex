export function EditorPanel() {
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
        EDITOR
      </div>
      <div
        style={{
          flex: 1,
          padding: 16,
          background: "#fafafa",
          overflow: "auto",
        }}
      >
        <p style={{ margin: 0, color: "#888" }}>
          LaTeX editor (Monaco) will go here.
        </p>
      </div>
    </div>
  );
}
