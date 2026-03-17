import React, { useState, useCallback, useRef, useEffect, useMemo, Suspense } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { FileTreeSidebar } from "./components/FileTreeSidebar";
import { TabBar } from "./components/TabBar";
import { ImagePreview } from "./components/ImagePreview";
import { SettingsModal } from "./components/SettingsModal";
import { useTheme } from "./hooks/useTheme";
import { ThemeDropdown } from "./components/ThemeDropdown";
import type { CompileStatus } from "./compiler/types";
import type { EditorSelection } from "./agent/types";
import type { FileTreeNode } from "./types/electron";

const EditorPanel = React.lazy(() =>
  import("./panels/EditorPanel").then((m) => ({ default: m.EditorPanel }))
);

const PDFPanel = React.lazy(() =>
  import("./panels/PDFPanel").then((m) => ({ default: m.PDFPanel }))
);

const AgentPanel = React.lazy(() =>
  import("./panels/AgentPanel").then((m) => ({ default: m.AgentPanel }))
);

type PanelId = "editor" | "pdf" | "agent";

interface Project {
  rootDir: string;
  name: string;
}

interface OpenTab {
  filePath: string;
  content: string;
  isDirty: boolean;
  isImage?: boolean;
}

interface PendingDiff {
  filePath: string;
  original: string;
  modified: string;
}

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp", ".eps", ".ico"]);
function isImagePath(p: string): boolean {
  const dot = p.lastIndexOf(".");
  return dot >= 0 && IMAGE_EXTS.has(p.slice(dot).toLowerCase());
}

