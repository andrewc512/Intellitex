import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { EditorPanel } from "./panels/EditorPanel";
import { PDFPanel } from "./panels/PDFPanel";
import { AgentPanel } from "./panels/AgentPanel";

function App() {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          padding: "8px 16px",
          borderBottom: "1px solid #e0e0e0",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <strong>Intellitex</strong>
        <button type="button">Compile</button>
        <button type="button">Export</button>
      </header>
      <PanelGroup direction="horizontal" style={{ flex: 1, minHeight: 0 }}>
        <Panel defaultSize={35} minSize={20}>
          <EditorPanel />
        </Panel>
        <PanelResizeHandle style={{ width: 6, background: "#e0e0e0" }} />
        <Panel defaultSize={40} minSize={20}>
          <PDFPanel />
        </Panel>
        <PanelResizeHandle style={{ width: 6, background: "#e0e0e0" }} />
        <Panel defaultSize={25} minSize={15}>
          <AgentPanel />
        </Panel>
      </PanelGroup>
    </div>
  );
}

export default App;
