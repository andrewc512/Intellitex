import type { Theme } from "../hooks/useTheme";
import { ThemeDropdown } from "./ThemeDropdown";

interface WelcomeScreenProps {
  onOpenProject: () => void;
  onNewProject: () => void;
  onOpenRecent: (dirPath: string) => void;
  onRemoveRecent: (dirPath: string) => void;
  recents: string[];
  theme: Theme;
  onSetTheme: (theme: Theme) => void;
}

export function WelcomeScreen({
  onOpenProject,
  onNewProject,
  onOpenRecent,
  onRemoveRecent,
  recents,
  theme,
  onSetTheme,
}: WelcomeScreenProps) {
  const iconUrl = (name: string) => `${import.meta.env.BASE_URL}icons/${name}`;

  const handleRemove = (e: React.MouseEvent, dirPath: string) => {
    e.stopPropagation();
    onRemoveRecent(dirPath);
  };

  return (
    <div className="welcome" role="main" aria-label="Welcome to IntelliTex">
      <div style={{ position: "absolute", top: 16, right: 16, zIndex: 2 }}>
        <ThemeDropdown theme={theme} onSetTheme={onSetTheme} />
      </div>
      <div className="welcome-card">
        <img className="welcome-logo" src={iconUrl("logo.png")} alt="IntelliTex" />

        <h1 className="welcome-title">IntelliTex</h1>
        <p className="welcome-subtitle">
          An AI-powered LaTeX editor for research
        </p>

        <div className="welcome-actions">
          <span className="welcome-btn-wrap" data-tooltip="Open an existing project folder">
            <button
              type="button"
              className="welcome-btn"
              onClick={onOpenProject}
              aria-label="Open an existing project"
            >
              <svg className="welcome-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              Open Project
            </button>
          </span>
          <span className="welcome-btn-wrap" data-tooltip="Create a new project folder with a main.tex file">
            <button
              type="button"
              className="welcome-btn welcome-btn--accent"
              onClick={onNewProject}
              aria-label="Create a new project"
            >
              <svg className="welcome-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              New Project
            </button>
          </span>
        </div>

        {recents.length > 0 && (
          <div className="welcome-recents">
            <h3 className="welcome-recents-title">Recent Projects</h3>
            <ul className="welcome-recents-list" role="list">
              {recents.map((dirPath) => (
                <li key={dirPath} className="welcome-recent-item">
                  <button
                    type="button"
                    className="welcome-recent-btn"
                    onClick={() => onOpenRecent(dirPath)}
                    title={dirPath}
                    aria-label={`Open ${dirPath.split("/").pop() || dirPath}`}
                  >
                    <svg className="welcome-recent-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span className="welcome-recent-name">
                      {dirPath.split("/").pop() || dirPath}
                    </span>
                    <span className="welcome-recent-path">{shortenPath(dirPath)}</span>
                  </button>
                  <button
                    type="button"
                    className="welcome-recent-remove"
                    onClick={(e) => handleRemove(e, dirPath)}
                    aria-label={`Remove ${dirPath.split("/").pop() || dirPath} from recents`}
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
