"use client";

import Link from "next/link";
import { useEffect } from "react";

// Last-resort catch for an unexpected render crash — the specific, expected
// error states (invalid playlist link, ownership 404s, etc.) are already
// handled inline per page and never reach this boundary.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-canvas px-4 py-24 text-center">
      <p className="font-display text-xl font-medium text-ink">Something went wrong.</p>
      <p className="max-w-sm text-sm text-ink-muted">
        This page hit an unexpected error. You can try again, or head back to your dashboard.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="rounded-lg border border-line px-4 py-2 text-sm text-ink transition-colors hover:bg-surface-muted"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
