import { useState, useRef, useEffect, useCallback } from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import type { Theme } from "../hooks/useTheme";
import type { EditorSelection } from "../agent/types";

interface EditorPanelProps {
  content: string;
  filePath: string | null;
  theme: Theme;
  onChange: (value: string) => void;
  onSave: () => void;
  onRename: (newName: string) => void;
  onAddToChat?: (selection: EditorSelection) => void;
  onClose?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
}

function getEditorLanguage(filePath: string | null): string {
  if (!filePath) return "plaintext";
  if (filePath.endsWith(".itek")) return "itek";
  return "plaintext";
}

let itekRegistered = false;

function registerItekLanguage(monaco: Monaco) {
  if (itekRegistered) return;
  itekRegistered = true;

  try {
    monaco.languages.register({ id: "itek" });
    monaco.languages.setMonarchTokensProvider("itek", {
      tokenizer: {
        root: [
          [/^@resume\b.*/, "keyword"],
          [/^##\s+.*/, "type.identifier"],
          [/^#\w+/, "keyword"],
          [/^\s*\*\s/, "keyword.operator"],
          [/^\s*[\w]+(?=:)/, "variable"],
          [/"[^"]*"/, "string"],
          [/<[^>]+>/, "string.link"],
          [/\d+\.?\d*/, "number"],
        ],
      },
    });
  } catch {
    // fall back silently — editor still works as plaintext
  }
}

export function EditorPanel({ content, filePath, theme, onChange, onSave, onRename, onAddToChat, onClose, onMoveLeft, onMoveRight }: EditorPanelProps) {
  const filename = filePath ? filePath.split("/").pop()! : "Untitled.tex";
  const language = getEditorLanguage(filePath);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(filename);
  const inputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const onAddToChatRef = useRef(onAddToChat);
  onAddToChatRef.current = onAddToChat;

  const getSelectionFromEditor = useCallback((): EditorSelection | null => {
    const ed = editorRef.current;
    if (!ed) return null;
    const sel = ed.getSelection();
    if (!sel || sel.isEmpty()) return null;
    const text = ed.getModel()?.getValueInRange(sel) ?? "";
    if (!text.trim()) return null;
    return { startLine: sel.startLineNumber, endLine: sel.endLineNumber, text };
  }, []);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      const dotIndex = draft.lastIndexOf(".");
      inputRef.current?.setSelectionRange(0, dotIndex > 0 ? dotIndex : draft.length);
    }
  }, [editing]);

  const commitRename = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed || trimmed === filename) return;
    onRename(trimmed);
  };

  return (
    <div className="panel" role="region" aria-label="Editor">
      <div className="panel-header">
        <div className="editor-tab">
          <svg className="editor-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          {editing ? (
            <input
              ref={inputRef}
              className="editor-tab-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setDraft(filename);
                  setEditing(false);
                }
              }}
              aria-label="Rename file"
            />
          ) : (
            <span
              className="editor-tab-name"
              onClick={() => {
                setDraft(filename);
                setEditing(true);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setDraft(filename);
                  setEditing(true);
                }
              }}
              title="Click to rename"
              aria-label={`File: ${filename}. Press Enter to rename.`}
            >
              {filename}
            </span>
          )}
        </div>
        <div className="panel-header-controls">
          {onMoveLeft && (
            <button className="btn-icon" type="button" onClick={onMoveLeft} aria-label="Move panel left" title="Move left">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          )}
          {onMoveRight && (
            <button className="btn-icon" type="button" onClick={onMoveRight} aria-label="Move panel right" title="Move right">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 6 15 12 9 18"/></svg>
            </button>
          )}
          {onClose && (
            <button className="btn-icon" type="button" onClick={onClose} aria-label="Close panel" title="Close panel">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
      </div>
      <div className="panel-body">
        <Editor
          height="100%"
          language={language}
          theme={theme === "light" || theme === "muted" ? "light" : "vs-dark"}
          value={content}
          onChange={(val) => onChange(val ?? "")}
          beforeMount={(monaco) => registerItekLanguage(monaco)}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: "on",
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            padding: { top: 12 },
            renderLineHighlight: "gutter",
            cursorBlinking: "smooth",
            smoothScrolling: true,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace",
            fontLigatures: true,
          }}
          onMount={(editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
            editorRef.current = editorInstance;
            editorInstance.addAction({
              id: "save-file",
              label: "Save File",
              run: onSave,
            });
            editorInstance.addAction({
              id: "add-to-chat",
              label: "Add to Chat",
              keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyL],
              contextMenuGroupId: "navigation",
              contextMenuOrder: 0,
              precondition: "editorHasSelection",
              run: () => {
                const selection = getSelectionFromEditor();
                if (selection && onAddToChatRef.current) {
                  onAddToChatRef.current(selection);
                }
              },
            });
          }}
        />
      </div>
    </div>
  );
}
