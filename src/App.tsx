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
      setCompileState({ status: "idle" });
    }
  }, []);

  const handleNewFile = useCallback(async () => {
    const dir = await window.electronAPI.chooseDirectory();
    if (!dir) return;
    const result = await window.electronAPI.newFile(dir);
    contentRef.current = result.content;
    setOpenFile(result);
    setCompileState({ status: "idle" });
  }, []);

  const handleOpenRecent = useCallback(async (filePath: string) => {
    const result = await window.electronAPI.openPath(filePath);
    contentRef.current = result.content;
    setOpenFile(result);
    setCompileState({ status: "idle" });
  }, []);

  const handleRemoveRecent = useCallback(async (filePath: string) => {
    const updated = await window.electronAPI.removeRecent(filePath);
    setRecents(updated);
  }, []);

  const handleEditorChange = useCallback((value: string) => {
    contentRef.current = value;
    setOpenFile((prev) => (prev ? { ...prev, content: value } : null));
  }, []);

  const handleSave = useCallback(async () => {
    if (!openFile?.filePath) return;
    await window.electronAPI.saveFile(openFile.filePath, contentRef.current);
  }, [openFile?.filePath]);

  const handleCompile = useCallback(async () => {
    if (!openFile?.filePath) return;
    // Save first so the compiled file is up to date
    await window.electronAPI.saveFile(openFile.filePath, contentRef.current);
    setCompileState({ status: "compiling" });
    const result = await window.electronAPI.compileFile(openFile.filePath);
    setCompileState({ status: "done", result });
  }, [openFile?.filePath]);

  useEffect(() => {
    const cleanupSave = window.electronAPI.onMenuSave(() => handleSave());
    const cleanupOpen = window.electronAPI.onMenuOpen(() => handleOpenFile());
    const cleanupNew = window.electronAPI.onMenuNew(() => handleNewFile());
    const cleanupCompile = window.electronAPI.onMenuCompile(() => handleCompile());
    return () => {
      cleanupSave();
      cleanupOpen();
      cleanupNew();
      cleanupCompile();
    };
  }, [handleSave, handleOpenFile, handleNewFile, handleCompile]);

  const handleRename = useCallback(
    async (newName: string) => {
      if (!openFile?.filePath) return;
      const newPath = await window.electronAPI.renameFile(openFile.filePath, newName);
      setOpenFile((prev) => (prev ? { ...prev, filePath: newPath } : null));
      const updatedRecents = await window.electronAPI.getRecents();
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
        onRemoveRecent={handleRemoveRecent}
        recents={recents}
      />
    );
  }

  const parentDir = openFile.filePath
    ? openFile.filePath.split("/").slice(-2, -1)[0]
    : null;

  return (
    <div className="app-root">
      <header className="app-header" role="banner">
        <button
          className="header-brand"
          onClick={() => setOpenFile(null)}
          aria-label="Return to home screen"
          type="button"
        >
          <img className="header-brand-icon" src="/icons/logo.png" alt="" aria-hidden="true" />
          <span className="header-brand-name">IntelliTex</span>
        </button>

        <div className="header-separator" aria-hidden="true" />

        {parentDir && (
          <span className="header-filepath" title={openFile.filePath ?? undefined}>
            {parentDir} /
          </span>
        )}

        <div className="header-spacer" />

        <div className="header-actions" role="toolbar" aria-label="Document actions">
          <button
            className="btn"
            type="button"
            aria-label="Compile LaTeX document"
            onClick={handleCompile}
            disabled={compileState.status === "compiling"}
          >
            <img className="btn-img-icon" src="/icons/icon-compile.png" alt="" aria-hidden="true" />
            {compileState.status === "compiling" ? "Compiling…" : "Compile"}
          </button>
          <button className="btn" type="button" aria-label="Export document">
            <img className="btn-img-icon" src="/icons/icon-export.png" alt="" aria-hidden="true" />
            Export
          </button>
        </div>
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
        <PanelResizeHandle className="resize-handle" aria-label="Resize editor panel" />
        <Panel defaultSize={40} minSize={20}>
          <PDFPanel compileState={compileState} />
        </Panel>
        <PanelResizeHandle className="resize-handle" aria-label="Resize PDF panel" />
        <Panel defaultSize={25} minSize={15}>
          <AgentPanel />
        </Panel>
      </PanelGroup>
    </div>
  );
}

export default App;
