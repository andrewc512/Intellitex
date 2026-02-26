import { useState, useRef, useEffect } from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
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
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid #e0e0e0",
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #e0e0e0",
          fontSize: 13,
          color: "#333",
          display: "flex",
          alignItems: "center",
          minHeight: 36,
        }}
      >
        {editing ? (
          <input
            ref={inputRef}
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
            style={{
              fontSize: 13,
              fontFamily: "inherit",
              padding: "2px 6px",
              border: "1px solid #3b82f6",
              borderRadius: 4,
              outline: "none",
              minWidth: 120,
            }}
          />
        ) : (
          <span
            onClick={() => {
              setDraft(filename);
              setEditing(true);
            }}
            title="Click to rename"
            style={{
              cursor: "pointer",
              padding: "2px 6px",
              borderRadius: 4,
              transition: "background 0.12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {filename}
          </span>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor
          height="100%"
          language="plaintext"
          value={content}
          onChange={(val) => onChange(val ?? "")}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: "on",
            lineNumbers: "on",
            scrollBeyondLastLine: false,
          }}
          onMount={(editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
            editorInstance.addAction({
              id: "save-file",
              label: "Save File",
              keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
              run: onSave,
            });
          }}
        />
      </div>
    </div>
  );
}
