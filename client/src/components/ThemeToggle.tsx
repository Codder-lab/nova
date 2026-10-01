import React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "./theme-provider";
import { Button } from "./ui/button";

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === "dark") setTheme("light");
    else if (theme === "light") setTheme("system");
    else setTheme("dark");
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
      title={`Current theme: ${theme} (Click to change)`}
      aria-label="Toggle theme"
    >
      {theme === "light" && <Sun className="h-4 w-4 text-amber-500" />}
      {theme === "dark" && <Moon className="h-4 w-4 text-indigo-400" />}
      {theme === "system" && <Monitor className="h-4 w-4 text-slate-400" />}
    </Button>
  );
};
