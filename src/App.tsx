import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { EditorPanel } from "./panels/EditorPanel";
import { PDFPanel } from "./panels/PDFPanel";
import { AgentPanel } from "./panels/AgentPanel";
import { WelcomeScreen } from "./components/WelcomeScreen";
import type { CompileStatus } from "./compiler/types";

type PanelId = "editor" | "pdf" | "agent";

interface OpenFile {
  filePath: string | null;
  content: string;
}

function App() {
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);
  const contentRef = useRef<string>("");
  const [recents, setRecents] = useState<string[]>([]);
  const [compileState, setCompileState] = useState<CompileStatus>({ status: "idle" });
  const [panelOrder, setPanelOrder] = useState<PanelId[]>(["editor", "pdf", "agent"]);
  const [hiddenPanels, setHiddenPanels] = useState<Set<PanelId>>(new Set());

  const togglePanel = useCallback((id: PanelId) => {
    setHiddenPanels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const movePanel = useCallback((id: PanelId, direction: -1 | 1) => {
    setPanelOrder((prev) => {
      const idx = prev.indexOf(id);
      const target = idx + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }, []);

  const visiblePanels = useMemo(
    () => panelOrder.filter((id) => !hiddenPanels.has(id)),
    [panelOrder, hiddenPanels]
  );

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
    const result = await window.electronAPI.newFile();
    if (!result) return;
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
          {(["editor", "agent"] as PanelId[]).map((id) => (
            <button
              key={id}
              className={`btn-icon panel-toggle ${hiddenPanels.has(id) ? "panel-toggle--hidden" : ""}`}
              type="button"
              onClick={() => togglePanel(id)}
              aria-label={`${hiddenPanels.has(id) ? "Show" : "Hide"} ${id} panel`}
              title={`${hiddenPanels.has(id) ? "Show" : "Hide"} ${id}`}
            >
              {id === "editor" ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              )}
            </button>
          ))}

          <div className="header-separator" aria-hidden="true" />

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
        </div>
      </header>

      <PanelGroup direction="horizontal" style={{ flex: 1, minHeight: 0 }}>
        {visiblePanels.map((id, i) => {
          const isFirst = i === 0;
          const isLast = i === visiblePanels.length - 1;
          const canMoveLeft = !isFirst;
          const canMoveRight = !isLast;

          const panelContent = (() => {
            switch (id) {
              case "editor":
                return (
                  <EditorPanel
                    content={openFile.content}
                    filePath={openFile.filePath}
                    onChange={handleEditorChange}
                    onSave={handleSave}
                    onRename={handleRename}
                    onClose={() => togglePanel("editor")}
                    onMoveLeft={canMoveLeft ? () => movePanel("editor", -1) : undefined}
                    onMoveRight={canMoveRight ? () => movePanel("editor", 1) : undefined}
                  />
                );
              case "pdf":
                return (
                  <PDFPanel
                    compileState={compileState}
                    onMoveLeft={canMoveLeft ? () => movePanel("pdf", -1) : undefined}
                    onMoveRight={canMoveRight ? () => movePanel("pdf", 1) : undefined}
                  />
                );
              case "agent":
                return (
                  <AgentPanel
                    onClose={() => togglePanel("agent")}
                    onMoveLeft={canMoveLeft ? () => movePanel("agent", -1) : undefined}
                    onMoveRight={canMoveRight ? () => movePanel("agent", 1) : undefined}
                  />
                );
            }
          })();

          const defaultSizes: Record<PanelId, number> = { editor: 35, pdf: 40, agent: 25 };
          const minSizes: Record<PanelId, number> = { editor: 20, pdf: 20, agent: 15 };

          return (
            <Panel key={id} defaultSize={defaultSizes[id]} minSize={minSizes[id]}>
              {panelContent}
            </Panel>
          );
        }).reduce<React.ReactNode[]>((acc, panel, i) => {
          if (i > 0) {
            acc.push(
              <PanelResizeHandle key={`handle-${i}`} className="resize-handle" aria-label="Resize panel" />
            );
          }
          acc.push(panel);
          return acc;
        }, [])}
      </PanelGroup>
    </div>
  );
}

export default App;
