"use client";

import { useState, useEffect, useRef, FormEvent } from "react";

interface UserOption {
  id: number;
  name: string;
}

export default function LoginPage() {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedName, setSelectedName] = useState("");
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/auth/users");
        const data = await res.json();
        setUsers(data.users ?? []);
      } catch {
        setError("获取用户列表失败");
      } finally {
        setLoadingUsers(false);
      }
    }
    fetchUsers();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  function selectUser(name: string) {
    setSelectedName(name);
    setSearch(name);
    setShowDropdown(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedName) {
      setError("请选择姓名");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selectedName }),
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
        {/* Logo area */}
        <div className="mb-6 text-center">
          <div className="text-5xl mb-3">🍽️</div>
          <h1 className="text-2xl font-bold text-gray-800">公司点餐系统</h1>
          <p className="mt-1 text-sm text-amber-600">选择你的名字，开始点餐吧~</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Searchable user selector */}
          <div ref={dropdownRef} className="relative">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              🔍 搜索并选择姓名
            </label>
            <input
              type="text"
              value={search}
              data-testid="user-search-input"
              placeholder={loadingUsers ? "加载中..." : "输入姓名搜索..."}
              disabled={loadingUsers}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedName("");
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              className="w-full rounded-xl border border-orange-200 bg-orange-50/50 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 transition-colors"
            />
            {showDropdown && !loadingUsers && (
              <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-orange-200 bg-white shadow-lg">
                {filteredUsers.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-400">
                    没有找到匹配的人
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      data-testid={`user-option-${user.id}`}
                      onClick={() => selectUser(user.name)}
                      className={`w-full px-4 py-2.5 text-left text-sm hover:bg-amber-50 transition-colors ${
                        selectedName === user.name
                          ? "bg-amber-100 text-amber-800 font-medium"
                          : "text-gray-700"
                      }`}
                    >
                      {user.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected indicator */}
          {selectedName && (
            <div className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-2 text-sm text-green-700 border border-green-200">
              <span>✅</span>
              <span>已选择：<strong>{selectedName}</strong></span>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{error}</p>
          )}

          <button
            type="submit"
            data-testid="login-submit"
            disabled={loading || loadingUsers || !selectedName}
            className="w-full rounded-xl bg-amber-500 px-4 py-3 text-white font-bold text-base hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {loading ? "登录中..." : "🍚 开始点餐"}
          </button>
        </form>
      </div>
    </div>
  );
}
