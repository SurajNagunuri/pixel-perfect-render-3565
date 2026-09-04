import { Moon, Sun } from "lucide-react";
import { toggleTheme, useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const theme = useTheme();
  const light = theme === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={light ? "Switch to dark appearance" : "Switch to light appearance"}
      title={light ? "Dark appearance" : "Light appearance"}
      className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
    >
      {light ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}
