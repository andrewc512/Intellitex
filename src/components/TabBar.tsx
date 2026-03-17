import { useRef, useCallback, useState } from "react";

interface OpenTab {
  filePath: string;
  content: string;
  isDirty: boolean;
}

interface TabBarProps {
  tabs: OpenTab[];
  activeTabPath: string | null;
  onSelectTab: (filePath: string) => void;
  onCloseTab: (filePath: string) => void;
}

function getExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function TabIcon({ name }: { name: string }) {
  const ext = getExtension(name);
  const imageExts = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".eps", ".pdf"]);

  if (imageExts.has(ext)) {
    return (
      <svg className="tabbar-icon tabbar-icon--image" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    );
  }
  if (ext === ".tex" || ext === ".itek") {
    return (
      <svg className="tabbar-icon tabbar-icon--tex" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    );
  }
  if (ext === ".bib") {
    return (
      <svg className="tabbar-icon tabbar-icon--bib" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    );
  }
  return (
    <svg className="tabbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

export function TabBar({ tabs, activeTabPath, onSelectTab, onCloseTab }: TabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [confirmClose, setConfirmClose] = useState<string | null>(null);

  const handleClose = useCallback((e: React.MouseEvent, tab: OpenTab) => {
    e.stopPropagation();
    if (tab.isDirty) {
      setConfirmClose(tab.filePath);
    } else {
      onCloseTab(tab.filePath);
    }
  }, [onCloseTab]);

  const handleConfirmSave = useCallback(async (filePath: string) => {
    const tab = tabs.find((t) => t.filePath === filePath);
    if (tab) {
      await window.electronAPI.saveFile(filePath, tab.content);
    }
    setConfirmClose(null);
    onCloseTab(filePath);
  }, [tabs, onCloseTab]);

  const handleConfirmDiscard = useCallback((filePath: string) => {
    setConfirmClose(null);
    onCloseTab(filePath);
  }, [onCloseTab]);

  const handleConfirmCancel = useCallback(() => {
    setConfirmClose(null);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  if (tabs.length === 0) return null;

  return (
    <>
      <div className="tabbar" onWheel={handleWheel}>
        <div className="tabbar-scroll" ref={scrollRef}>
          {tabs.map((tab) => {
            const filename = tab.filePath.split("/").pop()!;
            const isActive = tab.filePath === activeTabPath;
            return (
              <div
                key={tab.filePath}
                className={`tabbar-tab ${isActive ? "tabbar-tab--active" : ""}`}
                onClick={() => onSelectTab(tab.filePath)}
                title={tab.filePath}
                role="tab"
                aria-selected={isActive}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") onSelectTab(tab.filePath); }}
              >
                <TabIcon name={filename} />
                <span className="tabbar-tab-name">{filename}</span>
                {tab.isDirty && <span className="tabbar-tab-dirty" aria-label="Unsaved changes" />}
                <button
                  type="button"
                  className="tabbar-tab-close"
                  onClick={(e) => handleClose(e, tab)}
                  aria-label={`Close ${filename}`}
                  tabIndex={-1}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {confirmClose && (
        <div className="tabbar-confirm-backdrop" onClick={handleConfirmCancel}>
          <div className="tabbar-confirm" onClick={(e) => e.stopPropagation()}>
            <p className="tabbar-confirm-text">
              <strong>{confirmClose.split("/").pop()}</strong> has unsaved changes. Save before closing?
            </p>
            <div className="tabbar-confirm-actions">
              <button type="button" className="btn" onClick={handleConfirmCancel}>Cancel</button>
              <button type="button" className="btn tabbar-confirm-discard" onClick={() => handleConfirmDiscard(confirmClose)}>Discard</button>
              <button type="button" className="btn btn-primary" onClick={() => handleConfirmSave(confirmClose)}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
