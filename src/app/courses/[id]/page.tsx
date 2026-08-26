"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, type CourseDetail, type LessonSummary, type ResyncResponse } from "@/lib/api";
import { RequireAuth } from "@/lib/require-auth";
import { useToast } from "@/lib/use-toast";
import { AppHeader } from "@/components/app-header";
import { ProgressBar } from "@/components/progress-bar";
import { LessonStatusIcon } from "@/components/lesson-status-icon";
import { KebabMenu } from "@/components/kebab-menu";
import { Toast } from "@/components/toast";
import { Skeleton } from "@/components/skeleton";

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Syllabus-style "~X hours" framing, derived from real per-lesson durations
// (not a stored estimate) — unavailable lessons don't count toward it.
function formatEstimatedHours(lessons: LessonSummary[]): string {
  const totalSeconds = lessons
    .filter((l) => l.isAvailable)
    .reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0);
  if (totalSeconds === 0) return "";
  const hours = totalSeconds / 3600;
  if (hours < 1) return `~${Math.max(1, Math.round(totalSeconds / 60))} min`;
  return `~${hours < 10 ? hours.toFixed(1).replace(/\.0$/, "") : Math.round(hours)} hr${hours >= 1.5 ? "s" : ""}`;
}

// App Flow §2.5: "prominent 'Continue learning' button jumps to the first
// not-started/in-progress lesson."
function findContinueLesson(lessons: LessonSummary[]): LessonSummary | null {
  return (
    lessons.find((l) => l.isAvailable && (l.progress?.status ?? "not_started") !== "completed") ?? null
  );
}

