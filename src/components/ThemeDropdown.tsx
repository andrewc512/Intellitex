import { useState, useRef, useEffect } from "react";
import { THEMES, type Theme } from "../hooks/useTheme";

interface ThemeDropdownProps {
  theme: Theme;
  onSetTheme: (theme: Theme) => void;
}

export function ThemeDropdown({ theme, onSetTheme }: ThemeDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const current = THEMES.find((t) => t.id === theme);

  return (
    <div className="theme-dropdown" ref={ref}>
      <button
        className="theme-dropdown-trigger"
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-label="Change color theme"
        title="Change color theme"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
        <span className="theme-dropdown-label">{current?.label}</span>
        <svg className={`theme-dropdown-chevron ${open ? "theme-dropdown-chevron--open" : ""}`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="theme-dropdown-menu" role="listbox" aria-label="Color themes">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`theme-dropdown-item ${t.id === theme ? "theme-dropdown-item--active" : ""}`}
              type="button"
              role="option"
              aria-selected={t.id === theme}
              onClick={() => {
                onSetTheme(t.id);
                setOpen(false);
              }}
            >
              <span className={`theme-dropdown-swatch theme-dropdown-swatch--${t.id}`} />
              {t.label}
              {t.id === theme && (
                <svg className="theme-dropdown-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
