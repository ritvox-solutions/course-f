import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-canvas px-4 py-24 text-center">
      <p className="font-display text-xl font-medium text-ink">Page not found</p>
      <p className="max-w-sm text-sm text-ink-muted">
        That page doesn&apos;t exist, or you may not have access to it.
      </p>
      <Link
        href="/dashboard"
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
