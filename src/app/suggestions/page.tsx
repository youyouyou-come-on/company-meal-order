"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Lightbulb, PaperPlaneTilt, SpinnerGap, Trash } from "@phosphor-icons/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface Suggestion {
  id: number;
  content: string;
  createdAt: string;
  authorName: string;
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
  const { user, loading: userLoading } = useCurrentUser();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
    if (user) {
      void fetchSuggestions();
    } else if (!userLoading) {
      setSuggestions([]);
    }
  }, [fetchSuggestions, user, userLoading]);

  async function handleSubmit() {
    if (!content.trim()) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
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
      setSuccess("建议已提交");
      await fetchSuggestions();
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
    <div className="min-h-screen bg-[#f7f5ef]">
      <main className="page-enter mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 rounded-2xl bg-[#151515] px-6 py-6 text-white shadow-xl sm:px-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f5c518] text-[#151515]">
            <Lightbulb size={27} weight="fill" aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-tight">建议专区</h1>
          <p className="mt-2 text-sm font-bold text-stone-400">
            实名提出建议，让每条反馈都更清楚
          </p>
        </div>

        {userLoading ? (
          <div className="surface-card mb-6 rounded-2xl p-6 text-center">
            <p className="flex items-center justify-center gap-2 text-sm font-bold text-stone-500">
              <SpinnerGap size={19} weight="bold" className="animate-spin" aria-hidden="true" />
              正在确认登录状态...
            </p>
          </div>
        ) : user ? (
          <div className="surface-card mb-6 rounded-2xl p-5 sm:p-6">
            <p className="mb-3 text-sm font-black text-[#6e5500]">
              将以“{user.name}”的姓名提交
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={content}
                data-testid="suggestion-input"
                onChange={(e) => setContent(e.target.value)}
                placeholder="实名提建议，比如：想吃糖醋排骨"
                maxLength={100}
                className="ui-focus min-h-12 min-w-0 flex-1 rounded-xl border border-stone-300 bg-stone-50 px-4 font-bold text-stone-900 placeholder:text-stone-400 focus:border-[#f5c518] focus:bg-white focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !submitting) handleSubmit();
                }}
              />
              <button
                onClick={handleSubmit}
                data-testid="suggestion-submit"
                disabled={submitting || !content.trim()}
                className="gold-button ui-press ui-focus flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 font-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <SpinnerGap size={19} weight="bold" className="animate-spin" aria-hidden="true" />
                    提交中...
                  </>
                ) : (
                  <>
                    <PaperPlaneTilt size={19} weight="bold" aria-hidden="true" />
                    提交建议
                  </>
                )}
              </button>
            </div>
            <div className="mt-3 flex justify-between text-xs font-bold text-stone-400">
              <span>
                {error ? <span role="alert" className="text-red-600">{error}</span> : null}
                {success ? <span role="status" className="status-pop text-[#16855b]">{success}</span> : null}
              </span>
              <span>{content.length}/100</span>
            </div>
          </div>
        ) : (
          <div
            data-testid="suggestion-login-required"
            className="surface-card mb-6 rounded-2xl p-8 text-center"
          >
            <p className="font-black text-stone-800">建议专区仅限登录员工查看和实名提交</p>
            <Link
              href="/login"
              className="gold-button ui-press ui-focus mt-4 inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-black"
            >
              去登录
            </Link>
          </div>
        )}

        {!userLoading && user && suggestions.length === 0 ? (
          <div className="surface-card rounded-2xl p-12 text-center">
            <p className="text-lg font-bold text-stone-400">
              还没有建议，快来第一个提交吧！
            </p>
          </div>
        ) : user ? (
          <div className="overflow-hidden rounded-2xl border border-stone-300 bg-white shadow-[0_12px_30px_rgba(21,21,21,0.08)]">
            {suggestions.map((s) => (
              <div
                key={s.id}
                data-testid={`suggestion-item-${s.id}`}
                className="flex items-center justify-between border-b border-stone-200 px-5 py-4 last:border-b-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#151515] text-sm font-black text-[#f5c518]">
                    {Array.from(s.authorName)[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-stone-900">
                      {s.content}
                    </p>
                    <p className="mt-1 text-xs font-bold text-stone-400">
                      {s.authorName} · {timeAgo(s.createdAt)}
                    </p>
                  </div>
                </div>
                {user && s.isMine && (
                  <button
                    onClick={() => handleDelete(s.id)}
                    aria-label={`删除${s.authorName}的建议`}
                    className="danger-button ui-press ui-focus ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  >
                    <Trash size={18} weight="bold" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </main>
    </div>
  );
}
