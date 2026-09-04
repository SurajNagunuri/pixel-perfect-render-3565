import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "borrower-copilot-theme";

/** Inline script: sets the appearance before React paints, so there is no flash. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${KEY}");if(!t){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";}if(t==="light")document.documentElement.classList.add("light");}catch(e){}})();`;

function apply(theme: "light" | "dark") {
  document.documentElement.classList.toggle("light", theme === "light");
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("light") ? "light" : "dark");
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    apply(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "light" ? "Switch to dark appearance" : "Switch to light appearance"}
      title={theme === "light" ? "Dark appearance" : "Light appearance"}
      className="grid size-9 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
    >
      {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}
