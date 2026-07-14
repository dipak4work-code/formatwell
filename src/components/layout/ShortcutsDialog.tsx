'use client';

import { useEffect, useRef, useState } from 'react';

interface Shortcut {
  keys: string[];
  action: string;
}

function useMod(): string {
  const [mod, setMod] = useState('Ctrl');
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setMod('⌘');
  }, []);
  return mod;
}

export function ShortcutsDialog() {
  const [open, setOpen] = useState(false);
  const mod = useMod();
  const closeRef = useRef<HTMLButtonElement>(null);

  // Open with "?", close with Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA'].includes(target.tagName) ||
          target.closest('.cm-editor'));
      if (!open && e.key === '?' && !typing) {
        e.preventDefault();
        setOpen(true);
      } else if (open && e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  const shortcuts: Shortcut[] = [
    { keys: [mod, 'Enter'], action: 'Validate' },
    { keys: [mod, 'Shift', 'F'], action: 'Format' },
    { keys: ['Tab'], action: 'Indent (in editor)' },
    { keys: ['←', '→'], action: 'Resize panes (divider focused)' },
    { keys: ['?'], action: 'Show this dialog' },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface font-mono text-label text-muted transition-colors duration-fade hover:border-accent hover:text-ink"
      >
        ?
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-mono text-section font-600 text-ink">Keyboard shortcuts</h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md border border-border px-2 py-1 font-mono text-label text-muted hover:text-ink"
              >
                Esc
              </button>
            </div>
            <dl className="flex flex-col gap-2">
              {shortcuts.map((s) => (
                <div key={s.action} className="flex items-center justify-between gap-4">
                  <dt className="text-body text-muted">{s.action}</dt>
                  <dd className="flex gap-1">
                    {s.keys.map((key) => (
                      <kbd
                        key={key}
                        className="rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-label text-ink"
                      >
                        {key}
                      </kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </>
  );
}
