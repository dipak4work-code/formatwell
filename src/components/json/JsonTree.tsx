'use client';

import { useEffect, useState } from 'react';

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

interface JsonTreeProps {
  value: Json;
  /** Bump to force every node back to `defaultOpen` (expand/collapse all). */
  resetSignal: number;
  defaultOpen: boolean;
}

function typeOf(value: Json): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/** Colored scalar leaf. Semantic colors are not used here — those are reserved for validation. */
function Scalar({ value }: { value: Json }) {
  const kind = typeOf(value);
  const cls =
    kind === 'string'
      ? 'text-valid'
      : kind === 'number'
        ? 'text-warn'
        : kind === 'boolean'
          ? 'text-accent'
          : 'text-muted'; // null
  const text = kind === 'string' ? `"${value as string}"` : String(value);
  return <span className={`${cls} break-all`}>{text}</span>;
}

function summary(value: Json): string {
  if (Array.isArray(value)) return `[ ${value.length} ]`;
  const n = Object.keys(value as object).length;
  return `{ ${n} }`;
}

interface NodeProps {
  k?: string | number;
  value: Json;
  depth: number;
  resetSignal: number;
  defaultOpen: boolean;
  isLast: boolean;
}

function KeyLabel({ k }: { k: string | number }) {
  return typeof k === 'number' ? (
    <span className="text-muted">{k}: </span>
  ) : (
    <span className="text-ink">&quot;{k}&quot;: </span>
  );
}

function Node({ k, value, depth, resetSignal, defaultOpen, isLast }: NodeProps) {
  const kind = typeOf(value);
  const branch = kind === 'array' || kind === 'object';
  const [open, setOpen] = useState(defaultOpen || depth === 0);

  // Respond to expand/collapse all.
  useEffect(() => {
    setOpen(defaultOpen || depth === 0);
  }, [resetSignal, defaultOpen, depth]);

  if (!branch) {
    return (
      <div style={{ paddingLeft: depth * 14 }} className="whitespace-pre">
        {k !== undefined && <KeyLabel k={k} />}
        <Scalar value={value} />
        {!isLast && <span className="text-muted">,</span>}
      </div>
    );
  }

  const entries: Array<[string | number, Json]> = Array.isArray(value)
    ? value.map((v, i) => [i, v])
    : Object.entries(value as { [key: string]: Json });
  const open_ = Array.isArray(value) ? '[' : '{';
  const close = Array.isArray(value) ? ']' : '}';

  return (
    <div>
      <div style={{ paddingLeft: depth * 14 }} className="whitespace-pre">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mr-1 inline-flex w-4 select-none justify-center text-muted hover:text-accent"
        >
          {open ? '▾' : '▸'}
        </button>
        {k !== undefined && <KeyLabel k={k} />}
        <span className="text-muted">{open_}</span>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-muted hover:text-accent"
          >
            {' '}
            <span className="text-muted">{summary(value)}</span>{' '}
          </button>
        )}
        {!open && <span className="text-muted">{close}</span>}
        {!open && !isLast && <span className="text-muted">,</span>}
      </div>

      {open && (
        <>
          {entries.map(([childKey, childVal], i) => (
            <Node
              key={childKey}
              k={childKey}
              value={childVal}
              depth={depth + 1}
              resetSignal={resetSignal}
              defaultOpen={defaultOpen}
              isLast={i === entries.length - 1}
            />
          ))}
          <div style={{ paddingLeft: depth * 14 }} className="whitespace-pre">
            <span className="text-muted">{close}</span>
            {!isLast && <span className="text-muted">,</span>}
          </div>
        </>
      )}
    </div>
  );
}

export function JsonTree({ value, resetSignal, defaultOpen }: JsonTreeProps) {
  return (
    <div className="font-mono text-label leading-6">
      <Node
        value={value}
        depth={0}
        resetSignal={resetSignal}
        defaultOpen={defaultOpen}
        isLast
      />
    </div>
  );
}
