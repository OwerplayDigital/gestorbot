import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

const MANUAL_THEME_KEY = "owerplay-gestor-theme-manual";
const THEME_COLORS = {
  light: "#F7F9FC",
  dark: "#090D16",
} as const;

type AppTheme = "light" | "dark";

function getSystemTheme(): AppTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: AppTheme) {
  const root = window.document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");

  window.document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove());
  const themeColor = window.document.createElement("meta");
  themeColor.name = "theme-color";
  themeColor.content = THEME_COLORS[theme];
  window.document.head.appendChild(themeColor);
}

function getSavedManualTheme(): AppTheme | null {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(MANUAL_THEME_KEY);
  return saved === "light" || saved === "dark" ? saved : null;
}

export function ThemeToggle() {
  const [manualTheme, setManualTheme] = useState<AppTheme | null>(() => getSavedManualTheme());
  const [theme, setTheme] = useState<AppTheme>(() => getSavedManualTheme() ?? getSystemTheme());

  useEffect(() => {
    if (manualTheme) {
      setTheme(manualTheme);
      applyTheme(manualTheme);
      window.localStorage.setItem(MANUAL_THEME_KEY, manualTheme);
      return;
    }

    window.localStorage.removeItem("owerplay-gestor-theme");

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncWithSystem = (matches: boolean) => {
      const systemTheme: AppTheme = matches ? "dark" : "light";
      setTheme(systemTheme);
      applyTheme(systemTheme);
    };

    syncWithSystem(media.matches);

    const handleChange = (event: MediaQueryListEvent) => syncWithSystem(event.matches);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [manualTheme]);

  function toggleTheme() {
    const nextTheme: AppTheme = theme === "light" ? "dark" : "light";
    setManualTheme(nextTheme);
    setTheme(nextTheme);
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="rounded-xl border border-border bg-card/50"
    >
      {theme === "light" ? (
        <Sun className="h-[1.2rem] w-[1.2rem] transition-all" />
      ) : (
        <Moon className="h-[1.2rem] w-[1.2rem] transition-all text-primary" />
      )}
      <span className="sr-only">Alternar tema</span>
    </Button>
  );
}
