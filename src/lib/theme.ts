export const THEME_KEY = "paperstall:theme";
export type ThemeChoice = "light" | "dark" | "system";

// Runs before first paint (inline, nonced) so there's no light flash for blueprint users.
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)});var d=t==="dark"||((!t||t==="system")&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

export function resolveDark(choice: ThemeChoice): boolean {
  if (choice === "system") return window.matchMedia("(prefers-color-scheme: dark)").matches;
  return choice === "dark";
}
