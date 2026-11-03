export const THEME_KEY = "paperstall:theme";
export type ThemeChoice = "light" | "dark" | "system";
/** Paper (light) until the visitor picks blueprint or "follow my system". */
export const DEFAULT_THEME: ThemeChoice = "light";

// Runs before first paint (inline, nonced) so a blueprint choice never flashes light.
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)});var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

export function resolveDark(choice: ThemeChoice): boolean {
  if (choice === "system") return window.matchMedia("(prefers-color-scheme: dark)").matches;
  return choice === "dark";
}
