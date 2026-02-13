"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface Menu {
  id: number;
  date: string;
  mealType: string;
  dishes: string;
}

const DAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function getMondayDate(offset: number): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMonday + offset * 7)
  );
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getWeekDates(monday: Date): string[] {
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + i));
    dates.push(formatDate(d));
  }
  return dates;
}

function formatDateLabel(dateStr: string): { dayLabel: string; shortDate: string } {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const dayLabel = DAY_LABELS[d.getUTCDay()];
  const shortDate = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  return { dayLabel, shortDate };
}

export default function AdminPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const router = useRouter();
  const [weekOffset, setWeekOffset] = useState(0);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);

  // Admin password verification state
  const [adminVerified, setAdminVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const monday = getMondayDate(weekOffset);
  const weekDates = getWeekDates(monday);
  const sundayDate = weekDates[6];
  const weekLabel = `${weekDates[0]} ~ ${sundayDate}`;

  const fetchMenus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/menus?weekStart=${formatDate(monday)}`);
      const data = await res.json();
      setMenus(data.menus || []);
    } catch {
      setMenus([]);
    } finally {
      setLoading(false);
    }
  }, [weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check admin verification status on load
  useEffect(() => {
    if (user) {
      fetch("/api/admin/verify")
        .then((r) => r.json())
        .then((data) => {
          if (data.verified) {
            setAdminVerified(true);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/login");
      return;
    }
    if (user && adminVerified) {
      fetchMenus();
    }
  }, [user, userLoading, router, fetchMenus, adminVerified]);

  const handleVerifyPassword = async () => {
    setVerifying(true);
    setVerifyError("");
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAdminVerified(true);
      } else {
        setVerifyError(data.error || "验证失败");
      }
    } catch {
      setVerifyError("验证失败");
    } finally {
      setVerifying(false);
    }
  };

  const getMenu = (date: string, mealType: string) =>
    menus.find((m) => m.date === date && m.mealType === mealType);

  const editKey = (date: string, mealType: string) => `${date}-${mealType}`;

  const startEdit = (date: string, mealType: string) => {
    const menu = getMenu(date, mealType);
    setEditingKey(editKey(date, mealType));
    setEditValue(menu?.dishes || "");
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
  };

  const saveMenu = async (date: string, mealType: string) => {
    if (!editValue.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/admin/menus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, mealType, dishes: editValue.trim() }),
      });
      await fetchMenus();
      setEditingKey(null);
      setEditValue("");
    } catch {
      alert("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const deleteMenu = async (date: string, mealType: string) => {
    if (!confirm("确定删除该菜单？")) return;
    try {
      await fetch("/api/admin/menus", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, mealType }),
      });
      await fetchMenus();
    } catch {
      alert("删除失败");
    }
  };

  const copyLastWeek = async () => {
    setCopyLoading(true);
    try {
      const lastMonday = getMondayDate(weekOffset - 1);
      const res = await fetch(`/api/admin/menus?weekStart=${formatDate(lastMonday)}`);
      const data = await res.json();
      const lastMenus: Menu[] = data.menus || [];
      if (lastMenus.length === 0) {
        alert("上周没有菜单可复制");
        return;
      }
      const lastWeekDates = getWeekDates(lastMonday);
      for (const m of lastMenus) {
        const dayIndex = lastWeekDates.indexOf(m.date);
        if (dayIndex === -1) continue;
        const newDate = weekDates[dayIndex];
        await fetch("/api/admin/menus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: newDate, mealType: m.mealType, dishes: m.dishes }),
        });
      }
      await fetchMenus();
      alert("复制成功！");
    } catch {
      alert("复制失败");
    } finally {
      setCopyLoading(false);
    }
  };

  if (userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-orange-50/30">
        <p className="text-gray-400">加载中...</p>
      </div>
    );
  }

  if (!user) return null;

  if (!adminVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-orange-50/30">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg border border-orange-100">
          <h2 className="mb-6 text-center text-xl font-bold text-gray-800">
            🔒 管理员验证
          </h2>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && password && !verifying) {
                handleVerifyPassword();
              }
            }}
            placeholder="请输入管理员密码"
            className="mb-4 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-700 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          {verifyError && (
            <p className="mb-4 text-center text-sm text-red-500">{verifyError}</p>
          )}
          <button
            onClick={handleVerifyPassword}
            disabled={verifying || !password}
            className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-medium text-white shadow-md hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            {verifying ? "验证中..." : "确认"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-orange-50/30">
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        {/* Week selector */}
        <div className="mb-6 flex items-center justify-between rounded-2xl bg-white p-4 shadow-md border border-orange-100">
          <button
            onClick={() => setWeekOffset((o) => o - 1)}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-amber-50 hover:text-amber-700 transition-colors"
          >
            ← 上一周
          </button>
          <span className="text-sm font-semibold text-gray-700">{weekLabel}</span>
          <button
            onClick={() => setWeekOffset((o) => o + 1)}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-amber-50 hover:text-amber-700 transition-colors"
          >
            下一周 →
          </button>
        </div>

        {/* Copy last week button */}
        <div className="mb-6 flex justify-end">
          <button
            onClick={copyLastWeek}
            disabled={copyLoading}
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-md hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            {copyLoading ? "复制中..." : "📋 复制上周菜单"}
          </button>
        </div>

        {/* Day cards */}
        {loading ? (
          <p className="text-center text-gray-400 py-8">加载中...</p>
        ) : (
          <div className="space-y-4">
            {weekDates.map((dateStr) => {
              const { dayLabel, shortDate } = formatDateLabel(dateStr);
              return (
                <div
                  key={dateStr}
                  className="rounded-2xl bg-white p-5 shadow-md border border-orange-100"
                >
                  <h3 className="mb-3 text-lg font-bold text-gray-800">
                    {dayLabel} <span className="text-sm font-normal text-gray-500">{shortDate}</span>
                  </h3>
                  <div className="space-y-3">
                    <MealSlot
                      emoji="🍱"
                      label="午餐"
                      date={dateStr}
                      mealType="lunch"
                      menu={getMenu(dateStr, "lunch")}
                      isEditing={editingKey === editKey(dateStr, "lunch")}
                      editValue={editValue}
                      saving={saving}
                      onEditValueChange={setEditValue}
                      onStartEdit={() => startEdit(dateStr, "lunch")}
                      onSave={() => saveMenu(dateStr, "lunch")}
                      onCancel={cancelEdit}
                      onDelete={() => deleteMenu(dateStr, "lunch")}
                    />
                    <MealSlot
                      emoji="🌙"
                      label="晚餐"
                      date={dateStr}
                      mealType="dinner"
                      menu={getMenu(dateStr, "dinner")}
                      isEditing={editingKey === editKey(dateStr, "dinner")}
                      editValue={editValue}
                      saving={saving}
                      onEditValueChange={setEditValue}
                      onStartEdit={() => startEdit(dateStr, "dinner")}
                      onSave={() => saveMenu(dateStr, "dinner")}
                      onCancel={cancelEdit}
                      onDelete={() => deleteMenu(dateStr, "dinner")}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}



interface MealSlotProps {
  emoji: string;
  label: string;
  date: string;
  mealType: string;
  menu: Menu | undefined;
  isEditing: boolean;
  editValue: string;
  saving: boolean;
  onEditValueChange: (v: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

function MealSlot({
  emoji,
  label,
  menu,
  isEditing,
  editValue,
  saving,
  onEditValueChange,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
}: MealSlotProps) {
  if (isEditing) {
    return (
      <div className="rounded-xl bg-orange-50 p-3">
        <div className="mb-2 text-sm font-medium text-gray-700">
          {emoji} {label}
        </div>
        <textarea
          value={editValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-700 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          rows={3}
          placeholder="输入菜品，如：红烧肉、清炒时蔬、番茄蛋汤"
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={onSave}
            disabled={saving || !editValue.trim()}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            {saving ? "保存中..." : "保存"}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-300 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group flex items-start justify-between rounded-xl bg-orange-50 p-3 cursor-pointer hover:bg-orange-100/70 transition-colors"
      onClick={onStartEdit}
    >
      <div className="flex-1">
        <div className="mb-1 text-sm font-medium text-gray-700">
          {emoji} {label}
        </div>
        {menu ? (
          <p className="text-sm leading-relaxed text-gray-600">{menu.dishes}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">点击添加菜单</p>
        )}
      </div>
      {menu && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="ml-2 rounded-lg px-2 py-1 text-xs text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all"
        >
          删除
        </button>
      )}
    </div>
  );
}