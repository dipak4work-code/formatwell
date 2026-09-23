'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

interface VSplitPaneProps {
  top: ReactNode;
  bottom: ReactNode;
  /** Minimum size of each pane as a percentage of the container's height. */
  minPercent?: number;
  /** Initial height of the top pane, percentage. */
  defaultPercent?: number;
  topLabel?: string;
  bottomLabel?: string;
}

/**
 * Two panes stacked vertically with a draggable horizontal divider — the height
 * counterpart to SplitPane's width-adjustable left/right layout. Mirrors its
 * pointer-drag / keyboard-resize logic, transposed to the vertical axis.
 */
export function VSplitPane({
  top,
  bottom,
  minPercent = 15,
  defaultPercent = 80,
  topLabel = 'Top pane',
  bottomLabel = 'Bottom pane',
}: VSplitPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [percent, setPercent] = useState(defaultPercent);
  const [dragging, setDragging] = useState(false);

  const clamp = useCallback(
    (p: number) => Math.min(Math.max(p, minPercent), 100 - minPercent),
    [minPercent],
  );

  const onPointerMove = useCallback(
    (clientY: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.height === 0) return;
      setPercent(clamp(((clientY - rect.top) / rect.height) * 100));
    },
    [clamp],
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => onPointerMove(e.clientY);
    const up = () => setDragging(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging, onPointerMove]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowUp') setPercent((p) => clamp(p - 2));
    else if (e.key === 'ArrowDown') setPercent((p) => clamp(p + 2));
    else if (e.key === 'Home') setPercent(minPercent);
    else if (e.key === 'End') setPercent(100 - minPercent);
    else return;
    e.preventDefault();
  }

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 flex-col">
      <section
        aria-label={topLabel}
        style={{ height: `${percent}%` }}
        className="flex min-h-0 flex-col overflow-hidden"
      >
        {top}
      </section>

      <div
        role="separator"
        aria-orientation="horizontal"
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
          'group relative my-1 flex h-1.5 shrink-0 cursor-row-resize items-center justify-center ' +
          'rounded transition-colors duration-fade ' +
          (dragging ? 'bg-accent' : 'bg-border hover:bg-accent')
        }
      >
        <span aria-hidden="true" className="absolute -inset-y-2 inset-x-0" />
      </div>

      <section
        aria-label={bottomLabel}
        style={{ height: `${100 - percent}%` }}
        className="flex min-h-0 flex-col overflow-hidden"
      >
        {bottom}
      </section>
    </div>
  );
}
