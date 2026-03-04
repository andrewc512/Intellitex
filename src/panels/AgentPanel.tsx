import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import type { AgentContext, AgentMessage, AgentProgress, AgentResponse, EditorSelection } from "../agent/types";

interface AgentPanelProps {
  filePath: string | null;
  content: string;
  compileErrors?: Array<{ file: string; line: number; message: string }>;
  chatAttachment?: EditorSelection | null;
  onClearAttachment?: () => void;
  onFileEdited?: (filePath: string, content: string) => void;
  onClose?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
}

const MAX_MESSAGES = 20; // Keep last N messages (10 user + 10 assistant exchanges)

export function AgentPanel({ filePath, content, compileErrors, chatAttachment, onClearAttachment, onFileEdited, onClose, onMoveLeft, onMoveRight }: AgentPanelProps) {
  const iconUrl = (name: string) => `${import.meta.env.BASE_URL}icons/${name}`;

  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState("");
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamingIndexRef = useRef<number | null>(null);
  const activeRequestIdRef = useRef(0);
  const isSendingRef = useRef(false);

  // Trim messages to MAX_MESSAGES, keeping the most recent ones
  const trimMessages = (msgs: AgentMessage[]) =>
    msgs.length > MAX_MESSAGES ? msgs.slice(msgs.length - MAX_MESSAGES) : msgs;

  useEffect(() => { window.electronAPI.agentCheckApiKey().then(setHasApiKey); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, thinkingStatus]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [inputValue]);

  useEffect(() => {
    const cleanup = window.electronAPI.onAgentProgress((status: AgentProgress) => {
      if (status.type === "status") {
        setThinkingStatus(status.message);
        return;
      }
      if (status.type === "reset") {
        setMessages((prev) => {
          if (streamingIndexRef.current === null) return prev;
          const idx = streamingIndexRef.current;
          streamingIndexRef.current = null;
          return prev.filter((_, i) => i !== idx);
        });
        return;
      }
      if (status.type === "delta") {
        setMessages((prev) => {
          const requestId = activeRequestIdRef.current;
          if (streamingIndexRef.current === null) {
            streamingIndexRef.current = prev.length;
            return [...prev, { role: "assistant", content: status.content, requestId }];
          }
          const idx = streamingIndexRef.current;
          if (idx === null || !prev[idx]) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], content: next[idx].content + status.content, requestId };
          return next;
        });
      }
    });
    return cleanup;
  }, []);

  const sendMessage = async (prompt: string) => {
    if (!prompt.trim()) return;
    if (isSendingRef.current || isLoading) return;
    isSendingRef.current = true;
    streamingIndexRef.current = null;
    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    const displayPrompt = chatAttachment
      ? `[Lines ${chatAttachment.startLine}–${chatAttachment.endLine}]\n${prompt}`
      : prompt;
    setMessages((prev) => [...prev, { role: "user", content: displayPrompt }]);
    setInputValue("");
    setIsLoading(true);
    setThinkingStatus("Analyzing your request...");

    try {
      const selection = chatAttachment
        ? { startLine: chatAttachment.startLine, endLine: chatAttachment.endLine }
        : undefined;
      const ctx: AgentContext = { filePath: filePath ?? undefined, content, compileErrors, selection, summary: summary ?? undefined };
      const history = trimMessages(messages).map(({ role, content: c }) => ({ role, content: c }));
      onClearAttachment?.();
      const res: AgentResponse = await window.electronAPI.agentProcess(ctx, prompt, history);

      if (res.error) {
        setMessages((prev) => {
          if (streamingIndexRef.current === null) return prev;
          const idx = streamingIndexRef.current;
          streamingIndexRef.current = null;
          return prev.filter((_, i) => i !== idx);
        });
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${res.error}` }]);
      } else {
        if (typeof res.summary === "string") setSummary(res.summary);
        if (res.editedFiles && onFileEdited) {
          for (const [path, newContent] of Object.entries(res.editedFiles)) {
            onFileEdited(path, newContent);
          }
        }
        const reqId = activeRequestIdRef.current;
        setMessages((prev) => {
          // 1. If we have an active streaming message, finalize it
          if (streamingIndexRef.current !== null) {
            const idx = streamingIndexRef.current;
            streamingIndexRef.current = null;
            if (prev[idx]) {
              const next = [...prev];
              next[idx] = { ...next[idx], content: res.message, requestId: reqId };
              return next;
            }
          }
          // 2. Find any existing assistant message from this request to update
          let existingIdx = -1;
          for (let j = prev.length - 1; j >= 0; j--) {
            if (prev[j].role === "assistant" && prev[j].requestId === reqId) { existingIdx = j; break; }
          }
          if (existingIdx !== -1) {
            const next = [...prev];
            next[existingIdx] = { ...next[existingIdx], content: res.message, requestId: reqId };
            return next;
          }
          // 3. No existing message — add a new one
          return [...prev, { role: "assistant", content: res.message, requestId: reqId }];
        });
      }
    } finally {
      isSendingRef.current = false;
      setIsLoading(false);
      setThinkingStatus("");
      // Trim old messages to keep the chat history bounded
      setMessages((prev) => trimMessages(prev));
    }
  };

  if (hasApiKey === false) {
    return (
      <div className="panel" role="region" aria-label="AI Assistant">
        <div className="panel-header">
          <svg className="panel-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="panel-header-title">Assistant</span>
        </div>
        <div className="agent-empty" role="alert">
          <img className="agent-empty-icon" src={iconUrl("icon-assistant.png")} alt="" aria-hidden="true" />
          <span className="agent-empty-text">API Key Required</span>
          <span className="agent-empty-subtitle">Set the OPENAI_API_KEY environment variable to use the assistant.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="panel" role="region" aria-label="AI Assistant">
      <div className="panel-header">
        <svg className="panel-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
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

      {messages.length === 0 ? (
        <div className="agent-empty" role="status">
          <img className="agent-empty-icon" src={iconUrl("icon-assistant.png")} alt="" aria-hidden="true" />
          <span className="agent-empty-text">
            {filePath?.toLowerCase().endsWith(".itek")
              ? "How can I help with your .itek project?"
              : "How can I help with your LaTeX project?"}
          </span>
        </div>
      ) : (
        <div className="agent-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`agent-message agent-message-${msg.role}`}>
              {msg.role === "assistant" && <img className="agent-message-icon" src={iconUrl("icon-assistant.png")} alt="" aria-hidden="true" />}
              <div className="agent-message-content">
                {msg.role === "assistant" ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="agent-thinking" role="status" aria-live="polite">
              <svg className="agent-thinking-spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="50 20" />
              </svg>
              <span className="agent-thinking-text">{thinkingStatus}</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      <form className="agent-input-area" onSubmit={(e) => { e.preventDefault(); sendMessage(inputValue); }}>
        {chatAttachment && (
          <div className="agent-attachment">
            <div className="agent-attachment-chip">
              <svg className="agent-attachment-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
              </svg>
              <span className="agent-attachment-label">Lines {chatAttachment.startLine}–{chatAttachment.endLine}</span>
              <button
                className="agent-attachment-dismiss"
                type="button"
                onClick={onClearAttachment}
                aria-label="Remove attached selection"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
        )}
        <div className="agent-input-wrapper">
          <textarea
            ref={textareaRef}
            className="agent-input"
            rows={1}
            placeholder="Ask me anything..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(inputValue);
              }
            }}
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
