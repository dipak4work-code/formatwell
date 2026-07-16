interface ToolHeaderProps {
  title: string;
  description: string;
}

/**
 * Shared tool-page header — a single compact row: title, description, and the privacy
 * note. Stacks vertically on small screens.
 */
export function ToolHeader({ title, description }: ToolHeaderProps) {
  return (
    <header className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
      <div className="flex min-w-0 flex-col gap-1 md:flex-row md:items-baseline md:gap-3">
        <h1 className="shrink-0 font-mono text-section font-600 text-ink">{title}</h1>
        <p className="min-w-0 text-label text-muted md:truncate" title={description}>
          {description}
        </p>
      </div>

      <p className="hidden shrink-0 items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 font-mono text-label md:ml-auto md:flex">
        <span aria-hidden="true" className="text-accent">
          ◧
        </span>
        <span className="text-ink">Private by design</span>
        <span className="text-muted">— nothing you paste is uploaded.</span>
      </p>
    </header>
  );
}
