export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "animal-farm-theme-preference";

export function isThemePreference(value: string): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function getStoredThemePreference() {
  if (typeof window === "undefined") {
    return "system" as ThemePreference;
  }

  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return value && isThemePreference(value) ? value : "system";
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "light" || preference === "dark") {
    return preference;
  }

  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyResolvedTheme(theme: ResolvedTheme) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  const body = document.body;
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
  body?.classList.toggle("dark", theme === "dark");

  const themeColor = theme === "dark" ? "#0D1117" : "#F6F8FA";
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  themeColorMeta?.setAttribute("content", themeColor);
}

export function persistThemePreference(preference: ThemePreference) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, preference);
}
