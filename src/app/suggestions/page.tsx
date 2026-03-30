"use client";

import { useState, useEffect, useCallback } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface Suggestion {
  id: number;
  content: string;
  createdAt: string;
  isMine: boolean;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const past = new Date(dateStr).getTime();
  const diff = now - past;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

export default function SuggestionsPage() {
  const { user } = useCurrentUser();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await fetch("/api/suggestions");
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch {
      setSuggestions([]);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  async function handleSubmit() {
    if (!content.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "提交失败");
        return;
      }
      setContent("");
      fetchSuggestions();
    } catch {
      setError("提交失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch("/api/suggestions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        fetchSuggestions();
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50">
      <main className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-amber-800">
            📝 建议专区
          </h1>
          <p className="mt-2 text-amber-600">
            前台匿名展示，后台会保留提交记录
          </p>
        </div>

        {/* Input area */}
        {user ? (
          <div className="mb-8 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex gap-3">
              <input
                type="text"
                value={content}
                data-testid="suggestion-input"
                onChange={(e) => setContent(e.target.value)}
                placeholder="匿名提建议，比如：想吃糖醋排骨"
                maxLength={100}
                className="flex-1 rounded-xl border border-amber-200 px-4 py-3 text-gray-800 placeholder-gray-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !submitting) handleSubmit();
                }}
              />
              <button
                onClick={handleSubmit}
                data-testid="suggestion-submit"
                disabled={submitting || !content.trim()}
                className="rounded-xl bg-amber-500 px-6 py-3 font-medium text-white hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "提交中..." : "匿名提交"}
              </button>
            </div>
            <div className="mt-2 flex justify-between text-xs text-gray-400">
              <span>{error && <span className="text-red-500">{error}</span>}</span>
              <span>{content.length}/100</span>
            </div>
          </div>
        ) : (
          <div className="mb-8 rounded-2xl bg-white p-6 text-center shadow-sm">
            <p className="text-gray-500">登录后可以匿名提交建议哦 🔑</p>
          </div>
        )}

        {/* Suggestions list */}
        {suggestions.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
            <p className="text-lg text-gray-400">
              还没有建议，快来第一个提交吧！
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((s) => (
              <div
                key={s.id}
                data-testid={`suggestion-item-${s.id}`}
                className="flex items-center justify-between rounded-2xl bg-white px-5 py-4 shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">
                    匿
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-800 font-medium truncate">
                      {s.content}
                    </p>
                    <p className="text-xs text-gray-400">
                      匿名同事 · {timeAgo(s.createdAt)}
                    </p>
                  </div>
                </div>
                {user && s.isMine && (
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="ml-3 shrink-0 rounded-lg px-3 py-1 text-xs text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    删除
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
