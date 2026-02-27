import { useState, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";

interface EditorPanelProps {
  content: string;
  filePath: string | null;
  onChange: (value: string) => void;
  onSave: () => void;
  onRename: (newName: string) => void;
}

export function EditorPanel({ content, filePath, onChange, onSave, onRename }: EditorPanelProps) {
  const filename = filePath ? filePath.split("/").pop()! : "Untitled.tex";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(filename);
  const inputRef = useRef<HTMLInputElement>(null);

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
      </div>
      <div className="panel-body">
        <Editor
          height="100%"
          language="plaintext"
          theme="vs-dark"
          value={content}
          onChange={(val) => onChange(val ?? "")}
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
          onMount={(editorInstance: editor.IStandaloneCodeEditor) => {
            editorInstance.addAction({
              id: "save-file",
              label: "Save File",
              run: onSave,
            });
          }}
        />
      </div>
    </div>
  );
}
