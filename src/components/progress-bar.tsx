// UI/UX Design Brief §2: "a single confident accent color for progress bars,
// primary buttons, and active states."
export function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
