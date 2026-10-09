import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/hooks";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle} className={`btn-ghost relative h-9 w-9 p-0 ${className}`} aria-label="Cambiar tema" title="Tema claro / oscuro">
      <Sun className={`absolute h-5 w-5 transition-all duration-500 ${theme === "dark" ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100"}`} />
      <Moon className={`absolute h-5 w-5 transition-all duration-500 ${theme === "dark" ? "rotate-0 scale-100" : "-rotate-90 scale-0 opacity-0"}`} />
    </button>
  );
}
