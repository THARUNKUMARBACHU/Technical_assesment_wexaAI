"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { setAccessToken, getAccessToken } from "@/lib/api-client";
import type { UserWithOrg, LoginResponse, RegisterResponse } from "@/types/api";
import { useCurrentUser } from "@/hooks/use-auth";

interface AuthContextValue {
  user: UserWithOrg | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setAuth: (data: LoginResponse | RegisterResponse) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  setAuth: () => {},
  clearAuth: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  // Try to restore token from localStorage on mount
  useEffect(() => {
    const refreshToken = localStorage.getItem("refresh_token");
    if (refreshToken && !getAccessToken()) {
      // Will be handled by the auto-refresh in api-client
    }
    setReady(true);
  }, []);

  const { data: user, isLoading, isError } = useCurrentUser();

  const setAuth = useCallback((data: LoginResponse | RegisterResponse) => {
    setAccessToken(data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
  }, []);

  const clearAuth = useCallback(() => {
    setAccessToken(null);
    localStorage.removeItem("refresh_token");
    router.push("/login");
  }, [router]);

  if (!ready) return null;

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        isAuthenticated: !!user && !isError,
        setAuth,
        clearAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
