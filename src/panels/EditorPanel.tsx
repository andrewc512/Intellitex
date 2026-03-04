import { useState, useRef, useEffect, useCallback } from "react";
import Editor, { DiffEditor, type Monaco } from "@monaco-editor/react";
import type { editor, languages } from "monaco-editor";
import type { Theme } from "../hooks/useTheme";
import type { EditorSelection } from "../agent/types";

interface PendingDiff {
  filePath: string;
  original: string;
  modified: string;
}

interface EditorPanelProps {
  content: string;
  filePath: string | null;
  theme: Theme;
  onChange: (value: string) => void;
  onSave: () => void;
  onRename: (newName: string) => void;
  onAddToChat?: (selection: EditorSelection) => void;
  pendingDiff?: PendingDiff | null;
  onAcceptDiff?: () => void;
  onDiscardDiff?: () => void;
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

    monaco.languages.registerFoldingRangeProvider("itek", {
      provideFoldingRanges(model: editor.ITextModel) {
        const ranges: languages.FoldingRange[] = [];
        const lineCount = model.getLineCount();
        const sectionLines: number[] = [];
        const entryLines: number[] = [];

        for (let i = 1; i <= lineCount; i++) {
          const text = model.getLineContent(i).trimStart();
          if (/^@resume\b/.test(text) || (/^#[a-zA-Z]/.test(text) && !text.startsWith("##"))) {
            sectionLines.push(i);
          } else if (/^(company|project|organization)\s/i.test(text) || /^##\s/.test(text)) {
            entryLines.push(i);
          }
        }

        const findFoldEnd = (start: number, limit: number): number => {
          let last = limit;
          while (last > start && model.getLineContent(last).trim() === "") last--;
          return last;
        };

        for (let i = 0; i < sectionLines.length; i++) {
          const start = sectionLines[i];
          const rawEnd = i + 1 < sectionLines.length ? sectionLines[i + 1] - 1 : lineCount;
          const end = findFoldEnd(start, rawEnd);
          if (end > start) {
            ranges.push({ start, end, kind: monaco.languages.FoldingRangeKind.Region });
          }
        }

        for (let i = 0; i < entryLines.length; i++) {
          const start = entryLines[i];
          let rawEnd = lineCount;
          for (const sl of sectionLines) {
            if (sl > start) { rawEnd = sl - 1; break; }
          }
          for (let j = i + 1; j < entryLines.length; j++) {
            if (entryLines[j] <= rawEnd) { rawEnd = entryLines[j] - 1; break; }
          }
          const end = findFoldEnd(start, rawEnd);
          if (end > start) {
            ranges.push({ start, end, kind: monaco.languages.FoldingRangeKind.Region });
          }
        }

        return ranges;
      },
    });
  } catch {
    // fall back silently — editor still works as plaintext
  }
}

