"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  for (let i = 0; i < 6; i++) {
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

  const dateInputRef = useRef<HTMLInputElement>(null);

  const monday = getMondayDate(weekOffset);
  const weekDates = getWeekDates(monday);
  const saturdayDate = weekDates[5];
  const weekLabel = `${weekDates[0]} ~ ${saturdayDate}`;

  function handleDatePick(dateStr: string) {
    const picked = new Date(`${dateStr}T00:00:00.000Z`);
    const pickedDay = picked.getUTCDay();
    const diffToMonday = pickedDay === 0 ? -6 : 1 - pickedDay;
    const pickedMonday = new Date(Date.UTC(picked.getUTCFullYear(), picked.getUTCMonth(), picked.getUTCDate() + diffToMonday));

    const now = new Date();
    const nowDay = now.getUTCDay();
    const nowDiffToMonday = nowDay === 0 ? -6 : 1 - nowDay;
    const currentMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + nowDiffToMonday));

    const diffWeeks = Math.round((pickedMonday.getTime() - currentMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
    setWeekOffset(diffWeeks);
  }

  const fetchMenus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/menus?weekStart=${formatDate(monday)}`, {
        cache: "no-store",
      });
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
            data-testid="admin-password-input"
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
            data-testid="admin-password-submit"
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
    <div className="min-h-screen bg-stone-100/70">
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        <div className="mb-6 rounded-[28px] border border-stone-200 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 px-6 py-5 text-white shadow-lg print:hidden">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold tracking-[0.28em] text-amber-100">MENU BOARD</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">管理菜单</h1>
              <p className="mt-2 text-sm font-medium text-amber-50">
                一页看完周一到周六，截图、打印、发给阿姨都会更清楚。
              </p>
            </div>
            <div className="rounded-3xl bg-white/15 px-5 py-4 text-right backdrop-blur-sm">
              <div className="text-xs font-semibold tracking-[0.24em] text-amber-100">当前周</div>
              <div className="mt-2 text-2xl font-black leading-none">{weekLabel}</div>
            </div>
          </div>
        </div>

        <div className="mb-4 hidden rounded-[24px] border border-stone-300 bg-white px-5 py-4 print:block">
          <div className="text-center">
            <div className="text-xs font-bold tracking-[0.3em] text-stone-500">COMPANY MEAL MENU</div>
            <h1 className="mt-2 text-3xl font-black text-stone-900">食堂周菜单</h1>
            <p className="mt-2 text-base font-semibold text-stone-600">{weekLabel}</p>
          </div>
        </div>

        <div className="mb-6 rounded-[28px] border border-amber-100 bg-white p-4 shadow-md print:hidden">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => setWeekOffset((o) => o - 1)}
                className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-bold text-stone-600 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
              >
                ← 上一周
              </button>
              <span className="flex items-center gap-1 rounded-2xl bg-stone-100 px-4 py-3 text-sm font-bold text-stone-700">
                {weekLabel}
                <button
                  onClick={() => dateInputRef.current?.showPicker()}
                  className="ml-1 rounded-md p-1 text-base transition-colors hover:bg-white"
                  title="选择日期"
                >
                  📅
                </button>
                <input
                  ref={dateInputRef}
                  type="date"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.value) {
                      handleDatePick(e.target.value);
                      e.target.value = "";
                    }
                  }}
                />
              </span>
              <button
                onClick={() => setWeekOffset((o) => o + 1)}
                className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-bold text-stone-600 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
              >
                下一周 →
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 xl:justify-end">
              {weekOffset !== 0 && (
                <button
                  onClick={() => setWeekOffset(0)}
                  className="rounded-xl bg-stone-100 px-4 py-3 text-sm font-bold text-stone-600 transition-colors hover:bg-stone-200"
                >
                  回到本周
                </button>
              )}
              <button
                onClick={copyLastWeek}
                disabled={copyLoading}
                className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-amber-600 disabled:opacity-50"
              >
                {copyLoading ? "复制中..." : "复制上周菜单"}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl bg-stone-900 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-stone-700"
              >
                打印本页
              </button>
            </div>
          </div>
        </div>

        {/* Weekly layout */}
        {loading ? (
          <p className="py-8 text-center text-gray-400">加载中...</p>
        ) : (
          <div className="overflow-x-auto rounded-[32px] border border-stone-300 bg-white shadow-lg print:overflow-visible print:rounded-[24px] print:border-stone-400 print:shadow-none">
            <div
              data-testid="admin-week-grid"
              className="grid min-w-[1180px] grid-cols-[132px_repeat(6,minmax(174px,1fr))] print:min-w-0 print:grid-cols-[110px_repeat(6,minmax(0,1fr))]"
            >
              <div className="border-b border-r border-stone-300 bg-stone-100 px-4 py-5 text-center text-sm font-black tracking-[0.16em] text-stone-700 print:px-2 print:py-4">
                餐次
              </div>
              {weekDates.map((dateStr) => {
                const { dayLabel, shortDate } = formatDateLabel(dateStr);
                return (
                  <div
                    key={`header-${dateStr}`}
                    data-testid={`admin-day-${dateStr}`}
                    className="border-b border-stone-300 bg-stone-50 px-4 py-5 text-center print:px-2 print:py-4"
                  >
                    <div className="text-xl font-black tracking-tight text-stone-900 print:text-lg">{dayLabel}</div>
                    <div className="mt-1 text-sm font-bold text-stone-500 print:text-xs">{shortDate}</div>
                  </div>
                );
              })}

              <div className="border-r border-stone-300 bg-amber-50 px-4 py-8 text-center print:px-2">
                <div className="text-4xl print:text-3xl">🍱</div>
                <div className="mt-3 text-lg font-black text-stone-900 print:text-base">午餐</div>
                <div className="mt-1 text-xs font-bold tracking-[0.2em] text-amber-700">LUNCH</div>
              </div>
              {weekDates.map((dateStr) => (
                <MealSlot
                  key={`lunch-${dateStr}`}
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
              ))}

              <div className="border-r border-t border-stone-300 bg-slate-50 px-4 py-8 text-center print:px-2">
                <div className="text-4xl print:text-3xl">🌙</div>
                <div className="mt-3 text-lg font-black text-stone-900 print:text-base">晚餐</div>
                <div className="mt-1 text-xs font-bold tracking-[0.2em] text-slate-600">DINNER</div>
              </div>
              {weekDates.map((dateStr) => (
                <MealSlot
                  key={`dinner-${dateStr}`}
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
              ))}
            </div>
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
  date,
  mealType,
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
      <div
        data-testid={`meal-slot-${date}-${mealType}`}
        className="min-h-[220px] border-r border-t border-stone-300 bg-white p-4 print:min-h-[180px] print:p-3"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-black tracking-[0.08em] text-stone-700">
            {emoji} {label}
          </div>
          <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
            正在编辑
          </div>
        </div>
        <textarea
          value={editValue}
          data-testid={`meal-editor-${date}-${mealType}`}
          onChange={(e) => onEditValueChange(e.target.value)}
          className="min-h-[110px] w-full rounded-2xl border border-stone-300 bg-stone-50 p-3 text-sm leading-7 text-stone-700 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 print:min-h-[90px] print:text-xs"
          rows={4}
          placeholder="输入菜品，如：红烧肉、清炒时蔬、番茄蛋汤"
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={onSave}
            data-testid={`meal-save-${date}-${mealType}`}
            disabled={saving || !editValue.trim()}
            className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
          <button
            onClick={onCancel}
            className="rounded-xl bg-stone-200 px-4 py-2 text-xs font-bold text-stone-700 transition-colors hover:bg-stone-300"
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid={`meal-slot-${date}-${mealType}`}
      className="group flex min-h-[220px] cursor-pointer flex-col justify-between border-r border-t border-stone-300 bg-white p-4 transition-colors hover:bg-amber-50/40 print:min-h-[180px] print:p-3"
      onClick={onStartEdit}
    >
      <div className="flex-1">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-black tracking-[0.08em] text-stone-700">
            {emoji} {label}
          </div>
          {menu && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="rounded-xl px-3 py-1.5 text-xs font-bold text-red-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 print:hidden"
            >
              删除
            </button>
          )}
        </div>
        {menu ? (
          <p
            data-testid={`meal-dishes-${date}-${mealType}`}
            className="whitespace-pre-wrap text-[15px] leading-8 text-stone-700 print:text-xs print:leading-6"
          >
            {menu.dishes}
          </p>
        ) : (
          <div className="flex h-full min-h-[96px] items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-stone-50 text-center text-sm font-semibold text-stone-400 print:min-h-[80px] print:text-xs">
            点击添加菜单
          </div>
        )}
      </div>
      <div className="mt-4 text-xs font-bold tracking-[0.12em] text-amber-700 print:hidden">
        点击本格即可编辑
      </div>
    </div>
  );
}
