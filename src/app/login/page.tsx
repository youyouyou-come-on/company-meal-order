"use client";

import { useState, FormEvent } from "react";
import { LockKey, SignIn, SpinnerGap, User } from "@phosphor-icons/react";
import BrandMark from "@/components/BrandMark";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !password.trim()) {
      setError("请输入姓名和密码");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "登录失败");
        return;
      }
      window.location.href = "/";
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-enter flex min-h-[calc(100vh-72px)] items-center justify-center bg-[#f7f5ef] px-4 py-8">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-stone-300 bg-white shadow-[0_24px_70px_rgba(21,21,21,0.14)]">
        <div className="bg-[#151515] px-6 py-6 text-white sm:px-8">
          <BrandMark inverse />
          <h1 className="sr-only">广众&众创内部点餐系统</h1>
          <h2 className="mt-8 text-3xl font-black tracking-tight">员工登录</h2>
          <p className="mt-2 text-sm font-bold text-stone-400">输入姓名和公共密码后进入点餐</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6 sm:p-8">
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-black text-stone-800">
              <User size={18} weight="bold" aria-hidden="true" />
              姓名
            </label>
            <input
              type="text"
              value={name}
              data-testid="login-name-input"
              placeholder="请输入你的姓名"
              autoComplete="username"
              onChange={(e) => setName(e.target.value)}
              className="ui-focus min-h-12 w-full rounded-xl border border-stone-300 bg-stone-50 px-4 text-stone-950 placeholder:text-stone-400 focus:border-[#f5c518] focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-black text-stone-800">
              <LockKey size={18} weight="bold" aria-hidden="true" />
              登录密码
            </label>
            <input
              type="password"
              value={password}
              data-testid="login-password-input"
              placeholder="请输入公共密码"
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              className="ui-focus min-h-12 w-full rounded-xl border border-stone-300 bg-stone-50 px-4 text-stone-950 placeholder:text-stone-400 focus:border-[#f5c518] focus:bg-white focus:outline-none"
            />
          </div>

          {error && (
            <p role="alert" className="status-pop rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            data-testid="login-submit"
            disabled={loading || !name.trim() || !password.trim()}
            className="gold-button ui-press ui-focus flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-base font-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <SpinnerGap size={20} weight="bold" className="animate-spin" aria-hidden="true" />
                登录中...
              </>
            ) : (
              <>
                <SignIn size={20} weight="bold" aria-hidden="true" />
                开始点餐
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
