import { useState, useRef, useEffect, useCallback, type PointerEvent as ReactPointerEvent } from "react";
import type { FileTreeNode } from "../types/electron";

interface FileTreeSidebarProps {
  rootDir: string;
  projectName: string;
  tree: FileTreeNode[];
  activeFilePath: string | null;
  onFileSelect: (filePath: string) => void;
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
  onNewFolder,
  onRename,
  onDelete,
}: {
  state: ContextMenuState;
  onClose: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
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

  return (
    <div ref={menuRef} className="ftree-context-menu" style={{ top: state.y, left: state.x }}>
      <button type="button" className="ftree-context-item" onClick={() => { onNew(); onClose(); }}>
        New File
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
  creatingType: "file" | "folder" | null;
  onToggle: (path: string) => void;
  onSelect: (filePath: string) => void;
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

  const handleClick = () => {
    if (isDir) {
      onToggle(node.path);
    } else if (isTextFile(node.name)) {
      onSelect(node.path);
    }
  };

  return (
    <>
      <div
        className={`ftree-node ${isActive ? "ftree-node--active" : ""} ${isDir ? "ftree-node--dir" : ""}`}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
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
              <FileIcon name={creatingType === "folder" ? "__dir__" : "new.tex"} type={creatingType === "folder" ? "directory" : "file"} />
              <InlineInput
                defaultValue={creatingType === "folder" ? "new-folder" : "untitled.tex"}
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
  const [creatingType, setCreatingType] = useState<"file" | "folder" | null>(null);

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

  const startCreate = useCallback((type: "file" | "folder") => {
    if (!contextMenu) return;
    const dir = contextMenu.parentDir;
    setCreatingIn(dir);
    setCreatingType(type);
    setExpanded((prev) => new Set(prev).add(dir));
    setContextMenu(null);
  }, [contextMenu]);

  const handleCreateSubmit = useCallback((name: string) => {
    if (!creatingIn || !creatingType) return;
    if (creatingType === "file") onCreateFile(creatingIn, name);
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

  return (
    <div className="ftree-sidebar" style={{ width }} onContextMenu={handleRootContextMenu}>
      <div className="ftree-header">
        <span className="ftree-header-title">{projectName}</span>
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
      <div className="ftree-body" role="tree" aria-label="Project files">
        {creatingIn === rootDir && creatingType && (
          <div className="ftree-node ftree-node--creating" style={{ paddingLeft: 8 }}>
            <span className="ftree-chevron-space" />
            <FileIcon name={creatingType === "folder" ? "__dir__" : "new.tex"} type={creatingType === "folder" ? "directory" : "file"} />
            <InlineInput
              defaultValue={creatingType === "folder" ? "new-folder" : "untitled.tex"}
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
            onContextMenu={handleContextMenu}
            onRenameSubmit={handleRenameSubmit}
            onRenameCancel={() => setRenamingPath(null)}
            onCreateSubmit={handleCreateSubmit}
            onCreateCancel={handleCreateCancel}
          />
        ))}
        {tree.length === 0 && !creatingIn && (
          <div className="ftree-empty">
            No files yet. Right-click to add.
          </div>
        )}
      </div>
      {contextMenu && (
        <ContextMenu
          state={contextMenu}
          onClose={() => setContextMenu(null)}
          onNewFile={() => startCreate("file")}
          onNewFolder={() => startCreate("folder")}
          onRename={handleStartRename}
          onDelete={handleDelete}
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
