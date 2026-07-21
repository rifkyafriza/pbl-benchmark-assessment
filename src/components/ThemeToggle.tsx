"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="fixed bottom-6 right-6 p-3 rounded-full glass-panel antigravity-shadow w-12 h-12 z-50"></div>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="fixed bottom-6 right-6 p-3 rounded-full glass-panel antigravity-shadow text-gray-700 dark:text-gray-300 hover:text-sky transition-all z-50 flex items-center justify-center active:scale-95"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
