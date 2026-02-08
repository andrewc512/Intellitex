export function AgentPanel() {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
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
        AI ASSISTANT
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
          Agent chat and suggestions will go here.
        </p>
      </div>
      <div
        style={{
          padding: 12,
          borderTop: "1px solid #e0e0e0",
        }}
      >
        <input
          type="text"
          placeholder="Ask Copilot anything..."
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #e0e0e0",
            borderRadius: 6,
          }}
          readOnly
        />
      </div>
    </div>
  );
}
