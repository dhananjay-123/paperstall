"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_THEME, THEME_KEY, resolveDark, type ThemeChoice } from "@/lib/theme";

const ORDER: ThemeChoice[] = ["light", "dark", "system"];
const LABEL: Record<ThemeChoice, string> = {
  system: "Theme: system",
  light: "Theme: paper (light)",
  dark: "Theme: blueprint (dark)",
};
const CHANGE_EVENT = "paperstall:theme-change";

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "dark" || v === "system" ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function ThemeToggle() {
  const choice = useSyncExternalStore(subscribe, readChoice, () => DEFAULT_THEME);

  // Re-apply after React's dev remount clears the class set by the inline script.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", resolveDark(choice));
  }, [choice]);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length];
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private mode: the choice just won't persist.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  const Icon = choice === "light" ? Sun : choice === "dark" ? Moon : Monitor;
  return (
    <Button variant="ghost" size="icon" onClick={cycle} aria-label={LABEL[choice]} title={LABEL[choice]}>
      <Icon />
    </Button>
  );
}
