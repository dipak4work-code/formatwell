import Link from 'next/link';
import { SITE } from '@/lib/site';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="mx-auto flex max-w-app flex-col gap-2 px-4 py-6 text-label text-muted sm:flex-row sm:items-center sm:px-6">
        <p className="text-ink">{SITE.privacyPromise}</p>
        <nav aria-label="Footer" className="flex gap-4 sm:ml-auto">
          <Link href="/about" className="transition-colors duration-fade hover:text-ink">
            About
          </Link>
          <Link href="/json" className="transition-colors duration-fade hover:text-ink">
            JSON
          </Link>
          <Link href="/xml" className="transition-colors duration-fade hover:text-ink">
            XML
          </Link>
          <Link href="/markdown" className="transition-colors duration-fade hover:text-ink">
            Markdown
          </Link>
        </nav>
      </div>
    </footer>
  );
}
