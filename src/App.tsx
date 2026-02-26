import { useState, useCallback, useRef } from "react";
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
  const contentRef = useRef<string>("");

  const handleOpenFile = useCallback(async () => {
    const result = await window.electronAPI.openFile();
    if (result) {
      contentRef.current = result.content;
      setOpenFile(result);
    }
  }, []);

  const handleNewFile = useCallback(async () => {
    const dir = await window.electronAPI.chooseDirectory();
    if (!dir) return;
    const result = await window.electronAPI.newFile(dir);
    contentRef.current = result.content;
    setOpenFile(result);
  }, []);

  const handleOpenRecent = useCallback(async (filePath: string) => {
    const result = await window.electronAPI.openPath(filePath);
    contentRef.current = result.content;
    setOpenFile(result);
  }, []);

  const handleEditorChange = useCallback((value: string) => {
    contentRef.current = value;
    setOpenFile((prev) => (prev ? { ...prev, content: value } : null));
  }, []);

  const handleSave = useCallback(async () => {
    if (!openFile?.filePath) return;
    await window.electronAPI.saveFile(openFile.filePath, contentRef.current);
  }, [openFile?.filePath]);

  const handleRename = useCallback(
    async (newName: string) => {
      if (!openFile?.filePath) return;
      const newPath = await window.electronAPI.renameFile(openFile.filePath, newName);
      setOpenFile((prev) => (prev ? { ...prev, filePath: newPath } : null));
    },
    [openFile?.filePath]
  );

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
        <strong onClick={() => setOpenFile(null)}>Intellitex</strong>
        <div style={{ flex: 1 }} />
        <button type="button">Compile</button>
        <button type="button">Export</button>
      </header>
      <PanelGroup direction="horizontal" style={{ flex: 1, minHeight: 0 }}>
        <Panel defaultSize={35} minSize={20}>
          <EditorPanel
            content={openFile.content}
            filePath={openFile.filePath}
            onChange={handleEditorChange}
            onSave={handleSave}
            onRename={handleRename}
          />
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
