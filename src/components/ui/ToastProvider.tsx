'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type ToastTone = 'neutral' | 'valid' | 'invalid' | 'warn';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastApi {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const toneClasses: Record<ToastTone, string> = {
  neutral: 'border-border text-ink',
  valid: 'border-valid text-valid',
  invalid: 'border-invalid text-invalid',
  warn: 'border-warn text-warn',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((message: string, tone: ToastTone = 'neutral') => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2400);
  }, []);

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              'pointer-events-auto rounded-md border bg-surface px-3 py-2 font-mono text-label shadow-sm ' +
              toneClasses[t.tone]
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fail soft: outside a provider, toasts are no-ops rather than crashing.
    return { toast: () => {} };
  }
  return ctx;
}
