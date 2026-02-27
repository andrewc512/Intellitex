interface WelcomeScreenProps {
  onOpenFile: () => void;
  onNewFile: () => void;
  onNewItekFile: () => void;
  onOpenRecent: (filePath: string) => void;
  onRemoveRecent: (filePath: string) => void;
  recents: string[];
}

export function WelcomeScreen({
  onOpenFile,
  onNewFile,
  onNewItekFile,
  onOpenRecent,
  onRemoveRecent,
  recents,
}: WelcomeScreenProps) {

  const handleRemove = (e: React.MouseEvent, filePath: string) => {
    e.stopPropagation();
    onRemoveRecent(filePath);
  };

  return (
    <div className="welcome" role="main" aria-label="Welcome to IntelliTex">
      <div className="welcome-card">
        <img className="welcome-logo" src="/icons/logo.png" alt="IntelliTex" />

        <h1 className="welcome-title">IntelliTex</h1>
        <p className="welcome-subtitle">
          AI-powered LaTeX editor for crafting standout resumes
        </p>

        <div className="welcome-actions">
          <button
            type="button"
            className="welcome-btn"
            onClick={onOpenFile}
            aria-label="Open an existing LaTeX file"
          >
            <svg className="welcome-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            Open File
            <span className="welcome-btn-badge">.tex</span>
          </button>
          <button
            type="button"
            className="welcome-btn"
            onClick={onNewFile}
            aria-label="Create a new LaTeX file"
          >
            <svg className="welcome-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            New File
            <span className="welcome-btn-badge">.tex</span>
          </button>
          <button
            type="button"
            className="welcome-btn welcome-btn--accent"
            onClick={onNewItekFile}
            aria-label="Create a new itek resume"
          >
            <svg className="welcome-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
              <line x1="9" y1="12" x2="15" y2="12"/>
              <line x1="9" y1="16" x2="13" y2="16"/>
            </svg>
            New Resume
            <span className="welcome-btn-badges">
              <span className="welcome-btn-badge">.itek</span>
              <span className="welcome-btn-badge welcome-btn-badge--beta">Beta</span>
            </span>
          </button>
        </div>

        {recents.length > 0 && (
          <div className="welcome-recents">
            <h3 className="welcome-recents-title">Recent</h3>
            <ul className="welcome-recents-list" role="list">
              {recents.map((filePath) => (
                <li key={filePath} className="welcome-recent-item">
                  <button
                    type="button"
                    className="welcome-recent-btn"
                    onClick={() => onOpenRecent(filePath)}
                    title={filePath}
                    aria-label={`Open ${filePath.split("/").pop() || filePath}`}
                  >
                    <svg className="welcome-recent-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span className="welcome-recent-name">
                      {filePath.split("/").pop() || filePath}
                    </span>
                    <span className="welcome-recent-path">{shortenPath(filePath)}</span>
                  </button>
                  <button
                    type="button"
                    className="welcome-recent-remove"
                    onClick={(e) => handleRemove(e, filePath)}
                    aria-label={`Remove ${filePath.split("/").pop() || filePath} from recents`}
                    title="Remove from recents"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="welcome-hint" aria-label="Keyboard shortcuts">
          <span className="welcome-hint-item">
            <kbd className="kbd">⌘</kbd><kbd className="kbd">O</kbd>
            <span>Open</span>
          </span>
          <span className="welcome-hint-item">
            <kbd className="kbd">⌘</kbd><kbd className="kbd">N</kbd>
            <span>New</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function shortenPath(fullPath: string): string {
  const parts = fullPath.split("/");
  if (parts.length <= 3) return fullPath;
  return ".../" + parts.slice(-3).join("/");
}