function setupSectionDrag(ed: editor.IStandaloneCodeEditor, m: typeof import("monaco-editor")) {
  let handleDecIds: string[] = [];
  let dragDecIds: string[] = [];

  function findSections() {
    const model = ed.getModel();
    if (!model) return [];
    const lineCount = model.getLineCount();
    const starts: number[] = [];
    for (let i = 1; i <= lineCount; i++) {
      const text = model.getLineContent(i).trimStart();
      if (/^@resume\b/.test(text) || (/^#[a-zA-Z]/.test(text) && !text.startsWith("##"))) {
        starts.push(i);
      }
    }
    return starts.map((s, idx) => ({
      startLine: s,
      endLine: idx + 1 < starts.length ? starts[idx + 1] - 1 : lineCount,
    }));
  }

  function refreshHandles() {
    const sections = findSections();
    handleDecIds = ed.deltaDecorations(
      handleDecIds,
      sections.map((s) => ({
        range: new m.Range(s.startLine, 1, s.startLine, 1),
        options: {
          glyphMarginClassName: "itek-drag-handle",
          stickiness: m.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      }))
    );
  }

  refreshHandles();
  ed.onDidChangeModelContent(refreshHandles);

  let dragging = false;
  let dragFromIdx = -1;
  let dropInsertIdx = -1;

  ed.onMouseDown((e) => {
    if (e.target.type !== m.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) return;
    const line = e.target.position?.lineNumber;
    if (!line) return;
    const sections = findSections();
    const idx = sections.findIndex((s) => s.startLine === line);
    if (idx === -1) return;

    dragging = true;
    dragFromIdx = idx;
    dropInsertIdx = -1;
    e.event.preventDefault();

    const dom = ed.getDomNode();
    if (dom) dom.style.cursor = "grabbing";

    dragDecIds = ed.deltaDecorations(dragDecIds, [
      {
        range: new m.Range(sections[idx].startLine, 1, sections[idx].endLine, 1),
        options: { className: "itek-drag-highlight", isWholeLine: true },
      },
    ]);

    const onMove = (ev: MouseEvent) => {
      if (!dragging) return;
      const sections = findSections();
      const target = ed.getTargetAtClientPoint(ev.clientX, ev.clientY);

      if (!target?.position) {
        dragDecIds = ed.deltaDecorations(dragDecIds, [
          {
            range: new m.Range(sections[dragFromIdx].startLine, 1, sections[dragFromIdx].endLine, 1),
            options: { className: "itek-drag-highlight", isWholeLine: true },
          },
        ]);
        dropInsertIdx = -1;
        return;
      }

      const hoverLine = target.position.lineNumber;
      let hoverIdx = -1;
      for (let i = 0; i < sections.length; i++) {
        if (hoverLine >= sections[i].startLine && hoverLine <= sections[i].endLine) {
          hoverIdx = i;
          break;
        }
      }

      if (hoverIdx === -1 || hoverIdx === dragFromIdx) {
        dragDecIds = ed.deltaDecorations(dragDecIds, [
          {
            range: new m.Range(sections[dragFromIdx].startLine, 1, sections[dragFromIdx].endLine, 1),
            options: { className: "itek-drag-highlight", isWholeLine: true },
          },
        ]);
        dropInsertIdx = -1;
        return;
      }

      const mid = (sections[hoverIdx].startLine + sections[hoverIdx].endLine) / 2;
      dropInsertIdx = hoverLine <= mid ? hoverIdx : hoverIdx + 1;

      if (dropInsertIdx === dragFromIdx || dropInsertIdx === dragFromIdx + 1) {
        dropInsertIdx = -1;
        dragDecIds = ed.deltaDecorations(dragDecIds, [
          {
            range: new m.Range(sections[dragFromIdx].startLine, 1, sections[dragFromIdx].endLine, 1),
            options: { className: "itek-drag-highlight", isWholeLine: true },
          },
        ]);
        return;
      }

      const decs: editor.IModelDeltaDecoration[] = [
        {
          range: new m.Range(sections[dragFromIdx].startLine, 1, sections[dragFromIdx].endLine, 1),
          options: { className: "itek-drag-highlight", isWholeLine: true },
        },
      ];
      if (dropInsertIdx < sections.length) {
        decs.push({
          range: new m.Range(sections[dropInsertIdx].startLine, 1, sections[dropInsertIdx].startLine, 1),
          options: { className: "itek-drop-before", isWholeLine: true },
        });
      } else {
        decs.push({
          range: new m.Range(sections[sections.length - 1].endLine, 1, sections[sections.length - 1].endLine, 1),
          options: { className: "itek-drop-after", isWholeLine: true },
        });
      }
      dragDecIds = ed.deltaDecorations(dragDecIds, decs);
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      const dom = ed.getDomNode();
      if (dom) dom.style.cursor = "";
      dragDecIds = ed.deltaDecorations(dragDecIds, []);

      if (!dragging || dropInsertIdx === -1) { dragging = false; return; }

      const model = ed.getModel();
      if (!model) { dragging = false; return; }

      const sections = findSections();
      const lines = model.getValue().split("\n");
      const preambleEnd = sections.length > 0 ? sections[0].startLine - 1 : 0;
      const preamble = lines.slice(0, preambleEnd);
      const blocks = sections.map((s) => lines.slice(s.startLine - 1, s.endLine));

      const [moved] = blocks.splice(dragFromIdx, 1);
      const insertAt = dropInsertIdx > dragFromIdx ? dropInsertIdx - 1 : dropInsertIdx;
      blocks.splice(insertAt, 0, moved);

      const newContent = [...preamble, ...blocks.flat()].join("\n");
      model.pushEditOperations(
        [],
        [{ range: model.getFullModelRange(), text: newContent }],
        () => null
      );

      const updated = findSections();
      if (updated[insertAt]) {
        ed.setPosition({ lineNumber: updated[insertAt].startLine, column: 1 });
        ed.revealLineInCenter(updated[insertAt].startLine);
      }
      dragging = false;
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

export function EditorPanel({ content, filePath, theme, onChange, onSave, onRename, onAddToChat, pendingDiff, onAcceptDiff, onDiscardDiff, onClose, onMoveLeft, onMoveRight }: EditorPanelProps) {
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
      {pendingDiff && (
        <div className="diff-review-bar">
          <div className="diff-review-info">
            <svg className="diff-review-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v14" /><path d="m5 10 7 7 7-7" />
            </svg>
            <span className="diff-review-text">Review agent changes</span>
          </div>
          <div className="diff-review-actions">
            <button className="diff-review-btn diff-review-btn--discard" type="button" onClick={onDiscardDiff}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Discard
            </button>
            <button className="diff-review-btn diff-review-btn--accept" type="button" onClick={onAcceptDiff}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Accept
            </button>
          </div>
        </div>
      )}
      <div className="panel-body">
        {pendingDiff ? (
          <DiffEditor
            height="100%"
            language={language}
            theme={theme === "light" || theme === "muted" || theme === "arctic" || theme === "bubblegum" ? "light" : "vs-dark"}
            original={pendingDiff.original}
            modified={pendingDiff.modified}
            beforeMount={(monaco) => registerItekLanguage(monaco)}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: "on",
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              padding: { top: 12 },
              renderSideBySide: true,
              smoothScrolling: true,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace",
              fontLigatures: true,
            }}
          />
        ) : (
          <Editor
            height="100%"
            language={language}
            theme={theme === "light" || theme === "muted" || theme === "arctic" || theme === "bubblegum" ? "light" : "vs-dark"}
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
              folding: true,
              showFoldingControls: "always",
              foldingStrategy: "auto",
              glyphMargin: language === "itek",
            }}
            onMount={(editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
              editorRef.current = editorInstance;
              editorInstance.addAction({
                id: "save-file",
                label: "Save File",
                run: onSave,
              });
              editorInstance.addAction({
                id: "toggle-bold",
                label: "Toggle Bold",
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB],
                precondition: "editorHasSelection",
                run: () => {
                  const model = editorInstance.getModel();
                  const selection = editorInstance.getSelection();
                  if (!model || !selection || selection.isEmpty()) return;
                  const selectedText = model.getValueInRange(selection);
                  if (!selectedText) return;

                  let wrapped: string;
                  if (filePath && filePath.toLowerCase().endsWith(".tex")) {
                    wrapped = `\\\\textbf{${selectedText}}`;
                  } else {
                    wrapped = `**${selectedText}**`;
                  }

                  editorInstance.executeEdits("toggle-bold", [
                    {
                      range: selection,
                      text: wrapped,
                      forceMoveMarkers: true,
                    },
                  ]);
                },
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
              setupSectionDrag(editorInstance, monaco);
            }}
          />
        )}
      </div>
    </div>
  );
}
