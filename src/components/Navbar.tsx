"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ForkKnife,
  Lightbulb,
  ListBullets,
  SignIn,
  SignOut,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import BrandMark from "@/components/BrandMark";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const navItems = [
  { href: "/", label: "点餐", icon: ForkKnife },
  { href: "/suggestions", label: "建议专区", icon: Lightbulb },
];

const adminItems = [
  { href: "/admin", label: "管理菜单", icon: ListBullets },
  { href: "/employees", label: "员工管理", icon: UsersThree },
];

export default function Navbar() {
  const { user, loading } = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const userId = user?.id;

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!userId) return;

    async function refreshLogin() {
      try {
        await fetch("/api/auth/me", { cache: "no-store" });
      } catch {
        // Session refresh failure is handled by subsequent page requests.
      }
    }

    const intervalId = window.setInterval(() => {
      void refreshLogin();
    }, 5 * 60 * 1000);

    function handleVisible() {
      if (document.visibilityState === "visible") void refreshLogin();
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

  const visibleItems = user ? [...navItems, ...adminItems] : navItems;

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-white/10 bg-[#151515] text-white shadow-lg print:hidden">
        <div className="mx-auto flex min-h-[72px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="ui-focus rounded-xl" aria-label="返回首页">
            <BrandMark inverse />
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {visibleItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`ui-press ui-focus ui-lift flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${
                    active
                      ? "bg-[#f5c518] text-[#151515]"
                      : "text-stone-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon size={19} weight={active ? "fill" : "bold"} aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            {!loading && user ? (
              <div className="hidden text-right sm:block">
                <div className="text-[10px] font-bold tracking-[0.16em] text-stone-500">当前员工</div>
                <div className="mt-0.5 text-sm font-black text-[#f5c518]">{user.name}</div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation-panel"
              className="ui-press ui-focus flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-black text-white hover:bg-white/10 lg:hidden"
            >
              菜单
            </button>
            <div className="hidden lg:block">
              {loading ? (
                <span className="text-sm text-stone-500">加载中...</span>
              ) : user ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="ui-press ui-focus flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-stone-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  <SignOut size={19} weight="bold" aria-hidden="true" />
                  退出
                </button>
              ) : (
                <Link
                  href="/login"
                  className="gold-button ui-press ui-focus flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-black"
                >
                  <SignIn size={19} weight="bold" aria-hidden="true" />
                  登录
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {menuOpen ? (
        <div className="modal-backdrop fixed inset-0 z-50 bg-black/65 px-3 pt-24 lg:hidden" onClick={() => setMenuOpen(false)}>
          <div
            id="mobile-navigation-panel"
            role="dialog"
            aria-modal="true"
            aria-label="导航菜单"
            className="modal-panel mx-auto max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#1d1d1b] text-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <div className="text-xs font-bold tracking-[0.18em] text-stone-500">INTERNAL MENU</div>
                <div className="mt-1 font-black">{user ? `${user.name}，你好` : "欢迎使用点餐系统"}</div>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="关闭菜单"
                className="ui-press ui-focus flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-stone-300 hover:bg-white/10"
              >
                <X size={22} weight="bold" aria-hidden="true" />
              </button>
            </div>
            <div className="grid gap-2 p-3">
              {visibleItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`ui-press ui-focus flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-black ${
                      active ? "bg-[#f5c518] text-[#151515]" : "bg-white/5 text-stone-200"
                    }`}
                  >
                    <Icon size={21} weight={active ? "fill" : "bold"} aria-hidden="true" />
                    {label}
                  </Link>
                );
              })}
              {user ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="ui-press ui-focus mt-2 flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-black text-red-300 hover:bg-red-500/10"
                >
                  <SignOut size={21} weight="bold" aria-hidden="true" />
                  退出登录
                </button>
              ) : (
                <Link
                  href="/login"
                  className="gold-button ui-press ui-focus mt-2 flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-black"
                >
                  <SignIn size={21} weight="bold" aria-hidden="true" />
                  登录
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
