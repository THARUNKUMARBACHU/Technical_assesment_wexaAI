"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full">
        {/* Sidebar skeleton */}
        <div className="flex w-[240px] flex-col gap-4 border-r border-border p-4">
          <Skeleton className="h-8 w-32" />
          <div className="mt-4 flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-md" />
            ))}
          </div>
        </div>
        {/* Main area skeleton */}
        <div className="flex flex-1 flex-col">
          <div className="flex h-14 items-center justify-between border-b border-border px-6">
            <Skeleton className="h-4 w-40" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-32 rounded-md" />
              <Skeleton className="size-8 rounded-full" />
            </div>
          </div>
          <div className="flex-1 p-6">
            <div className="flex flex-col gap-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-48 w-full rounded-lg" />
              <div className="grid grid-cols-3 gap-4">
                <Skeleton className="h-32 rounded-lg" />
                <Skeleton className="h-32 rounded-lg" />
                <Skeleton className="h-32 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <AppShell>{children}</AppShell>;
}
