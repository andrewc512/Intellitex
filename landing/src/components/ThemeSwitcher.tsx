import { useEffect, useRef, useState } from 'react';

export type ThemeId =
  | 'dark' | 'light' | 'muted' | 'neon' | 'solarized' | 'rosepine'
  | 'midnight' | 'forest' | 'ocean' | 'ember' | 'arctic' | 'coffee'
  | 'slate' | 'vaporwave' | 'bubblegum' | 'retrowave';

const THEMES: { id: ThemeId; label: string }[] = [
  { id: 'dark',      label: 'Dark' },
  { id: 'light',     label: 'Light' },
  { id: 'muted',     label: 'Muted' },
  { id: 'neon',      label: 'Neon' },
  { id: 'solarized', label: 'Solarized' },
  { id: 'rosepine',  label: 'Rosé Pine' },
  { id: 'midnight',  label: 'Midnight' },
  { id: 'forest',    label: 'Forest' },
  { id: 'ocean',     label: 'Ocean' },
  { id: 'ember',     label: 'Ember' },
  { id: 'arctic',    label: 'Arctic' },
  { id: 'coffee',    label: 'Coffee' },
  { id: 'slate',     label: 'Slate' },
  { id: 'vaporwave', label: 'Vaporwave' },
  { id: 'bubblegum', label: 'Bubblegum' },
  { id: 'retrowave', label: 'Retrowave' },
];

const STORAGE_KEY = 'intellitex.landing.theme';

function applyTheme(id: ThemeId) {
  document.documentElement.setAttribute('data-theme', id);
}

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeId>('dark');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as ThemeId | null) ?? 'dark';
    setTheme(saved);
    applyTheme(saved);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (id: ThemeId) => {
    setTheme(id);
    applyTheme(id);
    localStorage.setItem(STORAGE_KEY, id);
    setOpen(false);
  };

  const active = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  return (
    <div className="theme-switch" ref={ref}>
      <button
        className="theme-switch-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change theme"
      >
        <span className={`theme-swatch theme-swatch--${theme}`} />
        <span className="theme-switch-label">{active.label}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="theme-switch-menu" role="listbox">
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="option"
              aria-selected={t.id === theme}
              className={`theme-switch-item ${t.id === theme ? 'theme-switch-item--active' : ''}`}
              onClick={() => pick(t.id)}
            >
              <span className={`theme-swatch theme-swatch--${t.id}`} />
              {t.label}
              {t.id === theme && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto' }}>
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
