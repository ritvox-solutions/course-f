"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, type CourseSummary, type ResyncResponse, type RoadmapTemplate } from "@/lib/api";
import { RequireAuth } from "@/lib/require-auth";
import { useToast } from "@/lib/use-toast";
import { AppHeader } from "@/components/app-header";
import { ImportPlaylistForm } from "@/components/import-playlist-form";
import { ProgressBar } from "@/components/progress-bar";
import { KebabMenu } from "@/components/kebab-menu";
import { TemplateCard, TemplateCardSkeleton } from "@/components/template-card";
import { Toast } from "@/components/toast";
import { Skeleton } from "@/components/skeleton";

interface CourseCardProps {
  course: CourseSummary;
  onResynced: (result: ResyncResponse) => void;
  onRemoved: (courseId: string) => void;
}

function CourseCard({ course, onResynced, onRemoved }: CourseCardProps) {
  return (
    <Link
      href={`/courses/${course.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-line-strong"
    >
      <div className="aspect-video w-full overflow-hidden bg-surface-muted">
        {course.thumbnailUrl && (
          // Remote YouTube thumbnails — next/image would require configuring
          // remotePatterns for i.ytimg.com; a plain <img> is the pragmatic
          // choice here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-medium text-ink">{course.title}</p>
          <div onClick={(e) => e.preventDefault()}>
            <KebabMenu
              courseId={course.id}
              onResynced={onResynced}
              onRemoved={() => onRemoved(course.id)}
            />
          </div>
        </div>

        <ProgressBar completed={course.completedLessons} total={course.totalLessons} />

        <p className="text-xs text-ink-muted">
          {course.completedLessons} of {course.totalLessons} lessons complete
        </p>

        <span className="mt-auto flex items-center gap-1 pt-1 text-sm font-medium text-accent">
          Continue
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </div>
    </Link>
  );
}

function CourseCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-line">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="flex flex-col gap-2.5 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-1.5 w-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <CourseCardSkeleton key={i} />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <p className="font-display text-xl font-medium text-ink">Name your first track to get started</p>
      <p className="max-w-sm text-sm text-ink-muted">
        We&apos;ll turn it into a module with a clean lesson list and automatic progress tracking.
      </p>
      <div className="w-full max-w-md pt-2">
        <ImportPlaylistForm />
      </div>
    </div>
  );
}

interface CourseGridProps {
  courses: CourseSummary[];
  onResynced: (result: ResyncResponse) => void;
  onRemoved: (courseId: string) => void;
}

function CourseGrid({ courses, onResynced, onRemoved }: CourseGridProps) {
  return (
    <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} onResynced={onResynced} onRemoved={onRemoved} />
      ))}
    </div>
  );
}

function DashboardContent() {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [templates, setTemplates] = useState<RoadmapTemplate[] | null>(null);
  const { message: toastMessage, showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    api.courses
      .list()
      .then((res) => {
        if (!cancelled) setCourses(res);
      })
      .catch(() => {
        if (!cancelled) setCourses([]);
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

  function handleResynced(result: ResyncResponse) {
    setCourses((prev) => prev?.map((c) => (c.id === result.course.id ? result.course : c)) ?? prev);
    showToast(
      result.newLessonsAdded > 0
        ? `Module updated — ${result.newLessonsAdded} new lesson${result.newLessonsAdded === 1 ? "" : "s"} added.`
        : "Module updated — no new lessons found."
    );
  }

  function handleRemoved(courseId: string) {
    setCourses((prev) => prev?.filter((c) => c.id !== courseId) ?? prev);
    showToast("Module removed.");
  }

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-5 py-8 sm:px-8">
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
          <h2 className="font-display text-lg font-medium text-ink">Your modules</h2>

          {courses !== null && courses.length > 0 && (
            <div className="max-w-xl">
              <ImportPlaylistForm />
            </div>
          )}

          {courses === null ? (
            <DashboardSkeleton />
          ) : courses.length === 0 ? (
            <EmptyState />
          ) : (
            <CourseGrid courses={courses} onResynced={handleResynced} onRemoved={handleRemoved} />
          )}
        </section>
      </main>

      {toastMessage && <Toast message={toastMessage} />}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
