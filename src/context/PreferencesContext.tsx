import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "dark" | "light";
export type FontSize = "sm" | "md" | "lg";
export type BackgroundId =
  | "default"
  | "aurora"
  | "sunset"
  | "ocean"
  | "minimal"
  | "hologram"
  | "holopastel"
  | "nebula"
  | "waves"
  | "custom";

type Prefs = {
  theme: Theme;
  fontSize: FontSize;
  fontFamily: string;
  accent: string;
  textColor: string;
  glass: boolean;
  background: BackgroundId;
  backgroundUrl: string;
  setTheme: (t: Theme) => void;
  setFontSize: (f: FontSize) => void;
  setFontFamily: (f: string) => void;
  setAccent: (a: string) => void;
  setTextColor: (c: string) => void;
  setGlass: (g: boolean) => void;
  setBackground: (b: BackgroundId) => void;
  setBackgroundUrl: (u: string) => void;
};

const Ctx = createContext<Prefs | null>(null);
const FS_MAP: Record<FontSize, string> = { sm: "14px", md: "16px", lg: "18px" };

// Các font chữ có thể chọn (tải Google Fonts theo nhu cầu)
export const FONTS: Record<string, { label: string; stack: string; href?: string }> = {
  inter: { label: "Inter (mặc định)", stack: `"Inter", ui-sans-serif, system-ui, sans-serif` },
  roboto: {
    label: "Roboto",
    stack: `"Roboto", sans-serif`,
    href: "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap",
  },
  poppins: {
    label: "Poppins",
    stack: `"Poppins", sans-serif`,
    href: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap",
  },
  nunito: {
    label: "Nunito",
    stack: `"Nunito", sans-serif`,
    href: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap",
  },
  quicksand: {
    label: "Quicksand",
    stack: `"Quicksand", sans-serif`,
    href: "https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap",
  },
  merriweather: {
    label: "Merriweather (serif)",
    stack: `"Merriweather", Georgia, serif`,
    href: "https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap",
  },
  spacegrotesk: {
    label: "Space Grotesk",
    stack: `"Space Grotesk", sans-serif`,
    href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap",
  },
};

// Màu giao diện (accent). hue = null nghĩa là dùng màu mặc định của theme.
export const ACCENTS: Record<string, { label: string; swatch: string; hue?: number; hue2?: number }> = {
  default: { label: "Tím", swatch: "oklch(0.72 0.18 285)" },
  blue: { label: "Xanh dương", swatch: "oklch(0.70 0.19 250)", hue: 250, hue2: 230 },
  teal: { label: "Xanh ngọc", swatch: "oklch(0.72 0.15 195)", hue: 195, hue2: 175 },
  green: { label: "Xanh lá", swatch: "oklch(0.74 0.16 150)", hue: 150, hue2: 165 },
  orange: { label: "Cam", swatch: "oklch(0.76 0.17 60)", hue: 60, hue2: 40 },
  pink: { label: "Hồng", swatch: "oklch(0.72 0.19 350)", hue: 350, hue2: 330 },
  red: { label: "Đỏ", swatch: "oklch(0.68 0.22 25)", hue: 25, hue2: 10 },
};

