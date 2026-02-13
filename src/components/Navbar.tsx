"use client";

import Link from "next/link";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function Navbar() {
  const { user, loading } = useCurrentUser();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <Link
            href="/"
            className="text-lg font-bold text-blue-600 hover:text-blue-700"
          >
            公司点餐
          </Link>

          <div className="flex items-center gap-4">
            {loading ? (
              <span className="text-sm text-gray-400">加载中...</span>
            ) : user ? (
              <>
                <Link
                  href="/admin"
                  className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                >
                  管理菜单
                </Link>
                <span className="text-sm text-gray-700">{user.name}</span>
                <button
                  onClick={handleLogout}
                  className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                >
                  退出
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
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
