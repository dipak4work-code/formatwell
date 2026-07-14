import Link from 'next/link';
import { TOOLS } from '@/lib/site';

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-5 py-12">
      <p className="font-mono text-label uppercase tracking-wide text-muted">Error 404</p>
      <h1 className="font-mono text-title font-600 text-ink">This page could not be found.</h1>
      <p className="max-w-lg text-body text-muted">
        The page you are looking for does not exist. Head back home or jump straight into a tool.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/"
          className="rounded-md border border-accent bg-accent/10 px-3 py-1.5 font-mono text-label text-accent transition-colors duration-fade hover:bg-accent/20"
        >
          Home
        </Link>
        {TOOLS.map((tool) => (
          <Link
            key={tool.id}
            href={tool.href}
            className="rounded-md border border-border bg-surface px-3 py-1.5 font-mono text-label text-muted transition-colors duration-fade hover:border-accent hover:text-ink"
          >
            {tool.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
