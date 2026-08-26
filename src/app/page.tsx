"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ImportPlaylistForm } from "@/components/import-playlist-form";

const FEATURES = [
  {
    title: "Automatic progress",
    body: "Every lesson tracks how far you actually got — no manual checkboxes to keep up with.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8.5 12.5 L10.75 14.75 L15.5 9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "One clean lesson list",
    body: "No comments, no recommended videos, no sidebar to fall down. Just the lessons, in order.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <path d="M8 6h12M8 12h12M8 18h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="4" cy="6" r="1.4" fill="currentColor" />
        <circle cx="4" cy="12" r="1.4" fill="currentColor" />
        <circle cx="4" cy="18" r="1.4" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: "Pick up instantly",
    body: "Close the tab, come back next week — it resumes to the second, every time.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 7 V12 L15.5 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function Home() {
  const { status: authStatus } = useAuth();

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight text-ink">Syllabus</span>

          {authStatus === "authenticated" ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
            >
              Go to dashboard
            </Link>
          ) : (
            <nav className="flex items-center gap-6 text-sm">
              <Link href="/login" className="text-ink-muted transition-colors hover:text-ink">
                Log in
              </Link>
              <Link href="/signup" className="font-medium text-ink transition-colors hover:text-accent">
                Sign up
              </Link>
            </nav>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center">
        <section className="w-full max-w-3xl px-6 pb-16 pt-20 text-center sm:pt-28">
          <span className="inline-flex items-center rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
            YouTube playlist → real course
          </span>

          <h1 className="text-balance pt-6 text-6xl font-bold leading-[0.98] tracking-tight text-ink sm:text-7xl">
            Watch it like a course, not a queue.
          </h1>

          <p className="mx-auto max-w-xl text-balance pt-6 text-lg text-ink-muted">
            Paste any YouTube playlist and Syllabus turns it into a distraction-reduced
            course — a clean lesson list, an app of its own to watch in, and progress that
            tracks itself.
          </p>

          <div className="mx-auto max-w-lg pt-7">
            <div className="rounded-xl border border-line bg-surface p-3 text-left shadow-sm">
              <ImportPlaylistForm requireAuth size="lg" />
            </div>
          </div>
        </section>

        <section className="w-full border-t border-line bg-surface-muted">
          <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-8 px-6 py-16 sm:grid-cols-3 sm:gap-10">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="space-y-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
                  {feature.icon}
                </div>
                <h2 className="text-lg font-semibold text-ink">{feature.title}</h2>
                <p className="text-sm text-ink-muted">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
