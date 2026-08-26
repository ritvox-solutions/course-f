"use client";

import { useCallback, useEffect, useState } from "react";

const TOAST_DURATION_MS = 4000;

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [message]);

  const showToast = useCallback((msg: string) => setMessage(msg), []);

  return { message, showToast };
}
