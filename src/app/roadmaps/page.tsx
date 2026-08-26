"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { api, ApiError, type RoadmapSummary, type RoadmapTemplate } from "@/lib/api";
import { RequireAuth } from "@/lib/require-auth";
import { useToast } from "@/lib/use-toast";
import { AppHeader } from "@/components/app-header";
import { ProgressBar } from "@/components/progress-bar";
import { TemplateCard, TemplateCardSkeleton } from "@/components/template-card";
import { Toast } from "@/components/toast";
import { Skeleton } from "@/components/skeleton";

function aggregateProgress(roadmap: RoadmapSummary) {
  return roadmap.courses.reduce(
    (acc, c) => ({
      completed: acc.completed + c.completedLessons,
      total: acc.total + c.totalLessons,
      seconds: acc.seconds + c.totalDurationSeconds,
    }),
    { completed: 0, total: 0, seconds: 0 }
  );
}

// Real per-lesson durations, not a stored estimate.
function formatHours(totalSeconds: number): string {
  if (totalSeconds === 0) return "";
  const hours = totalSeconds / 3600;
  if (hours < 1) return `~${Math.max(1, Math.round(totalSeconds / 60))} min`;
  return `~${hours < 10 ? hours.toFixed(1).replace(/\.0$/, "") : Math.round(hours)} hrs`;
}

function RoadmapCard({ roadmap }: { roadmap: RoadmapSummary }) {
  const { completed, total, seconds } = aggregateProgress(roadmap);
  const hours = formatHours(seconds);
  return (
    <Link
      href={`/roadmaps/${roadmap.id}`}
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5 transition-colors hover:border-line-strong"
    >
      <h2 className="line-clamp-2 font-display text-lg font-medium text-ink">{roadmap.title}</h2>
      <p className="text-xs text-ink-muted">
        {roadmap.courses.length} module{roadmap.courses.length === 1 ? "" : "s"}
        {hours && ` · ${hours}`}
      </p>
      <ProgressBar completed={completed} total={total} />
      <p className="text-xs text-ink-muted">
        {completed} of {total} lessons complete
      </p>
    </Link>
  );
}

function RoadmapCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line p-5">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-1.5 w-full" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

function NewRoadmapForm({ onCreated }: { onCreated: (roadmap: RoadmapSummary) => void }) {
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.roadmaps.create(title.trim());
      setTitle("");
      onCreated(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-3">
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <input
          type="text"
          placeholder="Course name…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className="shrink-0 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Creating…" : "New course"}
        </button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}

function EmptyState({ onCreated }: { onCreated: (roadmap: RoadmapSummary) => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="font-display text-xl font-medium text-ink">Create a course to sequence modules</p>
      <p className="max-w-sm text-sm text-ink-muted">
        Add modules in order — each one unlocks once you finish the one before it.
      </p>
      <div className="w-full max-w-md pt-2">
        <NewRoadmapForm onCreated={onCreated} />
      </div>
    </div>
  );
}

function RoadmapsSkeleton() {
  return (
    <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <RoadmapCardSkeleton key={i} />
      ))}
    </div>
  );
}

function RoadmapsContent() {
  const router = useRouter();
  const [roadmaps, setRoadmaps] = useState<RoadmapSummary[] | null>(null);
  const [templates, setTemplates] = useState<RoadmapTemplate[] | null>(null);
  const { message: toastMessage, showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    api.roadmaps
      .list()
      .then((res) => {
        if (!cancelled) setRoadmaps(res);
      })
      .catch(() => {
        if (!cancelled) setRoadmaps([]);
      });
    api.roadmapTemplates
      .list()
      .then((res) => {
        if (!cancelled) setTemplates(res);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleCreated(roadmap: RoadmapSummary) {
    router.push(`/roadmaps/${roadmap.id}`);
  }

  async function handleUseTemplate(template: RoadmapTemplate) {
    try {
      const result = await api.roadmapTemplates.use(template.id);
      const skipped = result.results.filter((r) => r.status !== "created").length;
      if (skipped > 0) {
        showToast(
          `"${template.title}" added — ${skipped} module${skipped === 1 ? "" : "s"} already existed elsewhere and ${skipped === 1 ? "was" : "were"} skipped.`
        );
      }
      router.push(`/roadmaps/${result.roadmapId}`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not set up that course. Please try again.");
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-8">
        <section className="space-y-4">
          <div>
            <h1 className="font-display text-lg font-medium text-ink">Prebuilt courses</h1>
            <p className="text-sm text-ink-muted">
              Curated sequences for job-ready engineering skills — pick one to get started instantly.
            </p>
          </div>
          {templates === null ? (
            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <TemplateCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {templates.map((template) => (
                <TemplateCard key={template.id} template={template} onUse={handleUseTemplate} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-lg font-medium text-ink">Your courses</h2>

          {roadmaps !== null && roadmaps.length > 0 && (
            <div className="max-w-xl">
              <NewRoadmapForm onCreated={handleCreated} />
            </div>
          )}

          {roadmaps === null ? (
            <RoadmapsSkeleton />
          ) : roadmaps.length === 0 ? (
            <EmptyState onCreated={handleCreated} />
          ) : (
            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {roadmaps.map((roadmap) => (
                <RoadmapCard key={roadmap.id} roadmap={roadmap} />
              ))}
            </div>
          )}
        </section>
      </main>

      {toastMessage && <Toast message={toastMessage} />}
    </div>
  );
}

export default function RoadmapsPage() {
  return (
    <RequireAuth>
      <RoadmapsContent />
    </RequireAuth>
  );
}
