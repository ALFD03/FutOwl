import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { refreshAccessToken, tokenStore } from "@/api/client";
import { auth } from "@/services";
import type { Me } from "@/types";

export interface AuthContextValue {
  user: Me | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<Me>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
  can: (perm: string | string[], mode?: "all" | "any") => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const reload = useCallback(async () => {
    setUser(await auth.me());
  }, []);

  // Restaura la sesión con la cookie httpOnly del refresh token
  useEffect(() => {
    tokenStore.onExpired(() => {
      setUser(null);
      queryClient.clear();
    });
    (async () => {
      try {
        if (await refreshAccessToken()) await reload();
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [queryClient, reload]);

  // Renovación proactiva del access token (vida corta)
  useEffect(() => {
    if (!user) return;
    const id = window.setInterval(() => void refreshAccessToken(), 10 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [user]);

  const login = useCallback(async (username: string, password: string) => {
    const data = await auth.login(username, password);
    tokenStore.set(data.access);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await auth.logout();
    } finally {
      tokenStore.set(null);
      setUser(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const can = useCallback(
    (perm: string | string[], mode: "all" | "any" = "all") => {
      if (!user) return false;
      if (user.is_superuser) return true;
      const perms = Array.isArray(perm) ? perm : [perm];
      const check = (p: string) => user.permissions.includes(p);
      return mode === "any" ? perms.some(check) : perms.every(check);
    },
    [user],
  );

  const value = useMemo(() => ({ user, loading, login, logout, reload, can }), [user, loading, login, logout, reload, can]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
