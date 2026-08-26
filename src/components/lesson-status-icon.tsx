import type { LessonStatus } from "@/lib/api";

// UI/UX Design Brief §2: "Simple line icons for status (not-started circle,
// in-progress partial-fill circle, completed checkmark)."
export function LessonStatusIcon({ status }: { status: LessonStatus }) {
  if (status === "completed") {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-accent" aria-label="Completed">
        <circle cx="10" cy="10" r="9" fill="currentColor" />
        <path
          d="M6 10.5l2.5 2.5L14 7.5"
          stroke="var(--accent-ink)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  }

  if (status === "in_progress") {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-accent" aria-label="In progress">
        <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 10 L10 2.5 A7.5 7.5 0 0 1 17 10 Z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-ink-faint" aria-label="Not started">
      <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
