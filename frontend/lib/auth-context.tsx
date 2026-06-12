"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, tokenStore } from "./api";
import type { User } from "./types";

interface RegisterInput {
  businessName: string;
  businessType: string;
  businessEmail: string;
  phone?: string;
  ownerName: string;
  ownerEmail: string;
  password: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = "smartpos.user";

function loadCachedUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from localStorage, then confirm the session is still valid.
  useEffect(() => {
    const cached = loadCachedUser();
    if (!cached || !tokenStore.access) {
      setLoading(false);
      return;
    }
    setUser(cached);
    api
      .get<User & { business?: unknown }>("/users/me")
      .then((res) => {
        setUser(res.data);
        localStorage.setItem(USER_KEY, JSON.stringify(res.data));
      })
      .catch(() => {
        // 401 handling in the client already redirects; just drop state here
        setUser(null);
        localStorage.removeItem(USER_KEY);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>("/auth/login", { email, password });
    tokenStore.set(res.data.accessToken, res.data.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const res = await api.post<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>("/auth/register", input);
    tokenStore.set(res.data.accessToken, res.data.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout", { refreshToken: tokenStore.refresh });
    } catch {
      // Best effort — clear locally regardless
    }
    tokenStore.clear();
    localStorage.removeItem(USER_KEY);
    setUser(null);
    window.location.href = "/login";
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// Where each role lands after login
export function homeFor(role: User["role"]): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/admin";
    case "CASHIER":
      return "/pos";
    default:
      return "/dashboard";
  }
}