function LessonRow({
  courseId,
  lesson,
  disabled,
}: {
  courseId: string;
  lesson: LessonSummary;
  disabled: boolean;
}) {
  const status = lesson.progress?.status ?? "not_started";
  const resumeSeconds =
    status === "in_progress" && lesson.progress ? Math.round(Number(lesson.progress.lastWatchedSeconds)) : null;

  const content = (
    <>
      <LessonStatusIcon status={status} />
      <div className="h-10 w-16 shrink-0 overflow-hidden rounded-md bg-surface-muted">
        {lesson.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lesson.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">{lesson.title}</p>
        <p className="text-xs text-ink-muted">
          {formatDuration(lesson.durationSeconds)}
          {!lesson.isAvailable && <span className="ml-2">Unavailable</span>}
        </p>
      </div>
      {resumeSeconds != null && (
        <span className="hidden shrink-0 text-xs text-ink-faint sm:inline">
          resume at {formatDuration(resumeSeconds)}
        </span>
      )}
    </>
  );

  if (disabled) {
    return (
      <div className="flex cursor-not-allowed items-center gap-3 px-4 py-3 opacity-50">{content}</div>
    );
  }

  return (
    <Link
      href={`/courses/${courseId}/lessons/${lesson.id}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted"
    >
      {content}
    </Link>
  );
}

function CourseDetailSkeleton() {
  return (
    <div className="w-full max-w-2xl space-y-6">
      <div className="space-y-3 rounded-xl border border-line bg-surface p-6">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-1.5 w-full" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="divide-y divide-line rounded-xl border border-line bg-surface">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
            <Skeleton className="h-10 w-16 shrink-0" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CourseDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "redirecting" }
    | { phase: "error"; message: string }
    | { phase: "ready"; course: CourseDetail }
  >({ phase: "loading" });
  const { message: toastMessage, showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    api.courses
      .get(id)
      .then((course) => {
        if (!cancelled) setState({ phase: "ready", course });
      })
      .catch((err) => {
        if (cancelled) return;
        // App Flow §3: a course you don't own (or a bad id) should bounce
        // you to the Dashboard, not show you an error page — there's no
        // RLS backstop on this stack, so the 404 here is the only signal.
        if (err instanceof ApiError && err.status === 404) {
          setState({ phase: "redirecting" });
          router.replace("/dashboard");
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

  async function handleResynced(result: ResyncResponse) {
    showToast(
      result.newLessonsAdded > 0
        ? `Module updated — ${result.newLessonsAdded} new lesson${result.newLessonsAdded === 1 ? "" : "s"} added.`
        : "Module updated — no new lessons found."
    );
    // The resync response only carries the course summary; re-fetch the full
    // detail so the lesson list reflects additions/availability flips too.
    const refreshed = await api.courses.get(id);
    setState({ phase: "ready", course: refreshed });
  }

  function handleRemoved(roadmapId: string | null) {
    router.push(roadmapId ? `/roadmaps/${roadmapId}` : "/dashboard");
  }

  if (state.phase === "loading") {
    return (
      <div className="flex flex-1 flex-col bg-canvas">
        <AppHeader backHref="/dashboard" backLabel="Dashboard" />
        <div className="flex flex-1 flex-col items-center px-4 py-12">
          <CourseDetailSkeleton />
        </div>
      </div>
    );
  }

  if (state.phase === "redirecting") {
    return null;
  }

  if (state.phase === "error") {
    return <p className="flex-1 py-24 text-center text-danger">{state.message}</p>;
  }

  const { course } = state;
  const continueLesson = findContinueLesson(course.lessons);

  const back = course.roadmapId
    ? { href: `/roadmaps/${course.roadmapId}`, label: "Course" }
    : { href: "/dashboard", label: "Dashboard" };

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <AppHeader backHref={back.href} backLabel={back.label} />

      <div className="flex flex-1 flex-col items-center px-4 py-12">
        <div className="w-full max-w-2xl space-y-6">
          <header className="space-y-4 rounded-xl border border-line bg-surface p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-balance font-display text-2xl font-medium tracking-tight text-ink">
                  {course.title}
                </h1>
                <p className="mt-1 text-sm text-ink-muted">
                  {course.channelTitle}
                  {course.channelTitle && " · "}
                  {course.totalLessons} lesson{course.totalLessons === 1 ? "" : "s"}
                  {formatEstimatedHours(course.lessons) && ` · ${formatEstimatedHours(course.lessons)}`}
                </p>
              </div>
              <KebabMenu
                courseId={course.id}
                onResynced={handleResynced}
                onRemoved={() => handleRemoved(course.roadmapId)}
              />
            </div>

            <div className="space-y-1.5">
              <ProgressBar completed={course.completedLessons} total={course.totalLessons} />
              <p className="text-sm text-ink-muted">
                {course.completedLessons} of {course.totalLessons} lessons complete
              </p>
            </div>

            {course.locked ? (
              <div className="rounded-lg border border-line bg-surface-muted px-4 py-3">
                <p className="text-sm text-ink">
                  This module is locked
                  {course.lockedBecause && (
                    <>
                      . Complete <span className="font-medium">{course.lockedBecause.title}</span> to unlock it
                    </>
                  )}
                  .
                </p>
                {course.roadmapId && (
                  <Link
                    href={`/roadmaps/${course.roadmapId}`}
                    className="mt-1 inline-block text-sm text-accent underline-offset-2 hover:underline"
                  >
                    Back to course
                  </Link>
                )}
              </div>
            ) : continueLesson ? (
              <Link
                href={`/courses/${course.id}/lessons/${continueLesson.id}`}
                className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
              >
                Continue learning
              </Link>
            ) : (
              course.totalLessons > 0 && (
                <p className="text-sm font-medium text-accent">All lessons complete</p>
              )
            )}
          </header>

          {course.description && (
            <div className="rounded-xl border border-line bg-surface p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">About this module</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">{course.description}</p>
            </div>
          )}

          <ol className="divide-y divide-line rounded-xl border border-line bg-surface">
            {course.lessons.map((lesson) => (
              <li key={lesson.id}>
                <LessonRow courseId={course.id} lesson={lesson} disabled={!lesson.isAvailable || course.locked} />
              </li>
            ))}
          </ol>
        </div>
      </div>

      {toastMessage && <Toast message={toastMessage} />}
    </div>
  );
}

export default function CourseDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  return (
    <RequireAuth>
      <CourseDetailContent id={id} />
    </RequireAuth>
  );
}
