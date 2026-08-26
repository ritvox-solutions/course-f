"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setAccessToken, type AuthUser } from "./api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  // On mount, try to silently restore a session from the httpOnly refresh
  // cookie — this is the whole point of not persisting the access token
  // anywhere client-side.
  useEffect(() => {
    let cancelled = false;

    api.auth
      .refresh()
      .then((res) => {
        if (cancelled) return;
        setAccessToken(res.accessToken);
        setUser(res.user);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        setAccessToken(null);
        setUser(null);
        setStatus("unauthenticated");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login({ email, password });
    setAccessToken(res.accessToken);
    setUser(res.user);
    setStatus("authenticated");
  }, []);

  const signup = useCallback(async (email: string, password: string, displayName?: string) => {
    const res = await api.auth.signup({ email, password, displayName });
    setAccessToken(res.accessToken);
    setUser(res.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout().catch(() => {});
    setAccessToken(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
