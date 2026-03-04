import { useState, useEffect, useRef, useCallback } from "react";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onApiKeyChanged?: () => void;
}

type Provider = "openai" | "anthropic" | "google";

const PROVIDERS: { id: Provider; label: string; supported: boolean }[] = [
  { id: "openai", label: "OpenAI", supported: true },
  { id: "anthropic", label: "Anthropic", supported: false },
  { id: "google", label: "Google", supported: false },
];

const MODELS: Record<Provider, string[]> = {
  openai: ["gpt-5", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "o3", "o4-mini"],
  anthropic: ["claude-4-sonnet", "claude-4-opus", "claude-3.5-sonnet"],
  google: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
};

export function SettingsModal({ open, onClose, onApiKeyChanged }: SettingsModalProps) {
  const [provider, setProvider] = useState<Provider>("openai");
  const [model, setModel] = useState("gpt-5");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [hasKeys, setHasKeys] = useState<Record<Provider, boolean>>({ openai: false, anthropic: false, google: false });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const s = await window.electronAPI.getSettings();
    setProvider(s.provider as Provider);
    setModel(s.model);
    setHasKeys(s.hasKeys);
    setApiKeyInput("");
    setShowKey(false);
    setSaved(false);
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, provider]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (apiKeyInput.trim()) {
        await window.electronAPI.setApiKey(provider, apiKeyInput.trim());
      }
      await window.electronAPI.saveSettings({ provider, model });
      const s = await window.electronAPI.getSettings();
      setHasKeys(s.hasKeys);
      setApiKeyInput("");
      setSaved(true);
      onApiKeyChanged?.();
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const providerInfo = PROVIDERS.find((p) => p.id === provider)!;

  return (
    <div className="settings-backdrop" ref={backdropRef} onClick={handleBackdropClick}>
      <div className="settings-modal" role="dialog" aria-label="Settings">
        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <button className="btn-icon" type="button" onClick={onClose} aria-label="Close settings">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="settings-body">
          <div className="settings-section">
            <label className="settings-label">Provider</label>
            <div className="settings-provider-group">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`settings-provider-btn ${provider === p.id ? "settings-provider-btn--active" : ""}`}
                  onClick={() => {
                    setProvider(p.id);
                    setModel(MODELS[p.id][0]);
                    setApiKeyInput("");
                    setShowKey(false);
                  }}
                >
                  {p.label}
                  {!p.supported && <span className="settings-badge">Soon</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-section">
            <label className="settings-label" htmlFor="settings-api-key">
              API Key
              {hasKeys[provider] && (
                <span className="settings-key-status">Saved</span>
              )}
            </label>
            <div className="settings-key-row">
              <input
                ref={inputRef}
                id="settings-api-key"
                className="input"
                type={showKey ? "text" : "password"}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={hasKeys[provider] ? "Enter new key to replace..." : "Paste your API key..."}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                className="btn-icon"
                type="button"
                onClick={() => setShowKey(!showKey)}
                aria-label={showKey ? "Hide key" : "Show key"}
                title={showKey ? "Hide" : "Show"}
              >
                {showKey ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="settings-section">
            <label className="settings-label" htmlFor="settings-model">Model</label>
            <select
              id="settings-model"
              className="input settings-select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {MODELS[provider].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {!providerInfo.supported && (
              <span className="settings-hint">
                {providerInfo.label} support is coming soon. You can save your key now.
              </span>
            )}
          </div>
        </div>

        <div className="settings-footer">
          {saved && <span className="settings-saved-msg">Settings saved</span>}
          <button className="btn" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
