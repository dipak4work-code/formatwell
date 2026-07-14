'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function ThemeToggle() {
  // Start null so server and first client render agree (avoids hydration mismatch);
  // the real value is read from the DOM after mount.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(getInitialTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', next === 'dark');
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* storage unavailable — theme still applies for this session */
    }
    setTheme(next);
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-muted transition-colors duration-fade hover:text-ink hover:border-accent"
    >
      {/* Icon is decorative; the accessible name lives on the button. */}
      <span aria-hidden="true" className="text-label">
        {theme === null ? '' : isDark ? '☀' : '☾'}
      </span>
    </button>
  );
}
