interface ToolButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  title?: string;
}

/** Shared toolbar button used across the JSON/XML/Markdown tools. */
export function ToolButton({ children, onClick, disabled, primary, title }: ToolButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={
        'rounded-md border px-2.5 py-1.5 font-mono text-label transition-colors duration-fade ' +
        'disabled:cursor-not-allowed disabled:opacity-40 ' +
        (primary
          ? 'border-accent bg-accent/10 text-accent hover:bg-accent/20'
          : 'border-border bg-surface text-muted hover:text-ink hover:border-accent')
      }
    >
      {children}
    </button>
  );
}
