"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { resolvePostAuthDestination } from "@/lib/pending-import";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push(await resolvePostAuthDestination());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-canvas px-4 py-16">
      <Link href="/" className="font-display text-xl font-medium tracking-tight text-ink">
        Syllabus
      </Link>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-xl border border-line bg-surface p-8 shadow-sm"
      >
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Welcome back</h1>
          <p className="text-sm text-ink-muted">Log in to continue where you left off.</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-ink-muted">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink transition-colors focus:border-accent focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium text-ink-muted">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink transition-colors focus:border-accent focus:outline-none"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Logging in…" : "Log in"}
        </button>

        <p className="text-center text-sm text-ink-muted">
          No account?{" "}
          <Link href="/signup" className="font-medium text-accent underline-offset-2 hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}
