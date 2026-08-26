"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface AppHeaderProps {
  backHref?: string;
  backLabel?: string;
}

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/roadmaps", label: "Courses" },
];

export function AppHeader({ backHref, backLabel }: AppHeaderProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/dashboard" className="shrink-0 font-display text-[1.15rem] font-medium tracking-tight text-ink">
            Syllabus
          </Link>

          <nav className="flex shrink-0 items-center gap-3.5 text-sm">
            {NAV_LINKS.map((link) => {
              const active = pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`transition-colors ${active ? "font-medium text-accent" : "text-ink-muted hover:text-ink"}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {backHref && backLabel && (
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="text-line-strong" aria-hidden>
                /
              </span>
              <Link
                href={backHref}
                className="truncate text-sm text-ink-muted transition-colors hover:text-ink"
              >
                {backLabel}
              </Link>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden max-w-[180px] truncate text-sm text-ink-muted sm:inline">
            {user?.email}
          </span>
          <button
            type="button"
            onClick={() => logout()}
            className="rounded-md border border-line px-3 py-1.5 text-sm text-ink transition-colors hover:border-line-strong hover:bg-surface-muted"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
