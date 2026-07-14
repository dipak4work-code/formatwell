'use client';

import { useEffect, useState } from 'react';
import type { XmlNode } from '@/lib/parsers/xml';

interface XmlTreeProps {
  nodes: XmlNode[];
  /** Bump to force every node back to `defaultOpen` (expand/collapse all). */
  resetSignal: number;
  defaultOpen: boolean;
}

function Attributes({ attributes }: { attributes: Array<[string, string]> }) {
  return (
    <>
      {attributes.map(([name, value]) => (
        <span key={name}>
          {' '}
          <span className="text-ink">{name}</span>
          <span className="text-muted">=</span>
          <span className="text-valid">&quot;{value}&quot;</span>
        </span>
      ))}
    </>
  );
}

interface NodeProps {
  node: XmlNode;
  depth: number;
  resetSignal: number;
  defaultOpen: boolean;
}

function TreeNode({ node, depth, resetSignal, defaultOpen }: NodeProps) {
  const [open, setOpen] = useState(defaultOpen || depth === 0);

  useEffect(() => {
    setOpen(defaultOpen || depth === 0);
  }, [resetSignal, defaultOpen, depth]);

  const pad = { paddingLeft: depth * 14 };

  if (node.type === 'text') {
    return (
      <div style={pad} className="whitespace-pre-wrap break-words text-ink">
        {node.value.trim()}
      </div>
    );
  }
  if (node.type === 'comment') {
    return (
      <div style={pad} className="whitespace-pre-wrap break-words italic text-muted">
        &lt;!-- {node.value} --&gt;
      </div>
    );
  }
  if (node.type === 'cdata') {
    return (
      <div style={pad} className="whitespace-pre-wrap break-words text-muted">
        &lt;![CDATA[<span className="text-ink">{node.value}</span>]]&gt;
      </div>
    );
  }

  // element
  const hasChildren = node.children.length > 0;

  if (!hasChildren) {
    return (
      <div style={pad} className="whitespace-pre-wrap break-words">
        <span className="ml-5 text-muted">&lt;</span>
        <span className="text-accent">{node.name}</span>
        <Attributes attributes={node.attributes} />
        <span className="text-muted">/&gt;</span>
      </div>
    );
  }

  return (
    <div>
      <div style={pad} className="whitespace-pre-wrap break-words">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mr-1 inline-flex w-4 select-none justify-center text-muted hover:text-accent"
        >
          {open ? '▾' : '▸'}
        </button>
        <span className="text-muted">&lt;</span>
        <span className="text-accent">{node.name}</span>
        <Attributes attributes={node.attributes} />
        <span className="text-muted">&gt;</span>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-muted hover:text-accent"
          >
            {' '}
            … <span className="text-muted">{node.children.length} node{node.children.length === 1 ? '' : 's'}</span>{' '}
            <span className="text-muted">&lt;/</span>
            <span className="text-accent">{node.name}</span>
            <span className="text-muted">&gt;</span>
          </button>
        )}
      </div>

      {open && (
        <>
          {node.children.map((child, i) => (
            <TreeNode
              key={i}
              node={child}
              depth={depth + 1}
              resetSignal={resetSignal}
              defaultOpen={defaultOpen}
            />
          ))}
          <div style={pad} className="whitespace-pre-wrap break-words">
            <span className="ml-5 text-muted">&lt;/</span>
            <span className="text-accent">{node.name}</span>
            <span className="text-muted">&gt;</span>
          </div>
        </>
      )}
    </div>
  );
}

export function XmlTree({ nodes, resetSignal, defaultOpen }: XmlTreeProps) {
  return (
    <div className="font-mono text-label leading-6">
      {nodes.map((node, i) => (
        <TreeNode
          key={i}
          node={node}
          depth={0}
          resetSignal={resetSignal}
          defaultOpen={defaultOpen}
        />
      ))}
    </div>
  );
}
