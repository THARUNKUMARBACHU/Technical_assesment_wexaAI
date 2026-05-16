"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const refreshToken = localStorage.getItem("refresh_token");
    if (refreshToken) {
      router.replace("/dashboards");
    } else {
      router.replace("/login");
    }
  }, [router]);

  return null;
}
