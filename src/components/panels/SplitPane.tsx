'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  /** Minimum size of each pane as a percentage (spec: 25% each). */
  minPercent?: number;
  /** Initial size of the left pane, percentage. */
  defaultPercent?: number;
  leftLabel?: string;
  rightLabel?: string;
}

const STACK_QUERY = '(max-width: 767px)';

export function SplitPane({
  left,
  right,
  minPercent = 25,
  defaultPercent = 50,
  leftLabel = 'Left pane',
  rightLabel = 'Right pane',
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [percent, setPercent] = useState(defaultPercent);
  const [dragging, setDragging] = useState(false);
  const [stacked, setStacked] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(STACK_QUERY);
    const update = () => setStacked(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const clamp = useCallback(
    (p: number) => Math.min(Math.max(p, minPercent), 100 - minPercent),
    [minPercent],
  );

  const onPointerMove = useCallback(
    (clientX: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return;
      setPercent(clamp(((clientX - rect.left) / rect.width) * 100));
    },
    [clamp],
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => onPointerMove(e.clientX);
    const up = () => setDragging(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging, onPointerMove]);

  // Keyboard resize for accessibility.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') setPercent((p) => clamp(p - 2));
    else if (e.key === 'ArrowRight') setPercent((p) => clamp(p + 2));
    else if (e.key === 'Home') setPercent(minPercent);
    else if (e.key === 'End') setPercent(100 - minPercent);
    else return;
    e.preventDefault();
  }

  if (stacked) {
    return (
      <div ref={containerRef} className="flex min-h-0 flex-1 flex-col gap-3">
        <section aria-label={leftLabel} className="min-h-[220px] flex-1">
          {left}
        </section>
        <section aria-label={rightLabel} className="min-h-[220px] flex-1">
          {right}
        </section>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 items-stretch">
      <section aria-label={leftLabel} style={{ width: `${percent}%` }} className="min-w-0">
        {left}
      </section>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={minPercent}
        aria-valuemax={100 - minPercent}
        aria-label="Resize panes"
        tabIndex={0}
        onPointerDown={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onKeyDown={onKeyDown}
        className={
          'group relative mx-1 flex w-1.5 shrink-0 cursor-col-resize items-center justify-center ' +
          'rounded transition-colors duration-fade ' +
          (dragging ? 'bg-accent' : 'bg-border hover:bg-accent')
        }
      >
        <span aria-hidden="true" className="absolute inset-y-0 -inset-x-2" />
      </div>

      <section
        aria-label={rightLabel}
        style={{ width: `${100 - percent}%` }}
        className="min-w-0"
      >
        {right}
      </section>
    </div>
  );
}
