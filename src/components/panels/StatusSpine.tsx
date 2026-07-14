'use client';

import { useEffect, useRef, useState } from 'react';
import type { Verdict } from '@/lib/parsers/types';

interface StatusSpineProps {
  verdict: Verdict;
  /** Human summary announced to assistive tech, e.g. "Valid JSON — 240 lines". */
  summary?: string;
}

const verdictColor: Record<Verdict, string> = {
  idle: 'var(--border)',
  valid: 'var(--valid)',
  invalid: 'var(--invalid)',
  warnings: 'var(--warn)',
  working: 'var(--accent)',
};

/**
 * StatusSpine (spec §6.4 / §8.4): a 4px vertical bar carrying the validation verdict
 * in color. On a settled verdict it fills top-to-bottom (~300ms). It also hosts the
 * aria-live region so the verdict is announced to screen readers.
 */
export function StatusSpine({ verdict, summary }: StatusSpineProps) {
  // Re-key the fill layer on each settled verdict so the animation replays.
  const [fillKey, setFillKey] = useState(0);
  const prev = useRef<Verdict>(verdict);

  useEffect(() => {
    if (verdict !== prev.current && verdict !== 'idle' && verdict !== 'working') {
      setFillKey((k) => k + 1);
    }
    prev.current = verdict;
  }, [verdict]);

  const color = verdictColor[verdict];
  const working = verdict === 'working';

  return (
    <div
      className="relative w-1 shrink-0 self-stretch overflow-hidden rounded"
      style={{ backgroundColor: 'var(--border)' }}
      data-verdict={verdict}
    >
      {working ? (
        <span
          aria-hidden="true"
          className="spine-pulse absolute inset-0 rounded"
          style={{ backgroundColor: color }}
        />
      ) : verdict !== 'idle' ? (
        <span
          key={fillKey}
          aria-hidden="true"
          className="spine-fill absolute inset-0 rounded"
          style={{ backgroundColor: color }}
        />
      ) : null}

      <span role="status" aria-live="polite" className="sr-only">
        {summary ?? ''}
      </span>
    </div>
  );
}
