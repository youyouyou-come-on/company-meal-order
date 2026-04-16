"use client";

import { useState, FormEvent } from "react";

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
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg border border-orange-100">
        <div className="mb-6 text-center">
          <div className="text-5xl mb-3">🍽️</div>
          <h1 className="text-2xl font-bold text-gray-800">公司点餐系统</h1>
          <p className="mt-1 text-sm text-amber-600">输入姓名和公共密码后进入点餐</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              👤 姓名
            </label>
            <input
              type="text"
              value={name}
              data-testid="login-name-input"
              placeholder="请输入你的姓名"
              autoComplete="username"
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-orange-200 bg-orange-50/50 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 transition-colors"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              🔐 登录密码
            </label>
            <input
              type="password"
              value={password}
              data-testid="login-password-input"
              placeholder="请输入公共密码"
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-orange-200 bg-orange-50/50 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 transition-colors"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{error}</p>
          )}

          <button
            type="submit"
            data-testid="login-submit"
            disabled={loading || !name.trim() || !password.trim()}
            className="w-full rounded-xl bg-amber-500 px-4 py-3 text-white font-bold text-base hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {loading ? "登录中..." : "🍚 开始点餐"}
          </button>
        </form>
      </div>
    </div>
  );
}