export const BG_PRESETS: Record<"default" | "aurora" | "sunset" | "ocean" | "minimal", string> = {
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

// Màu chữ tuỳ chọn (ghi đè --foreground). value = null nghĩa là màu mặc định theo theme.
export const TEXT_COLORS: Record<string, { label: string; swatch: string; value?: string }> = {
  default: { label: "Mặc định", swatch: "var(--color-foreground)" },
  white: { label: "Trắng", swatch: "#ffffff", value: "oklch(0.98 0 0)" },
  black: { label: "Đen", swatch: "#111111", value: "oklch(0.20 0.02 270)" },
  slate: { label: "Xám xanh", swatch: "#334155", value: "oklch(0.36 0.03 250)" },
  navy: { label: "Xanh mực", swatch: "#1e3a8a", value: "oklch(0.42 0.12 265)" },
  wine: { label: "Đỏ mận", swatch: "#7f1d1d", value: "oklch(0.45 0.15 20)" },
  emerald: { label: "Lục bảo", swatch: "#065f46", value: "oklch(0.50 0.12 160)" },
};

// Background động: ánh xạ sang class CSS (định nghĩa trong styles.css)
export const ANIM_BG: Record<string, string> = {
  hologram: "bg-anim-hologram",
  holopastel: "bg-anim-holopastel",
  nebula: "bg-anim-nebula",
  waves: "bg-anim-waves",
};
// Ảnh xem trước (tĩnh) cho các nền động trong ô chọn
export const ANIM_BG_PREVIEW: Record<string, string> = {
  hologram: "linear-gradient(125deg,#0ea5e9,#8b5cf6,#ec4899,#22d3ee)",
  holopastel: "linear-gradient(115deg,#ffd1dc,#c8f7e0,#d5c9ff,#ffe6c7,#c7e9ff,#ffd1f0)",
  nebula: "radial-gradient(circle at 25% 25%, #a855f7aa, transparent 60%), radial-gradient(circle at 80% 80%, #38bdf8aa, transparent 60%), #0f172a",
  waves: "linear-gradient(60deg,#3b82f6,#22d3ee,#3b82f6)",
};

function ensureFontLink(id: string, href: string) {
  if (typeof document === "undefined") return;
  const linkId = `font-${id}`;
  if (document.getElementById(linkId)) return;
  const link = document.createElement("link");
  link.id = linkId;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [fontSize, setFontSizeState] = useState<FontSize>("md");
  const [fontFamily, setFontFamilyState] = useState<string>("inter");
  const [accent, setAccentState] = useState<string>("default");
  const [textColor, setTextColorState] = useState<string>("default");
  const [glass, setGlassState] = useState<boolean>(false);
  const [background, setBackgroundState] = useState<BackgroundId>("default");
  const [backgroundUrl, setBackgroundUrlState] = useState<string>("");

  useEffect(() => {
    setThemeState((localStorage.getItem("pref:theme") as Theme) || "dark");
    setFontSizeState((localStorage.getItem("pref:fontSize") as FontSize) || "md");
    setFontFamilyState(localStorage.getItem("pref:fontFamily") || "inter");
    setAccentState(localStorage.getItem("pref:accent") || "default");
    setTextColorState(localStorage.getItem("pref:textColor") || "default");
    setGlassState(localStorage.getItem("pref:glass") === "1");
    setBackgroundState((localStorage.getItem("pref:background") as BackgroundId) || "default");
    setBackgroundUrlState(localStorage.getItem("pref:backgroundUrl") || "");
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const c = TEXT_COLORS[textColor];
    if (!c || !c.value) root.style.removeProperty("--foreground");
    else root.style.setProperty("--foreground", c.value);
    localStorage.setItem("pref:textColor", textColor);
  }, [textColor]);

  useEffect(() => {
    document.documentElement.classList.toggle("theme-glass", glass);
    localStorage.setItem("pref:glass", glass ? "1" : "0");
  }, [glass]);

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
    const f = FONTS[fontFamily] ?? FONTS.inter;
    if (f.href) ensureFontLink(fontFamily, f.href);
    document.documentElement.style.setProperty("--font-sans", f.stack);
    localStorage.setItem("pref:fontFamily", fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    const root = document.documentElement;
    const props = ["--primary", "--ring", "--sidebar-primary", "--sidebar-ring", "--accent", "--gradient-primary"];
    const a = ACCENTS[accent];
    if (!a || a.hue == null) {
      props.forEach((p) => root.style.removeProperty(p));
    } else {
      const hue2 = a.hue2 ?? a.hue;
      root.style.setProperty("--primary", `oklch(0.70 0.19 ${a.hue})`);
      root.style.setProperty("--ring", `oklch(0.70 0.19 ${a.hue})`);
      root.style.setProperty("--sidebar-primary", `oklch(0.70 0.19 ${a.hue})`);
      root.style.setProperty("--sidebar-ring", `oklch(0.70 0.19 ${a.hue})`);
      root.style.setProperty("--accent", `oklch(0.74 0.16 ${hue2})`);
      root.style.setProperty("--gradient-primary", `linear-gradient(135deg, oklch(0.70 0.19 ${a.hue}), oklch(0.76 0.16 ${hue2}))`);
    }
    localStorage.setItem("pref:accent", accent);
  }, [accent]);

  useEffect(() => {
    localStorage.setItem("pref:background", background);
    localStorage.setItem("pref:backgroundUrl", backgroundUrl);
    const body = document.body;
    // Xoá mọi class nền động trước
    Object.values(ANIM_BG).forEach((cls) => body.classList.remove(cls));
    if (ANIM_BG[background]) {
      body.style.background = "";
      body.classList.add(ANIM_BG[background]);
    } else if (background === "custom" && backgroundUrl) {
      body.style.background = `url("${backgroundUrl}") center center / cover no-repeat fixed, var(--color-background)`;
    } else {
      body.style.background = (BG_PRESETS as Record<string, string>)[background] ?? BG_PRESETS.default;
    }
  }, [background, backgroundUrl]);

  return (
    <Ctx.Provider
      value={{
        theme,
        fontSize,
        fontFamily,
        accent,
        textColor,
        glass,
        background,
        backgroundUrl,
        setTheme: setThemeState,
        setFontSize: setFontSizeState,
        setFontFamily: setFontFamilyState,
        setAccent: setAccentState,
        setTextColor: setTextColorState,
        setGlass: setGlassState,
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
