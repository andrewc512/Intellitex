import { useState, useRef, useEffect, useCallback, type PointerEvent as ReactPointerEvent } from "react";
import type { FileTreeNode } from "../types/electron";

interface FileTreeSidebarProps {
  rootDir: string;
  projectName: string;
  tree: FileTreeNode[];
  activeFilePath: string | null;
  onFileSelect: (filePath: string) => void;
  onImageSelect: (filePath: string) => void;
  onInsertImage: (filePath: string) => void;
  onExternalFileDrop: (sourcePath: string, destDir: string) => void;
  onCreateFile: (parentDir: string, fileName: string) => void;
  onCreateFolder: (parentDir: string, folderName: string) => void;
  onDeleteEntry: (entryPath: string) => void;
  onRenameEntry: (oldPath: string, newName: string) => void;
  onRefresh: () => void;
}

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".eps", ".pdf"]);
const TEXT_EXTENSIONS = new Set([".tex", ".bib", ".cls", ".sty", ".itek", ".txt", ".md", ".json", ".csv", ".tsv"]);

function getExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function isImageFile(name: string): boolean {
  return IMAGE_EXTENSIONS.has(getExtension(name));
}

function isTextFile(name: string): boolean {
  return TEXT_EXTENSIONS.has(getExtension(name));
}

function FileIcon({ name, type }: { name: string; type: "file" | "directory" }) {
  if (type === "directory") {
    return (
      <svg className="ftree-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    );
  }
  const ext = getExtension(name);
  if (isImageFile(name)) {
    return (
      <svg className="ftree-icon ftree-icon--image" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    );
  }
  if (ext === ".tex" || ext === ".itek") {
    return (
      <svg className="ftree-icon ftree-icon--tex" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    );
  }
  if (ext === ".bib") {
    return (
      <svg className="ftree-icon ftree-icon--bib" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    );
  }
  return (
    <svg className="ftree-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

// ── Inline rename / create input ─────────────

function InlineInput({
  defaultValue,
  onSubmit,
  onCancel,
}: {
  defaultValue: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const dotIdx = defaultValue.lastIndexOf(".");
    el.setSelectionRange(0, dotIdx >= 0 ? dotIdx : defaultValue.length);
  }, [defaultValue]);

  const submit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== defaultValue) onSubmit(trimmed);
    else onCancel();
  };

  return (
    <input
      ref={inputRef}
      className="ftree-inline-input"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={submit}
      onKeyDown={(e) => {
        if (e.key === "Enter") submit();
        if (e.key === "Escape") onCancel();
      }}
    />
  );
}

// ── Context menu ─────────────────────────────

interface ContextMenuState {
  x: number;
  y: number;
  node: FileTreeNode | null;
  parentDir: string;
}

