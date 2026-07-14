/**
 * Inline, render-blocking script that applies the persisted (or system) theme before
 * first paint — prevents a flash of the wrong theme and any theme-related layout shift.
 * Must run in <head> before the body renders.
 */
const script = `(function () {
  try {
    var stored = localStorage.getItem('theme');
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored ? stored === 'dark' : systemDark;
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
