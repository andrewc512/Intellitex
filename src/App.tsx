import { useState, useCallback, useRef, useEffect } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { EditorPanel } from "./panels/EditorPanel";
import { PDFPanel } from "./panels/PDFPanel";
import { AgentPanel } from "./panels/AgentPanel";
import { WelcomeScreen } from "./components/WelcomeScreen";
import type { CompileStatus } from "./compiler/types";

interface OpenFile {
  filePath: string | null;
  content: string;
}

function App() {
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);
  const contentRef = useRef<string>("");
  const [recents, setRecents] = useState<string[]>([]);
  const [compileState, setCompileState] = useState<CompileStatus>({ status: "idle" });

  useEffect(() => {
    window.electronAPI.getRecents().then(setRecents);
  }, []);

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

  useEffect(() => {
    window.electronAPI.onMenuSave(() => handleSave());
  }, [handleSave]);

  const handleCompile = useCallback(async () => {
    if (!openFile?.filePath) return;
    // Save first so the compiled file is up to date
    await window.electronAPI.saveFile(openFile.filePath, contentRef.current);
    setCompileState({ status: "compiling" });
    const result = await window.electronAPI.compileFile(openFile.filePath);
    setCompileState({ status: "done", result });
  }, [openFile?.filePath]);

  const handleRename = useCallback(
    async (newName: string) => {
      if (!openFile?.filePath) return; 
      //console.log("renaming from", openFile.filePath, "to", newName);
      const newPath = await window.electronAPI.renameFile(openFile.filePath, newName);
      //console.log("new path returned:", newPath)
      setOpenFile((prev) => (prev ? { ...prev, filePath: newPath } : null));
      const updatedRecents = await window.electronAPI.getRecents();
      console.log("updated recents:", updatedRecents)
      setRecents(updatedRecents);
    },
    [openFile?.filePath]
  );

  if (!openFile) {
    return (
      <WelcomeScreen
        onOpenFile={handleOpenFile}
        onNewFile={handleNewFile}
        onOpenRecent={handleOpenRecent}
        recents={recents}
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
        <button
          type="button"
          onClick={handleCompile}
          disabled={compileState.status === "compiling"}
        >
          {compileState.status === "compiling" ? "Compiling…" : "Compile"}
        </button>
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
          <PDFPanel compileState={compileState} />
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
