import { useState } from "react";

const QUICK_ACTIONS = [
  {
    label: "Optimize for ATS",
    icon: "/icons/icon-ats.png",
  },
  {
    label: "Fix compile errors",
    icon: "/icons/icon-fix.png",
  },
  {
    label: "Improve formatting",
    icon: "/icons/icon-format.png",
  },
  {
    label: "Strengthen bullet points",
    icon: "/icons/icon-bullets.png",
  },
];

interface AgentPanelProps {
  onClose?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
}

export function AgentPanel({ onClose, onMoveLeft, onMoveRight }: AgentPanelProps) {
  const [inputValue, setInputValue] = useState("");

  return (
    <div className="panel" role="region" aria-label="AI Assistant">
      <div className="panel-header">
        <img className="panel-header-icon" src="/icons/icon-assistant.png" alt="" aria-hidden="true" />
        <span className="panel-header-title">Assistant</span>
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

      <div className="agent-empty" role="status">
        <img className="agent-empty-icon" src="/icons/icon-assistant.png" alt="" aria-hidden="true" />
        <span className="agent-empty-text">How can I help with your resume?</span>
        <span className="agent-empty-subtitle">
          Ask questions or use a quick action below
        </span>

        <nav className="agent-quick-actions" aria-label="Suggested actions">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              className="agent-quick-btn"
              type="button"
              aria-label={action.label}
            >
              <img className="agent-quick-btn-icon" src={action.icon} alt="" aria-hidden="true" />
              {action.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="agent-input-area">
        <div className="agent-input-wrapper">
          <input
            className="agent-input"
            type="text"
            placeholder="Ask anything about your resume..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            aria-label="Message the AI assistant"
          />
          <button
            className="agent-send-btn"
            type="button"
            disabled={!inputValue.trim()}
            aria-label="Send message"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
