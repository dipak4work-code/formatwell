interface ToolHeaderProps {
  title: string;
  description: string;
}

/**
 * Shared tool-page header. Lays the eyebrow/title/description on the left and a compact
 * privacy card on the right so the wide header space reads as intentional, not empty.
 */
export function ToolHeader({ title, description }: ToolHeaderProps) {
  return (
    <header className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-mono text-title font-600 text-ink">{title}</h1>
        <p className="max-w-2xl text-body text-muted">{description}</p>
      </div>

      <div className="hidden items-center gap-3 rounded-md border border-border bg-surface px-4 py-3 md:flex md:flex-1">
        <span aria-hidden="true" className="text-lg text-accent">
          ◧
        </span>
        <div>
          <p className="font-mono text-label text-ink">Private by design</p>
          <p className="font-mono text-[11px] leading-relaxed text-muted">
            Everything runs in your browser. Nothing you paste is uploaded.
          </p>
        </div>
      </div>
    </header>
  );
}