function App() {
  const iconUrl = (name: string) => `${import.meta.env.BASE_URL}icons/${name}`;

  const [project, setProject] = useState<Project | null>(null);
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const contentRef = useRef<string>("");
  const [recents, setRecents] = useState<string[]>([]);
  const [compileState, setCompileState] = useState<CompileStatus>({ status: "idle" });
  const [panelOrder, setPanelOrder] = useState<PanelId[]>(["editor", "pdf", "agent"]);
  const [hiddenPanels, setHiddenPanels] = useState<Set<PanelId>>(new Set());
  const { theme, setTheme } = useTheme();
  const [chatAttachment, setChatAttachment] = useState<EditorSelection | null>(null);
  const [pendingDiff, setPendingDiff] = useState<PendingDiff | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKeyVersion, setApiKeyVersion] = useState(0);
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const editorInsertRef = useRef<((text: string) => void) | null>(null);

  const activeTab = useMemo(
    () => openTabs.find((t) => t.filePath === activeTabPath) ?? null,
    [openTabs, activeTabPath]
  );

  const handleAddToChat = useCallback((selection: EditorSelection) => {
    setChatAttachment(selection);
    setHiddenPanels((prev) => {
      if (!prev.has("agent")) return prev;
      const next = new Set(prev);
      next.delete("agent");
      return next;
    });
  }, []);

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
    window.electronAPI.getRecentProjects().then(setRecents);
  }, []);

  // ── Project operations ──────────────────────

  const openProjectAndMainFile = useCallback(async (info: Project) => {
    setProject(info);
    setOpenTabs([]);
    setActiveTabPath(null);
    contentRef.current = "";
    setCompileState({ status: "idle" });
    setPendingDiff(null);

    const tree = await window.electronAPI.readProjectTree(info.rootDir);
    setFileTree(tree);
    const mainFile =
      tree.find((n) => n.type === "file" && n.name === "main.tex") ||
      tree.find((n) => n.type === "file" && n.name.endsWith(".tex")) ||
      tree.find((n) => n.type === "file" && n.name.endsWith(".itek"));
    if (mainFile) {
      const data = await window.electronAPI.openPath(mainFile.path);
      contentRef.current = data.content;
      setOpenTabs([{ filePath: data.filePath, content: data.content, isDirty: false }]);
      setActiveTabPath(data.filePath);
    }

    const updatedRecents = await window.electronAPI.getRecentProjects();
    setRecents(updatedRecents);
  }, []);

  const handleOpenProject = useCallback(async () => {
    const result = await window.electronAPI.openProject();
    if (!result) return;
    await openProjectAndMainFile(result);
  }, [openProjectAndMainFile]);

  const handleNewProject = useCallback(async () => {
    const result = await window.electronAPI.newProject();
    if (!result) return;
    await openProjectAndMainFile(result);
  }, [openProjectAndMainFile]);

  const handleOpenRecent = useCallback(async (dirPath: string) => {
    const result = await window.electronAPI.openProjectPath(dirPath);
    await openProjectAndMainFile(result);
  }, [openProjectAndMainFile]);

  const handleRemoveRecent = useCallback(async (dirPath: string) => {
    const updated = await window.electronAPI.removeRecentProject(dirPath);
    setRecents(updated);
  }, []);

  const handleCloseProject = useCallback(() => {
    setProject(null);
    setOpenTabs([]);
    setActiveTabPath(null);
    contentRef.current = "";
    setCompileState({ status: "idle" });
    setPendingDiff(null);
    setFileTree([]);
  }, []);

  const refreshFileTree = useCallback(async () => {
    if (!project) return;
    const tree = await window.electronAPI.readProjectTree(project.rootDir);
    setFileTree(tree);
  }, [project]);

  // ── File tree operations ────────────────────

  const handleFileTreeSelect = useCallback(async (filePath: string) => {
    const existing = openTabs.find((t) => t.filePath === filePath);
    if (existing) {
      setActiveTabPath(filePath);
      contentRef.current = existing.content;
      return;
    }
    const data = await window.electronAPI.openPath(filePath);
    contentRef.current = data.content;
    setOpenTabs((prev) => [
      ...prev,
      { filePath: data.filePath, content: data.content, isDirty: false },
    ]);
    setActiveTabPath(data.filePath);
    setCompileState({ status: "idle" });
  }, [openTabs]);

  const handleTreeCreateFile = useCallback(async (parentDir: string, fileName: string) => {
    const result = await window.electronAPI.createFile(parentDir, fileName);
    if ("error" in result) return;
    await refreshFileTree();
    contentRef.current = result.content;
    setOpenTabs((prev) => [
      ...prev,
      { filePath: result.filePath, content: result.content, isDirty: false },
    ]);
    setActiveTabPath(result.filePath);
  }, [refreshFileTree]);

  const handleTreeCreateFolder = useCallback(async (parentDir: string, folderName: string) => {
    const result = await window.electronAPI.createFolder(parentDir, folderName);
    if ("error" in result) return;
    await refreshFileTree();
  }, [refreshFileTree]);

  const handleTreeDelete = useCallback(async (entryPath: string) => {
    await window.electronAPI.deleteFile(entryPath);
    setOpenTabs((prev) => prev.filter((t) => !t.filePath.startsWith(entryPath)));
    if (activeTabPath?.startsWith(entryPath)) {
      setActiveTabPath(null);
      contentRef.current = "";
    }
    await refreshFileTree();
  }, [refreshFileTree, activeTabPath]);

  const handleTreeRename = useCallback(async (oldPath: string, newName: string) => {
    const result = await window.electronAPI.renameEntry(oldPath, newName);
    if ("error" in result) return;
    setOpenTabs((prev) =>
      prev.map((tab) => {
        if (tab.filePath === oldPath) return { ...tab, filePath: result.newPath };
        if (tab.filePath.startsWith(oldPath + "/")) {
          return { ...tab, filePath: tab.filePath.replace(oldPath, result.newPath) };
        }
        return tab;
      })
    );
    if (activeTabPath === oldPath) setActiveTabPath(result.newPath);
    else if (activeTabPath?.startsWith(oldPath + "/")) {
      setActiveTabPath(activeTabPath.replace(oldPath, result.newPath));
    }
    await refreshFileTree();
  }, [refreshFileTree, activeTabPath]);

  // ── Tab operations ─────────────────────────

  const handleSelectTab = useCallback((filePath: string) => {
    const tab = openTabs.find((t) => t.filePath === filePath);
    if (!tab) return;
    setActiveTabPath(filePath);
    contentRef.current = tab.content;
  }, [openTabs]);

  const handleCloseTab = useCallback((filePath: string) => {
    setOpenTabs((prev) => {
      const idx = prev.findIndex((t) => t.filePath === filePath);
      if (idx === -1) return prev;
      const next = prev.filter((t) => t.filePath !== filePath);
      if (filePath === activeTabPath) {
        const newActive = next[Math.min(idx, next.length - 1)] ?? null;
        setActiveTabPath(newActive?.filePath ?? null);
        contentRef.current = newActive?.content ?? "";
      }
      return next;
    });
  }, [activeTabPath]);

  // ── Image operations ───────────────────────

  const handleImageSelect = useCallback((filePath: string) => {
    const existing = openTabs.find((t) => t.filePath === filePath);
    if (existing) {
      setActiveTabPath(filePath);
      return;
    }
    setOpenTabs((prev) => [
      ...prev,
      { filePath, content: "", isDirty: false, isImage: true },
    ]);
    setActiveTabPath(filePath);
  }, [openTabs]);

  const handleInsertImage = useCallback((filePath: string) => {
    if (!project) return;
    const relPath = filePath.startsWith(project.rootDir + "/")
      ? filePath.slice(project.rootDir.length + 1)
      : filePath.split("/").pop()!;
    const snippet = `\\includegraphics{${relPath}}`;
    if (editorInsertRef.current) {
      editorInsertRef.current(snippet);
    }
  }, [project]);

  const handleExternalFileDrop = useCallback(async (sourcePath: string, destDir: string) => {
    const result = await window.electronAPI.copyFileIn(sourcePath, destDir);
    if ("error" in result) return;
    await refreshFileTree();
  }, [refreshFileTree]);

  // ── File operations within project ──────────

  const handleNewFileInProject = useCallback(async () => {
    if (!project) return;
    const result = await window.electronAPI.newProjectFile(project.rootDir);
    if (!result) return;
    contentRef.current = result.content;
    setOpenTabs((prev) => [
      ...prev,
      { filePath: result.filePath, content: result.content, isDirty: false },
    ]);
    setActiveTabPath(result.filePath);
    setCompileState({ status: "idle" });
    await refreshFileTree();
  }, [project, refreshFileTree]);

  const handleOpenFileInProject = useCallback(async () => {
    const result = await window.electronAPI.openFile();
    if (!result) return;
    const existing = openTabs.find((t) => t.filePath === result.filePath);
    if (existing) {
      setActiveTabPath(result.filePath);
      contentRef.current = existing.content;
      return;
    }
    contentRef.current = result.content;
    setOpenTabs((prev) => [
      ...prev,
      { filePath: result.filePath, content: result.content, isDirty: false },
    ]);
    setActiveTabPath(result.filePath);
    setCompileState({ status: "idle" });
  }, [openTabs]);

  // ── Editor operations ───────────────────────

  const handleEditorChange = useCallback(
    (value: string) => {
      contentRef.current = value;
      if (!activeTabPath) return;
      setOpenTabs((prev) =>
        prev.map((tab) =>
          tab.filePath === activeTabPath
            ? { ...tab, content: value, isDirty: true }
            : tab
        )
      );
    },
    [activeTabPath]
  );

  const handleSave = useCallback(async () => {
    if (!activeTabPath || isImagePath(activeTabPath)) return;
    await window.electronAPI.saveFile(activeTabPath, contentRef.current);
    setOpenTabs((prev) =>
      prev.map((tab) =>
        tab.filePath === activeTabPath ? { ...tab, isDirty: false } : tab
      )
    );
  }, [activeTabPath]);

  const handleCompile = useCallback(async () => {
    if (!activeTabPath || isImagePath(activeTabPath)) return;
    await window.electronAPI.saveFile(activeTabPath, contentRef.current);
    setOpenTabs((prev) =>
      prev.map((tab) =>
        tab.filePath === activeTabPath ? { ...tab, isDirty: false } : tab
      )
    );
    setCompileState({ status: "compiling" });
    const result = await window.electronAPI.compileFile(activeTabPath);
    setCompileState({ status: "done", result });
  }, [activeTabPath]);

  const handleRename = useCallback(
    async (newName: string) => {
      if (!activeTabPath) return;
      const newPath = await window.electronAPI.renameFile(activeTabPath, newName);
      setOpenTabs((prev) =>
        prev.map((tab) =>
          tab.filePath === activeTabPath ? { ...tab, filePath: newPath } : tab
        )
      );
      setActiveTabPath(newPath);
    },
    [activeTabPath]
  );

  const handleFileEdited = useCallback(
    (editedPath: string, newContent: string) => {
      if (!activeTabPath || activeTabPath !== editedPath) return;
      setPendingDiff({
        filePath: editedPath,
        original: contentRef.current,
        modified: newContent,
      });
    },
    [activeTabPath]
  );

  const handleAcceptDiff = useCallback(() => {
    if (!pendingDiff) return;
    contentRef.current = pendingDiff.modified;
    setOpenTabs((prev) =>
      prev.map((tab) =>
        tab.filePath === pendingDiff.filePath
          ? { ...tab, content: pendingDiff.modified, isDirty: true }
          : tab
      )
    );
    setPendingDiff(null);
  }, [pendingDiff]);

  const handleDiscardDiff = useCallback(() => {
    setPendingDiff(null);
  }, []);

  // ── Menu listeners ──────────────────────────

  useEffect(() => {
    const cleanupSave = window.electronAPI.onMenuSave(() => handleSave());
    const cleanupOpen = window.electronAPI.onMenuOpen(() => {
      if (project) handleOpenFileInProject();
      else handleOpenProject();
    });
    const cleanupNew = window.electronAPI.onMenuNew(() => {
      if (project) handleNewFileInProject();
      else handleNewProject();
    });
    const cleanupCompile = window.electronAPI.onMenuCompile(() => handleCompile());
    return () => {
      cleanupSave();
      cleanupOpen();
      cleanupNew();
      cleanupCompile();
    };
  }, [
    handleSave,
    handleOpenProject,
    handleNewProject,
    handleOpenFileInProject,
    handleNewFileInProject,
    handleCompile,
    project,
  ]);

  // ── Render ──────────────────────────────────

  if (!project) {
    return (
      <WelcomeScreen
        onOpenProject={handleOpenProject}
        onNewProject={handleNewProject}
        onOpenRecent={handleOpenRecent}
        onRemoveRecent={handleRemoveRecent}
        recents={recents}
        theme={theme}
        onSetTheme={setTheme}
      />
    );
  }

  return (
    <div className="app-root">
      <header className="app-header" role="banner">
        <button
          className="header-brand"
          onClick={handleCloseProject}
          aria-label="Return to home screen"
          type="button"
        >
          <img className="header-brand-icon" src={iconUrl("logo.png")} alt="" aria-hidden="true" />
          <span className="header-brand-name">IntelliTex</span>
        </button>

        <div className="header-separator" aria-hidden="true" />

        <span className="header-filepath" title={project.rootDir}>
          {project.name}
        </span>

        <div className="header-spacer" />

        <div className="header-actions" role="toolbar" aria-label="Document actions">
          <button
            className={`btn-icon panel-toggle ${!sidebarVisible ? "panel-toggle--hidden" : ""}`}
            type="button"
            onClick={() => setSidebarVisible((v) => !v)}
            aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
            title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>

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

          <button
            className="btn-icon"
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Open settings"
            title="Settings"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>

          <ThemeDropdown theme={theme} onSetTheme={setTheme} />

          <div className="header-separator" aria-hidden="true" />

          <button
            className="btn"
            type="button"
            aria-label="Compile LaTeX document"
            onClick={handleCompile}
            disabled={compileState.status === "compiling" || !activeTab || !!activeTab.isImage}
          >
            <img className="btn-img-icon" src={iconUrl("icon-compile.png")} alt="" aria-hidden="true" />
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
                  <div className="editor-with-sidebar">
                    {sidebarVisible && project && (
                      <FileTreeSidebar
                        rootDir={project.rootDir}
                        projectName={project.name}
                        tree={fileTree}
                        activeFilePath={activeTabPath}
                        onFileSelect={handleFileTreeSelect}
                        onImageSelect={handleImageSelect}
                        onInsertImage={handleInsertImage}
                        onExternalFileDrop={handleExternalFileDrop}
                        onCreateFile={handleTreeCreateFile}
                        onCreateFolder={handleTreeCreateFolder}
                        onDeleteEntry={handleTreeDelete}
                        onRenameEntry={handleTreeRename}
                        onRefresh={refreshFileTree}
                      />
                    )}
                    <div className="editor-main">
                      <TabBar
                        tabs={openTabs}
                        activeTabPath={activeTabPath}
                        onSelectTab={handleSelectTab}
                        onCloseTab={handleCloseTab}
                      />
                      {activeTab?.isImage ? (
                        <ImagePreview
                          filePath={activeTab.filePath}
                          projectRoot={project.rootDir}
                        />
                      ) : (
                        <Suspense fallback={<div className="panel-loading">Loading editor…</div>}>
                          <EditorPanel
                            content={activeTab?.content ?? ""}
                            filePath={activeTab?.filePath ?? null}
                            theme={theme}
                            onChange={handleEditorChange}
                            onSave={handleSave}
                            onRename={handleRename}
                            onAddToChat={handleAddToChat}
                            onInsertRef={editorInsertRef}
                            pendingDiff={pendingDiff}
                            onAcceptDiff={handleAcceptDiff}
                            onDiscardDiff={handleDiscardDiff}
                            onClose={() => togglePanel("editor")}
                            onMoveLeft={canMoveLeft ? () => movePanel("editor", -1) : undefined}
                            onMoveRight={canMoveRight ? () => movePanel("editor", 1) : undefined}
                          />
                        </Suspense>
                      )}
                    </div>
                  </div>
                );
              case "pdf":
                return (
                  <Suspense fallback={<div className="panel-loading">Loading PDF viewer…</div>}>
                    <PDFPanel
                      compileState={compileState}
                      onMoveLeft={canMoveLeft ? () => movePanel("pdf", -1) : undefined}
                      onMoveRight={canMoveRight ? () => movePanel("pdf", 1) : undefined}
                    />
                  </Suspense>
                );
              case "agent":
                return (
                  <Suspense fallback={<div className="panel-loading">Loading assistant…</div>}>
                    <AgentPanel
                      filePath={activeTab?.filePath ?? null}
                      content={activeTab?.content ?? ""}
                      compileErrors={
                        compileState.status === "done"
                          ? compileState.result.errors
                              .filter((e) => e.type === "error" && e.line !== null)
                              .map((e) => ({ file: activeTab?.filePath ?? "unknown", line: e.line!, message: e.message }))
                          : undefined
                      }
                      chatAttachment={chatAttachment}
                      onClearAttachment={() => setChatAttachment(null)}
                      onFileEdited={handleFileEdited}
                      onClose={() => togglePanel("agent")}
                      onMoveLeft={canMoveLeft ? () => movePanel("agent", -1) : undefined}
                      onMoveRight={canMoveRight ? () => movePanel("agent", 1) : undefined}
                      onOpenSettings={() => setSettingsOpen(true)}
                      apiKeyVersion={apiKeyVersion}
                    />
                  </Suspense>
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
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onApiKeyChanged={() => setApiKeyVersion((v) => v + 1)}
      />
    </div>
  );
}

export default App;
