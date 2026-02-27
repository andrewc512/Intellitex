export function PDFPanel() {
  return (
    <div className="panel" role="region" aria-label="PDF Preview">
      <div className="panel-header">
        <svg className="panel-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span className="panel-header-title">Preview</span>

        <div className="pdf-toolbar" role="toolbar" aria-label="PDF controls">
          <button className="btn-icon" type="button" disabled aria-label="Zoom out">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button className="btn-icon" type="button" disabled aria-label="Zoom in">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>

      <div className="pdf-placeholder">
        <svg className="pdf-placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="13" y2="17" />
          <line x1="8" y1="9" x2="11" y2="9" />
        </svg>
        <p className="pdf-placeholder-text">
          Compile your document to see a live preview here
        </p>
        <span className="pdf-placeholder-hint">
          <kbd className="kbd">⌘</kbd>
          <kbd className="kbd">B</kbd>
          <span>to compile</span>
        </span>
      </div>
    </div>
  );
}
