import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "dark" | "light";
export type FontSize = "sm" | "md" | "lg";
export type BackgroundId = "default" | "aurora" | "sunset" | "ocean" | "minimal" | "custom";

type Prefs = {
  theme: Theme;
  fontSize: FontSize;
  background: BackgroundId;
  backgroundUrl: string;
  setTheme: (t: Theme) => void;
  setFontSize: (f: FontSize) => void;
  setBackground: (b: BackgroundId) => void;
  setBackgroundUrl: (u: string) => void;
};

const Ctx = createContext<Prefs | null>(null);
const FS_MAP: Record<FontSize, string> = { sm: "14px", md: "16px", lg: "18px" };

export const BG_PRESETS: Record<Exclude<BackgroundId, "custom">, string> = {
  default:
    "radial-gradient(1200px 600px at 80% -10%, oklch(0.72 0.18 285 / 0.12), transparent 60%), radial-gradient(800px 400px at -10% 110%, oklch(0.78 0.16 215 / 0.1), transparent 60%), var(--color-background)",
  aurora:
    "radial-gradient(900px 500px at 20% 10%, oklch(0.7 0.2 150 / 0.25), transparent 60%), radial-gradient(900px 500px at 90% 90%, oklch(0.7 0.22 300 / 0.22), transparent 60%), var(--color-background)",
  sunset:
    "radial-gradient(1000px 600px at 100% 0%, oklch(0.78 0.2 40 / 0.28), transparent 60%), radial-gradient(900px 500px at 0% 100%, oklch(0.65 0.22 15 / 0.22), transparent 60%), var(--color-background)",
  ocean:
    "radial-gradient(1000px 600px at 50% 0%, oklch(0.7 0.16 220 / 0.28), transparent 60%), radial-gradient(900px 500px at 0% 100%, oklch(0.6 0.14 250 / 0.25), transparent 60%), var(--color-background)",
  minimal: "var(--color-background)",
};

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [fontSize, setFontSizeState] = useState<FontSize>("md");
  const [background, setBackgroundState] = useState<BackgroundId>("default");
  const [backgroundUrl, setBackgroundUrlState] = useState<string>("");

  useEffect(() => {
    const t = (localStorage.getItem("pref:theme") as Theme) || "dark";
    const f = (localStorage.getItem("pref:fontSize") as FontSize) || "md";
    const b = (localStorage.getItem("pref:background") as BackgroundId) || "default";
    const bu = localStorage.getItem("pref:backgroundUrl") || "";
    setThemeState(t);
    setFontSizeState(f);
    setBackgroundState(b);
    setBackgroundUrlState(bu);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem("pref:theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.fontSize = FS_MAP[fontSize];
    localStorage.setItem("pref:fontSize", fontSize);
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem("pref:background", background);
    localStorage.setItem("pref:backgroundUrl", backgroundUrl);
    const body = document.body;
    if (background === "custom" && backgroundUrl) {
      body.style.background = `linear-gradient(var(--color-background) / 0, var(--color-background) / 0), url("${backgroundUrl}") center/cover no-repeat fixed, var(--color-background)`;
    } else {
      const preset = background === "custom" ? BG_PRESETS.default : BG_PRESETS[background];
      body.style.background = preset;
    }
  }, [background, backgroundUrl]);

  return (
    <Ctx.Provider
      value={{
        theme,
        fontSize,
        background,
        backgroundUrl,
        setTheme: setThemeState,
        setFontSize: setFontSizeState,
        setBackground: setBackgroundState,
        setBackgroundUrl: setBackgroundUrlState,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function usePreferences() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePreferences must be used within PreferencesProvider");
  return v;
}
