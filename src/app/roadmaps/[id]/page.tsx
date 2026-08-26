"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, type ResyncResponse, type RoadmapCourseDetail, type RoadmapDetail } from "@/lib/api";
import { RequireAuth } from "@/lib/require-auth";
import { useToast } from "@/lib/use-toast";
import { AppHeader } from "@/components/app-header";
import { ProgressBar } from "@/components/progress-bar";
import { KebabMenu } from "@/components/kebab-menu";
import { ImportPlaylistForm } from "@/components/import-playlist-form";
import { Toast } from "@/components/toast";
import { Skeleton } from "@/components/skeleton";

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function ChevronIcon({ className, expanded }: { className?: string; expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} transition-transform ${expanded ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function StepBadge({ index, locked }: { index: number; locked: boolean }) {
  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
        locked ? "bg-surface-muted text-ink-faint" : "bg-accent-soft text-accent"
      }`}
    >
      {index + 1}
    </div>
  );
}

// Real per-lesson durations, not a stored estimate — matches the same
// framing used on the course detail page.
function formatHours(totalSeconds: number): string {
  if (totalSeconds === 0) return "";
  const hours = totalSeconds / 3600;
  if (hours < 1) return `~${Math.max(1, Math.round(totalSeconds / 60))} min`;
  return `~${hours < 10 ? hours.toFixed(1).replace(/\.0$/, "") : Math.round(hours)} hrs`;
}

function formatLessonDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// The "syllabus" — a specialization page's whole reason to let you preview
// a step before it's unlocked: what it covers and exactly what's in it.
function SyllabusPreview({ course }: { course: RoadmapCourseDetail }) {
  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      {course.description && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">{course.description}</p>
      )}
      <ol className="space-y-1.5">
        {course.lessons.map((lesson, i) => (
          <li key={lesson.id} className="flex items-center gap-2.5 text-sm">
            <span className="w-5 shrink-0 text-right text-xs text-ink-faint">{i + 1}.</span>
            <span className={`min-w-0 flex-1 truncate ${lesson.isAvailable ? "text-ink" : "text-ink-faint"}`}>
              {lesson.title}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-ink-faint">
              {formatLessonDuration(lesson.durationSeconds)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function RoadmapStep({
  course,
  index,
  onResynced,
  onRemoved,
}: {
  course: RoadmapCourseDetail;
  index: number;
  onResynced: (result: ResyncResponse) => void;
  onRemoved: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hours = formatHours(course.totalDurationSeconds);

  const expandButton = (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      aria-label={expanded ? "Hide syllabus" : "Preview syllabus"}
      aria-expanded={expanded}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
    >
      <ChevronIcon className="h-4 w-4" expanded={expanded} />
    </button>
  );

  const thumbnail = (
    <div className="h-10 w-16 shrink-0 overflow-hidden rounded-md bg-surface-muted">
      {course.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={course.thumbnailUrl} alt="" className="h-full w-full object-cover" />
      )}
    </div>
  );

  if (course.locked) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4 opacity-60">
        <div className="flex items-center gap-3">
          <StepBadge index={index} locked />
          {thumbnail}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <LockIcon className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
              <p className="truncate text-sm font-medium text-ink">{course.title}</p>
            </div>
            <p className="mt-0.5 text-xs text-ink-muted">
              {course.lockedBecause ? `Complete "${course.lockedBecause.title}" to unlock` : "Locked"} ·{" "}
              {course.totalLessons} lesson{course.totalLessons === 1 ? "" : "s"}
              {hours && ` · ${hours}`}
            </p>
          </div>
          {expandButton}
        </div>
        {expanded && <SyllabusPreview course={course} />}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong">
      <div className="flex items-center gap-3">
        <StepBadge index={index} locked={false} />
        <Link href={`/courses/${course.id}`} className="flex min-w-0 flex-1 items-center gap-3">
          {thumbnail}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{course.title}</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              {course.completedLessons} of {course.totalLessons} lessons complete
              {hours && ` · ${hours}`}
            </p>
            <div className="mt-1.5">
              <ProgressBar completed={course.completedLessons} total={course.totalLessons} />
            </div>
          </div>
        </Link>
        {expandButton}
        <KebabMenu courseId={course.id} onResynced={onResynced} onRemoved={onRemoved} />
      </div>
      {expanded && <SyllabusPreview course={course} />}
    </div>
  );
}

function RoadmapDetailSkeleton() {
  return (
    <div className="w-full max-w-2xl space-y-6">
      <div className="space-y-3 rounded-xl border border-line bg-surface p-6">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function RoadmapDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "redirecting" }
    | { phase: "error"; message: string }
    | { phase: "ready"; roadmap: RoadmapDetail }
  >({ phase: "loading" });
  const { message: toastMessage, showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    api.roadmaps
      .get(id)
      .then((roadmap) => {
        if (!cancelled) setState({ phase: "ready", roadmap });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setState({ phase: "redirecting" });
          router.replace("/roadmaps");
          return;
        }
        setState({
          phase: "error",
          message: err instanceof ApiError ? err.message : "Could not load this course.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  // Best-effort refresh after an action (resync/remove/import) — the
  // component is definitely still mounted when these fire (they're all
  // triggered by a user interaction), so no cancellation guard is needed.
  async function refetch() {
    const roadmap = await api.roadmaps.get(id);
    setState({ phase: "ready", roadmap });
  }

  async function handleResynced(result: ResyncResponse) {
    showToast(
      result.newLessonsAdded > 0
        ? `Module updated — ${result.newLessonsAdded} new lesson${result.newLessonsAdded === 1 ? "" : "s"} added.`
        : "Module updated — no new lessons found."
    );
    await refetch();
  }

  async function handleCourseRemoved() {
    showToast("Module removed.");
    await refetch();
  }

  async function handleImported() {
    await refetch();
  }

  async function handleDelete() {
    if (state.phase !== "ready") return;
    if (!window.confirm("Delete this course? This removes its modules and progress too — this can't be undone."))
      return;
    await api.roadmaps.remove(id);
    router.push("/roadmaps");
  }

  if (state.phase === "loading") {
    return (
      <div className="flex flex-1 flex-col items-center bg-canvas px-4 py-12">
        <RoadmapDetailSkeleton />
      </div>
    );
  }

  if (state.phase === "redirecting") {
    return null;
  }

  if (state.phase === "error") {
    return <p className="flex-1 py-24 text-center text-danger">{state.message}</p>;
  }

  const { roadmap } = state;
  const totalHoursSeconds = roadmap.courses.reduce((sum, c) => sum + c.totalDurationSeconds, 0);
  const totalLessons = roadmap.courses.reduce((sum, c) => sum + c.totalLessons, 0);
  const completedLessons = roadmap.courses.reduce((sum, c) => sum + c.completedLessons, 0);
  const hours = formatHours(totalHoursSeconds);

  return (
    <div className="flex flex-1 flex-col items-center bg-canvas px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        <header className="flex items-start justify-between gap-3 rounded-xl border border-line bg-surface p-6">
          <div className="min-w-0">
            <h1 className="text-balance font-display text-2xl font-medium tracking-tight text-ink">
              {roadmap.title}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {roadmap.courses.length} module{roadmap.courses.length === 1 ? "" : "s"} · {totalLessons} lesson
              {totalLessons === 1 ? "" : "s"}
              {hours && ` · ${hours}`}
            </p>
            {roadmap.courses.length > 0 && (
              <div className="mt-3 max-w-xs space-y-1">
                <ProgressBar completed={completedLessons} total={totalLessons} />
                <p className="text-xs text-ink-muted">
                  {completedLessons} of {totalLessons} lessons complete
                </p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleDelete}
            className="shrink-0 rounded-md border border-line px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger-soft"
          >
            Delete
          </button>
        </header>

        {roadmap.courses.length > 0 && (
          <ol className="space-y-3">
            {roadmap.courses.map((course, index) => (
              <li key={course.id}>
                <RoadmapStep
                  course={course}
                  index={index}
                  onResynced={handleResynced}
                  onRemoved={handleCourseRemoved}
                />
              </li>
            ))}
          </ol>
        )}

        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="pb-3 text-sm font-medium text-ink">Add the next module</p>
          <ImportPlaylistForm roadmapId={roadmap.id} onImported={handleImported} />
        </div>
      </div>

      {toastMessage && <Toast message={toastMessage} />}
    </div>
  );
}

export default function RoadmapDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  return (
    <RequireAuth>
      <AppHeader backHref="/roadmaps" backLabel="Courses" />
      <RoadmapDetailContent id={id} />
    </RequireAuth>
  );
}
