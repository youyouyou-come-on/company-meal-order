"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function Navbar() {
  const { user, loading } = useCurrentUser();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;

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
  }, [userId]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <nav className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-orange-100">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-14 items-center justify-between gap-3 py-2">
          <div className="text-base font-bold leading-tight text-amber-700 sm:text-lg">
            🍽️ 广众&众创内部点餐系统
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <Link
              href="/"
              className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600"
            >
              点餐
            </Link>
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
                <Link
                  href="/employees"
                  className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-amber-50 hover:text-amber-800"
                >
                  员工管理
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
