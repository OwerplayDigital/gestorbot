import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

const THEME_KEY = "owerplay-gestor-theme";

const STATUS_BAR_COLORS = {
  light: "#F7F9FC",
  dark: "#090D16",
} as const;

type AppTheme = "light" | "dark";

function applyTheme(theme: AppTheme) {
  const root = window.document.documentElement;
  const body = window.document.body;
  const themeColor = window.document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const colorScheme = window.document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');

  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  if (body) body.style.colorScheme = theme;

  themeColor?.setAttribute("content", STATUS_BAR_COLORS[theme]);
  colorScheme?.setAttribute("content", theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<AppTheme>(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
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
