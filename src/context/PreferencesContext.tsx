import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "dark" | "light";
export type FontSize = "sm" | "md" | "lg";

type Prefs = {
  theme: Theme;
  fontSize: FontSize;
  setTheme: (t: Theme) => void;
  setFontSize: (f: FontSize) => void;
};

const Ctx = createContext<Prefs | null>(null);
const FS_MAP: Record<FontSize, string> = { sm: "14px", md: "16px", lg: "18px" };

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [fontSize, setFontSizeState] = useState<FontSize>("md");

  useEffect(() => {
    const t = (localStorage.getItem("pref:theme") as Theme) || "dark";
    const f = (localStorage.getItem("pref:fontSize") as FontSize) || "md";
    setThemeState(t);
    setFontSizeState(f);
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

  return (
    <Ctx.Provider value={{ theme, fontSize, setTheme: setThemeState, setFontSize: setFontSizeState }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePreferences() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePreferences must be used within PreferencesProvider");
  return v;
}
