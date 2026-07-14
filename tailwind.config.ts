import type { Config } from 'tailwindcss';

/**
 * Design tokens ("Ink & Signal", spec §8.1/8.2) are declared as CSS variables in
 * src/styles/globals.css and surfaced to Tailwind here. Dark mode uses the `class`
 * strategy so the ThemeToggle can flip a `dark` class on <html>.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        border: 'var(--border)',
        accent: 'var(--accent)',
        valid: 'var(--valid)',
        invalid: 'var(--invalid)',
        warn: 'var(--warn)',
      },
      fontFamily: {
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Tight, technical scale (spec §8.2)
        label: ['13px', { lineHeight: '1.4' }],
        body: ['15px', { lineHeight: '1.6' }],
        section: ['20px', { lineHeight: '1.4' }],
        title: ['28px', { lineHeight: '1.25' }],
      },
      maxWidth: {
        app: '1440px',
      },
      transitionDuration: {
        fade: '150ms',
        spine: '300ms',
      },
    },
  },
  plugins: [],
};

export default config;