function ContextMenu({
  state,
  onClose,
  onNewFile: onNew,
  onNewItekFile,
  onNewFolder,
  onRename,
  onDelete,
  onInsertImage,
}: {
  state: ContextMenuState;
  onClose: () => void;
  onNewFile: () => void;
  onNewItekFile: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
  onInsertImage: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  const isDir = state.node === null || state.node.type === "directory";
  const isImage = state.node !== null && state.node.type === "file" && isImageFile(state.node.name);

  return (
    <div ref={menuRef} className="ftree-context-menu" style={{ top: state.y, left: state.x }}>
      {isImage && (
        <>
          <button type="button" className="ftree-context-item" onClick={() => { onInsertImage(); onClose(); }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
            </svg>
            Insert into editor
          </button>
          <div className="ftree-context-sep" />
        </>
      )}
      <button type="button" className="ftree-context-item" onClick={() => { onNew(); onClose(); }}>
        New File
      </button>
      <button type="button" className="ftree-context-item" onClick={() => { onNewItekFile(); onClose(); }}>
        New itek File
      </button>
      <button type="button" className="ftree-context-item" onClick={() => { onNewFolder(); onClose(); }}>
        New Folder
      </button>
      {state.node && (
        <>
          <div className="ftree-context-sep" />
          <button type="button" className="ftree-context-item" onClick={() => { onRename(); onClose(); }}>
            Rename
          </button>
          <button type="button" className="ftree-context-item ftree-context-item--danger" onClick={() => { onDelete(); onClose(); }}>
            Delete{isDir ? " Folder" : ""}
          </button>
        </>
      )}
    </div>
  );
}

// ── Tree node ────────────────────────────────

function TreeNode({
  node,
  depth,
  expanded,
  activeFilePath,
  renamingPath,
  creatingIn,
  creatingType,
  onToggle,
  onSelect,
  onImageSelect,
  onContextMenu,
  onRenameSubmit,
  onRenameCancel,
  onCreateSubmit,
  onCreateCancel,
}: {
  node: FileTreeNode;
  depth: number;
  expanded: Set<string>;
  activeFilePath: string | null;
  renamingPath: string | null;
  creatingIn: string | null;
  creatingType: "file" | "folder" | "itek" | null;
  onToggle: (path: string) => void;
  onSelect: (filePath: string) => void;
  onImageSelect: (filePath: string) => void;
  onContextMenu: (e: React.MouseEvent, node: FileTreeNode) => void;
  onRenameSubmit: (oldPath: string, newName: string) => void;
  onRenameCancel: () => void;
  onCreateSubmit: (name: string) => void;
  onCreateCancel: () => void;
}) {
  const isDir = node.type === "directory";
  const isOpen = expanded.has(node.path);
  const isActive = node.path === activeFilePath;
  const isRenaming = node.path === renamingPath;
  const isCreatingHere = node.path === creatingIn;
  const isImage = !isDir && isImageFile(node.name);

  const handleClick = () => {
    if (isDir) {
      onToggle(node.path);
    } else if (isImage) {
      onImageSelect(node.path);
    } else if (isTextFile(node.name)) {
      onSelect(node.path);
    }
  };

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (!isImage) return;
    e.dataTransfer.setData("application/x-intellitex-image", node.path);
    e.dataTransfer.effectAllowed = "copy";
  }, [isImage, node.path]);

  return (
    <>
      <div
        className={`ftree-node ${isActive ? "ftree-node--active" : ""} ${isDir ? "ftree-node--dir" : ""}`}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
        draggable={isImage}
        onDragStart={handleDragStart}
        role="treeitem"
        aria-selected={isActive}
        aria-expanded={isDir ? isOpen : undefined}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") handleClick(); }}
      >
        {isDir && (
          <svg
            className={`ftree-chevron ${isOpen ? "ftree-chevron--open" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
        {!isDir && <span className="ftree-chevron-space" />}
        <FileIcon name={node.name} type={node.type} />
        {isRenaming ? (
          <InlineInput
            defaultValue={node.name}
            onSubmit={(newName) => onRenameSubmit(node.path, newName)}
            onCancel={onRenameCancel}
          />
        ) : (
          <span className="ftree-name" title={node.name}>{node.name}</span>
        )}
      </div>
      {isDir && isOpen && (
        <>
          {isCreatingHere && creatingType && (
            <div className="ftree-node ftree-node--creating" style={{ paddingLeft: 8 + (depth + 1) * 16 }}>
              <span className="ftree-chevron-space" />
              <FileIcon name={creatingType === "folder" ? "__dir__" : creatingType === "itek" ? "resume.itek" : "new.tex"} type={creatingType === "folder" ? "directory" : "file"} />
              <InlineInput
                defaultValue={creatingType === "folder" ? "new-folder" : creatingType === "itek" ? "resume.itek" : "untitled.tex"}
                onSubmit={onCreateSubmit}
                onCancel={onCreateCancel}
              />
            </div>
          )}
          {(node.children ?? []).map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              activeFilePath={activeFilePath}
              renamingPath={renamingPath}
              creatingIn={creatingIn}
              creatingType={creatingType}
              onToggle={onToggle}
              onSelect={onSelect}
              onImageSelect={onImageSelect}
              onContextMenu={onContextMenu}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
              onCreateSubmit={onCreateSubmit}
              onCreateCancel={onCreateCancel}
            />
          ))}
        </>
      )}
    </>
  );
}

// ── Main sidebar ─────────────────────────────

export function FileTreeSidebar({
  rootDir,
  projectName,
  tree,
  activeFilePath,
  onFileSelect,
  onImageSelect,
  onInsertImage,
  onExternalFileDrop,
  onCreateFile,
  onCreateFolder,
  onDeleteEntry,
  onRenameEntry,
  onRefresh,
}: FileTreeSidebarProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([rootDir]));
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [creatingType, setCreatingType] = useState<"file" | "folder" | "itek" | null>(null);

  const toggleExpand = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, node: FileTreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    const parentDir = node.type === "directory" ? node.path : node.path.substring(0, node.path.lastIndexOf("/"));
    setContextMenu({ x: e.clientX, y: e.clientY, node, parentDir });
  }, []);

  const handleRootContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node: null, parentDir: rootDir });
  }, [rootDir]);

  const startCreateIn = useCallback((dir: string, type: "file" | "folder" | "itek") => {
    setCreatingIn(dir);
    setCreatingType(type);
    setExpanded((prev) => new Set(prev).add(dir));
  }, []);

  const startCreate = useCallback((type: "file" | "folder" | "itek") => {
    if (!contextMenu) return;
    startCreateIn(contextMenu.parentDir, type);
    setContextMenu(null);
  }, [contextMenu, startCreateIn]);

  const handleCreateSubmit = useCallback((name: string) => {
    if (!creatingIn || !creatingType) return;
    if (creatingType === "file" || creatingType === "itek") onCreateFile(creatingIn, name);
    else onCreateFolder(creatingIn, name);
    setCreatingIn(null);
    setCreatingType(null);
  }, [creatingIn, creatingType, onCreateFile, onCreateFolder]);

  const handleCreateCancel = useCallback(() => {
    setCreatingIn(null);
    setCreatingType(null);
  }, []);

  const handleRenameSubmit = useCallback((oldPath: string, newName: string) => {
    onRenameEntry(oldPath, newName);
    setRenamingPath(null);
  }, [onRenameEntry]);

  const handleDelete = useCallback(() => {
    if (!contextMenu?.node) return;
    onDeleteEntry(contextMenu.node.path);
    setContextMenu(null);
  }, [contextMenu, onDeleteEntry]);

  const handleStartRename = useCallback(() => {
    if (!contextMenu?.node) return;
    setRenamingPath(contextMenu.node.path);
    setContextMenu(null);
  }, [contextMenu]);

  const [width, setWidth] = useState(220);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const handleResizePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: width };
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
  }, [width]);

  const handleResizePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const delta = e.clientX - dragRef.current.startX;
    setWidth(Math.max(140, Math.min(400, dragRef.current.startW + delta)));
  }, []);

  const handleResizePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleInsertImage = useCallback(() => {
    if (!contextMenu?.node || contextMenu.node.type !== "file") return;
    onInsertImage(contextMenu.node.path);
    setContextMenu(null);
  }, [contextMenu, onInsertImage]);

  const [dropOver, setDropOver] = useState(false);

  const handleBodyDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDropOver(true);
  }, []);

  const handleBodyDragLeave = useCallback(() => {
    setDropOver(false);
  }, []);

  const handleBodyDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropOver(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if ((file as unknown as { path?: string }).path) {
        onExternalFileDrop((file as unknown as { path: string }).path, rootDir);
      }
    }
  }, [onExternalFileDrop, rootDir]);

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!addMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setAddMenuOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setAddMenuOpen(false); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [addMenuOpen]);

  return (
    <div className="ftree-sidebar" style={{ width }} onContextMenu={handleRootContextMenu}>
      <div className="ftree-header">
        <span className="ftree-header-title">{projectName}</span>
        <div className="ftree-header-actions">
          <div className="ftree-add-wrapper" ref={addMenuRef}>
            <button
              type="button"
              className="btn-icon ftree-header-btn"
              onClick={() => setAddMenuOpen((v) => !v)}
              title="Add file or folder"
              aria-label="Add"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            {addMenuOpen && (
              <div className="ftree-add-menu">
                <button
                  type="button"
                  className="ftree-context-item"
                  onClick={() => { startCreateIn(rootDir, "file"); setAddMenuOpen(false); }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                  New File
                </button>
                <button
                  type="button"
                  className="ftree-context-item"
                  onClick={() => { startCreateIn(rootDir, "itek"); setAddMenuOpen(false); }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  New itek File
                </button>
                <button
                  type="button"
                  className="ftree-context-item"
                  onClick={() => { startCreateIn(rootDir, "folder"); setAddMenuOpen(false); }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    <line x1="12" y1="11" x2="12" y2="17" />
                    <line x1="9" y1="14" x2="15" y2="14" />
                  </svg>
                  New Folder
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn-icon ftree-header-btn"
            onClick={onRefresh}
            title="Refresh file tree"
            aria-label="Refresh"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </div>
      <div
        className={`ftree-body ${dropOver ? "ftree-body--drop-active" : ""}`}
        role="tree"
        aria-label="Project files"
        onDragOver={handleBodyDragOver}
        onDragLeave={handleBodyDragLeave}
        onDrop={handleBodyDrop}
      >
        {creatingIn === rootDir && creatingType && (
          <div className="ftree-node ftree-node--creating" style={{ paddingLeft: 8 }}>
            <span className="ftree-chevron-space" />
            <FileIcon name={creatingType === "folder" ? "__dir__" : creatingType === "itek" ? "resume.itek" : "new.tex"} type={creatingType === "folder" ? "directory" : "file"} />
            <InlineInput
              defaultValue={creatingType === "folder" ? "new-folder" : creatingType === "itek" ? "resume.itek" : "untitled.tex"}
              onSubmit={handleCreateSubmit}
              onCancel={handleCreateCancel}
            />
          </div>
        )}
        {tree.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            expanded={expanded}
            activeFilePath={activeFilePath}
            renamingPath={renamingPath}
            creatingIn={creatingIn}
            creatingType={creatingType}
            onToggle={toggleExpand}
            onSelect={onFileSelect}
            onImageSelect={onImageSelect}
            onContextMenu={handleContextMenu}
            onRenameSubmit={handleRenameSubmit}
            onRenameCancel={() => setRenamingPath(null)}
            onCreateSubmit={handleCreateSubmit}
            onCreateCancel={handleCreateCancel}
          />
        ))}
        {tree.length === 0 && !creatingIn && (
          <div className="ftree-empty">
            No files yet. Use + to add.
          </div>
        )}
      </div>
      {contextMenu && (
        <ContextMenu
          state={contextMenu}
          onClose={() => setContextMenu(null)}
          onNewFile={() => startCreate("file")}
          onNewItekFile={() => startCreate("itek")}
          onNewFolder={() => startCreate("folder")}
          onRename={handleStartRename}
          onDelete={handleDelete}
          onInsertImage={handleInsertImage}
        />
      )}
      <div
        className="ftree-resize-handle"
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
      />
    </div>
  );
}
