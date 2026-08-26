"use client";

import { useState } from "react";
import type { RoadmapTemplate } from "@/lib/api";
import { Skeleton } from "@/components/skeleton";

export function TemplateCard({
  template,
  onUse,
}: {
  template: RoadmapTemplate;
  onUse: (template: RoadmapTemplate) => void;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
      <div>
        <h3 className="font-display text-base font-medium text-ink">{template.title}</h3>
        <p className="mt-1 text-sm text-ink-muted">{template.description}</p>
      </div>
      <p className="text-xs text-ink-faint">
        {template.courseCount} module{template.courseCount === 1 ? "" : "s"}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          onUse(template);
        }}
        className="mt-auto rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Setting up…" : "Start learning"}
      </button>
    </div>
  );
}

export function TemplateCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line p-5">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
