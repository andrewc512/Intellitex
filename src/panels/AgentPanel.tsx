import { useState, useRef, useEffect } from "react";
import type { AgentContext, AgentMessage, AgentResponse } from "../agent/types";

const QUICK_ACTIONS = [
  { label: "Optimize for ATS", icon: "/icons/icon-ats.png", prompt: "Optimize this resume for ATS." },
  { label: "Fix compile errors", icon: "/icons/icon-fix.png", prompt: "Fix all compile errors in this document." },
  { label: "Improve formatting", icon: "/icons/icon-format.png", prompt: "Improve the formatting of this document." },
  { label: "Strengthen bullet points", icon: "/icons/icon-bullets.png", prompt: "Strengthen the bullet points in this resume." },
];

interface AgentPanelProps {
  filePath: string | null;
  content: string;
  compileErrors?: Array<{ file: string; line: number; message: string }>;
  onFileEdited?: (filePath: string, content: string) => void;
}

export function AgentPanel({ filePath, content, compileErrors, onFileEdited }: AgentPanelProps) {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { window.electronAPI.agentCheckApiKey().then(setHasApiKey); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async (prompt: string) => {
    if (!prompt.trim() || isLoading) return;
    setMessages((prev) => [...prev, { role: "user", content: prompt }]);
    setInputValue("");
    setIsLoading(true);

    const ctx: AgentContext = { filePath: filePath ?? undefined, content, compileErrors };
    const res: AgentResponse = await window.electronAPI.agentProcess(ctx, prompt);

    if (res.error) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${res.error}` }]);
    } else {
      if (res.editedFiles && onFileEdited) {
        for (const [path, newContent] of Object.entries(res.editedFiles)) {
          onFileEdited(path, newContent);
        }
      }
      setMessages((prev) => [...prev, { role: "assistant", content: res.message }]);
    }
    setIsLoading(false);
  };

  if (hasApiKey === false) {
    return (
      <div className="panel" role="region" aria-label="AI Assistant">
        <div className="panel-header">
          <img className="panel-header-icon" src="/icons/icon-assistant.png" alt="" aria-hidden="true" />
          <span className="panel-header-title">Assistant</span>
        </div>
        <div className="agent-empty" role="alert">
          <img className="agent-empty-icon" src="/icons/icon-assistant.png" alt="" aria-hidden="true" />
          <span className="agent-empty-text">API Key Required</span>
          <span className="agent-empty-subtitle">Set the OPENAI_API_KEY environment variable to use the assistant.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="panel" role="region" aria-label="AI Assistant">
      <div className="panel-header">
        <img className="panel-header-icon" src="/icons/icon-assistant.png" alt="" aria-hidden="true" />
        <span className="panel-header-title">Assistant</span>
      </div>

      {messages.length === 0 ? (
        <div className="agent-empty" role="status">
          <img className="agent-empty-icon" src="/icons/icon-assistant.png" alt="" aria-hidden="true" />
          <span className="agent-empty-text">How can I help with your resume?</span>
          <span className="agent-empty-subtitle">Ask questions or use a quick action below</span>
          <nav className="agent-quick-actions" aria-label="Suggested actions">
            {QUICK_ACTIONS.map((a) => (
              <button key={a.label} className="agent-quick-btn" type="button" onClick={() => sendMessage(a.prompt)} disabled={isLoading}>
                <img className="agent-quick-btn-icon" src={a.icon} alt="" aria-hidden="true" />
                {a.label}
              </button>
            ))}
          </nav>
        </div>
      ) : (
        <div className="agent-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`agent-message agent-message-${msg.role}`}>
              {msg.role === "assistant" && <img className="agent-message-icon" src="/icons/icon-assistant.png" alt="" aria-hidden="true" />}
              <div className="agent-message-content">{msg.content}</div>
            </div>
          ))}
          {isLoading && (
            <div className="agent-message agent-message-assistant">
              <img className="agent-message-icon" src="/icons/icon-assistant.png" alt="" aria-hidden="true" />
              <div className="agent-message-content agent-loading">Thinking...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      <form className="agent-input-area" onSubmit={(e) => { e.preventDefault(); sendMessage(inputValue); }}>
        <div className="agent-input-wrapper">
          <input
            className="agent-input"
            type="text"
            placeholder="Ask anything about your resume..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            aria-label="Message the AI assistant"
            disabled={isLoading}
          />
          <button className="agent-send-btn" type="submit" disabled={!inputValue.trim() || isLoading} aria-label="Send message">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
