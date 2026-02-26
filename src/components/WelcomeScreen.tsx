import { useEffect, useState } from "react";

interface WelcomeScreenProps {
  onOpenFile: () => void;
  onNewFile: () => void;
  onOpenRecent: (filePath: string) => void;
  recents: string[];
}

export function WelcomeScreen({
  onOpenFile,
  onNewFile,
  onOpenRecent,
  recents,
}: WelcomeScreenProps) {
  const [recentFiles, setRecentFiles] = useState<string[]>([]);

  useEffect(() => {
    setRecentFiles(recents);
  }, [recents]);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Intellitex</h1>
        <p style={styles.subtitle}>A LaTeX editor with an AI assistant</p>

        <div style={styles.actions}>
          <button
            type="button"
            style={styles.primaryButton}
            onClick={onOpenFile}
          >
            <span style={styles.buttonIcon}>📂</span>
            Open File
          </button>
          <button
            type="button"
            style={styles.primaryButton}
            onClick={onNewFile}
          >
            <span style={styles.buttonIcon}>📄</span>
            New File
          </button>
        </div>

        {recentFiles.length > 0 && (
          <div style={styles.recentsSection}>
            <h3 style={styles.recentsTitle}>Recent Files</h3>
            <ul style={styles.recentsList}>
              {recentFiles.map((filePath) => (
                <li key={filePath} style={styles.recentsItem}>
                  <button
                    type="button"
                    style={styles.recentButton}
                    onClick={() => onOpenRecent(filePath)}
                    title={filePath}
                  >
                    {filePath.split("/").pop() || filePath}
                    <span style={styles.recentPath}>{shortenPath(filePath)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function shortenPath(fullPath: string): string {
  const parts = fullPath.split("/");
  if (parts.length <= 3) return fullPath;
  return ".../" + parts.slice(-3).join("/");
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f8f9fa",
  },
  card: {
    textAlign: "center",
    maxWidth: 480,
    width: "100%",
    padding: "48px 32px",
  },
  title: {
    fontSize: 36,
    fontWeight: 700,
    margin: 0,
    color: "#1a1a1a",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    fontSize: 15,
    color: "#6b7280",
    marginTop: 8,
    marginBottom: 40,
  },
  actions: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
  },
  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 28px",
    fontSize: 15,
    fontWeight: 500,
    border: "1px solid #d1d5db",
    borderRadius: 8,
    background: "#ffffff",
    color: "#1a1a1a",
    cursor: "pointer",
    transition: "background 0.15s, border-color 0.15s",
    fontFamily: "inherit",
  },
  buttonIcon: {
    fontSize: 18,
  },
  recentsSection: {
    marginTop: 48,
    textAlign: "left" as const,
  },
  recentsTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#6b7280",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    marginBottom: 8,
  },
  recentsList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  recentsItem: {
    margin: 0,
  },
  recentButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: "10px 12px",
    fontSize: 14,
    border: "none",
    borderRadius: 6,
    background: "transparent",
    color: "#1a1a1a",
    cursor: "pointer",
    textAlign: "left" as const,
    fontFamily: "inherit",
    transition: "background 0.12s",
  },
  recentPath: {
    fontSize: 12,
    color: "#9ca3af",
    marginLeft: 12,
    flexShrink: 0,
  },
};
