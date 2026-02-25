import { useState, useCallback } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { EditorPanel } from "./panels/EditorPanel";
import { PDFPanel } from "./panels/PDFPanel";
import { AgentPanel } from "./panels/AgentPanel";
import { WelcomeScreen } from "./components/WelcomeScreen";

interface OpenFile {
  filePath: string | null;
  content: string;
}

function App() {
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);

  const handleOpenFile = useCallback(async () => {
    const result = await window.electronAPI.openFile();
    if (result) setOpenFile(result);
  }, []);

  const handleNewFile = useCallback(async () => {
    const result = await window.electronAPI.newFile();
    setOpenFile(result);
  }, []);

  const handleOpenRecent = useCallback(async (filePath: string) => {
    const result = await window.electronAPI.openPath(filePath);
    setOpenFile(result);
  }, []);

  if (!openFile) {
    return (
      <WelcomeScreen
        onOpenFile={handleOpenFile}
        onNewFile={handleNewFile}
        onOpenRecent={handleOpenRecent}
      />
    );
  }

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
        <span style={{ fontSize: 13, color: "#6b7280" }}>
          {openFile.filePath
            ? openFile.filePath.split("/").pop()
            : "Untitled.tex"}
        </span>
        <div style={{ flex: 1 }} />
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
