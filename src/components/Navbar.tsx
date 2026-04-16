"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function Navbar() {
  const { user, loading } = useCurrentUser();

  useEffect(() => {
    if (!user) return;

    async function refreshLogin() {
      try {
        await fetch("/api/auth/me", { cache: "no-store" });
      } catch {
        // ignore session refresh errors and let normal page requests handle state
      }
    }

    const intervalId = window.setInterval(() => {
      void refreshLogin();
    }, 5 * 60 * 1000);

    function handleVisible() {
      if (document.visibilityState === "visible") {
        void refreshLogin();
      }
    }

    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("focus", handleVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", handleVisible);
    };
  }, [user?.id]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <nav className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-orange-100">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <Link
            href="/"
            className="text-lg font-bold text-amber-600 hover:text-amber-700"
          >
            🍽️ 公司点餐
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/suggestions"
              className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-amber-50 hover:text-amber-800"
            >
              建议专区
            </Link>
            {loading ? (
              <span className="text-sm text-gray-400">加载中...</span>
            ) : user ? (
              <>
                <Link
                  href="/admin"
                  className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-amber-50 hover:text-amber-800"
                >
                  管理菜单
                </Link>
                <span className="text-sm font-medium text-amber-700">{user.name}</span>
                <button
                  onClick={handleLogout}
                  className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-red-50 hover:text-red-600"
                >
                  退出
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-md bg-amber-500 px-3 py-1.5 text-sm text-white hover:bg-amber-600"
              >
                登录
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
