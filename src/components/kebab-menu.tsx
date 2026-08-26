"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError, type ResyncResponse } from "@/lib/api";

interface KebabMenuProps {
  courseId: string;
  onResynced?: (result: ResyncResponse) => void;
  onRemoved?: () => void;
}

export function KebabMenu({ courseId, onResynced, onRemoved }: KebabMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"resync" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function handleResync(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy("resync");
    setError(null);
    try {
      const result = await api.courses.resync(courseId);
      onResynced?.(result);
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not re-sync this module.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Remove this module? This can't be undone.")) return;
    setBusy("remove");
    setError(null);
    try {
      await api.courses.remove(courseId);
      onRemoved?.();
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove this module.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Module options"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
      >
        ⋮
      </button>
      {open && (
        <div
          onClick={(e) => e.preventDefault()}
          className="absolute right-0 z-10 mt-1.5 w-48 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg"
        >
          <button
            type="button"
            disabled={busy !== null}
            onClick={handleResync}
            className="block w-full px-3 py-1.5 text-left text-sm text-ink transition-colors hover:bg-surface-muted disabled:opacity-50"
          >
            {busy === "resync" ? "Re-syncing…" : "Re-sync"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={handleRemove}
            className="block w-full px-3 py-1.5 text-left text-sm text-danger transition-colors hover:bg-danger-soft disabled:opacity-50"
          >
            {busy === "remove" ? "Removing…" : "Remove module"}
          </button>
          {error && <p className="px-3 py-1 text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
