"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "./auth-context";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status !== "authenticated") {
    return <p className="flex-1 py-24 text-center text-ink-muted">Loading…</p>;
  }

  return <>{children}</>;
}
