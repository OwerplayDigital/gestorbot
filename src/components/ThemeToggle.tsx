import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

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

export function ThemeToggle() {
  const [theme, setTheme] = useState<AppTheme>(() => getSystemTheme());

  useEffect(() => {
    window.localStorage.removeItem("owerplay-gestor-theme");
    window.localStorage.removeItem("owerplay-gestor-theme-manual");

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
  }, []);

  function toggleTheme() {
    const nextTheme: AppTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    applyTheme(nextTheme);
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
