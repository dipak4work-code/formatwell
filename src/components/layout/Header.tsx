'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV, SITE } from '@/lib/site';
import { ThemeToggle } from './ThemeToggle';
import { ShortcutsDialog } from './ShortcutsDialog';

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-14 max-w-app items-center gap-6 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-mono text-section font-600 text-ink"
        >
          <span aria-hidden="true" className="text-accent">
            ◧
          </span>
          <span>{SITE.name}</span>
        </Link>

        <nav aria-label="Tools" className="flex items-center gap-1">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={
                  'rounded-md px-3 py-1.5 font-mono text-label transition-colors duration-fade ' +
                  (active
                    ? 'bg-accent/10 text-accent'
                    : 'text-muted hover:text-ink')
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ShortcutsDialog />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
