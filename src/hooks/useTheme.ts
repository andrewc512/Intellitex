import { useState, useEffect, useCallback } from "react";

export const THEMES = [
  { id: "dark", label: "Nighttime", icon: "moon" as const },
  { id: "light", label: "Light" },
  { id: "muted", label: "Muted" },
  { id: "neon", label: "Neon", icon: "moon" as const },
  { id: "solarized", label: "Solarized" },
  { id: "rosepine", label: "Rosé Pine", icon: "moon" as const },
] as const;

export type Theme = (typeof THEMES)[number]["id"];

const STORAGE_KEY = "intellitex-theme";

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (THEMES.some((t) => t.id === stored)) return stored as Theme;
  } catch {
    // localStorage unavailable
  }
  return "dark";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage unavailable
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const idx = THEMES.findIndex((t) => t.id === prev);
      return THEMES[(idx + 1) % THEMES.length].id;
    });
  }, []);

  return { theme, setTheme, toggleTheme } as const;
}
