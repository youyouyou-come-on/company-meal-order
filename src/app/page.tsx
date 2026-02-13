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

interface Signup {
  id: number;
  userName: string;
}

const DAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function getWeekDates(): string[] {
  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMonday)
  );
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + i));
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDateLabel(dateStr: string): { dayLabel: string; shortDate: string } {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const dayLabel = DAY_LABELS[d.getUTCDay()];
  const shortDate = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  return { dayLabel, shortDate };
}

function isExpiredClient(dateStr: string, mealType: string): boolean {
  const now = new Date();
  const todayUTC = now.toISOString().split("T")[0];
  if (dateStr < todayUTC) return true;
  if (dateStr > todayUTC) return false;
  const cutoffHour = mealType === "lunch" ? 10 : 15;
  const chinaHour = (now.getUTCHours() + 8) % 24 + now.getUTCMinutes() / 60;
  return chinaHour >= cutoffHour;
}

export default function Home() {
  const { user, loading: userLoading } = useCurrentUser();
  const router = useRouter();
  const weekDates = getWeekDates();
  const today = getTodayStr();
  const [selectedDate, setSelectedDate] = useState(today);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [lunchSignups, setLunchSignups] = useState<Signup[]>([]);
  const [dinnerSignups, setDinnerSignups] = useState<Signup[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch week menus
  useEffect(() => {
    fetch("/api/menus/week")
      .then((r) => r.json())
      .then((data) => setMenus(data.menus || []))
      .catch(() => setMenus([]));
  }, []);

  // Fetch signups for selected date
  const fetchSignups = useCallback(async (date: string) => {
    try {
      const [lunchRes, dinnerRes] = await Promise.all([
        fetch(`/api/signups?date=${date}&mealType=lunch`),
        fetch(`/api/signups?date=${date}&mealType=dinner`),
      ]);
      const lunchData = await lunchRes.json();
      const dinnerData = await dinnerRes.json();
      setLunchSignups(lunchData.signups || []);
      setDinnerSignups(dinnerData.signups || []);
    } catch {
      setLunchSignups([]);
      setDinnerSignups([]);
    }
  }, []);

  useEffect(() => {
    fetchSignups(selectedDate);
  }, [selectedDate, fetchSignups]);

  const handleSignup = async (mealType: string) => {
    setActionLoading(mealType);
    try {
      const res = await fetch("/api/signups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, mealType }),
      });
      if (res.ok) {
        await fetchSignups(selectedDate);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (mealType: string) => {
    setActionLoading(mealType);
    try {
      const res = await fetch("/api/signups", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, mealType }),
      });
      if (res.ok) {
        await fetchSignups(selectedDate);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const lunchMenu = menus.find((m) => m.date === selectedDate && m.mealType === "lunch");
  const dinnerMenu = menus.find((m) => m.date === selectedDate && m.mealType === "dinner");

  const isUserSignedUp = (signups: Signup[]) =>
    user ? signups.some((s) => s.userName === user.name) : false;

  const chinaHour = (new Date().getUTCHours() + 8) % 24;
  let greeting = '';
  if (chinaHour < 11) greeting = '早上好 ☀️';
  else if (chinaHour < 14) greeting = '中午好 🌤️';
  else if (chinaHour < 18) greeting = '下午好 🌅';
  else greeting = '晚上好 🌙';

  return (
    <div className="min-h-screen bg-orange-50/30">
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        {/* Welcome area */}
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 p-5 text-white shadow-md">
          <div className="text-2xl font-bold">
            {user ? `${greeting}，${user.name}！` : `${greeting}，欢迎来到公司食堂 🍽️`}
          </div>
          {user && (
            <p className="mt-1 text-amber-50 text-sm">今天想吃点什么？</p>
          )}
          <div className="mt-2 text-lg opacity-80">🍚 🥗 🍜 🥘 🍲</div>
        </div>

        {/* Date tabs */}
        <div className="mb-6 overflow-x-auto">
          <div className="flex gap-2 min-w-max pb-2">
            {weekDates.map((dateStr) => {
              const { dayLabel, shortDate } = formatDateLabel(dateStr);
              const isToday = dateStr === today;
              const isPast = dateStr < today;
              const isSelected = dateStr === selectedDate;
              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`flex flex-col items-center rounded-xl px-4 py-2 text-sm font-medium transition-all min-w-[64px] ${
                    isSelected
                      ? "bg-amber-500 text-white shadow-md"
                      : isPast
                        ? "bg-gray-100 text-gray-400"
                        : isToday
                          ? "bg-amber-100 text-amber-700 ring-2 ring-amber-300"
                          : "bg-white text-gray-600 hover:bg-amber-50"
                  }`}
                >
                  <span className="text-xs">{dayLabel}</span>
                  <span className="text-base font-bold">{shortDate}</span>
                  {isToday && (
                    <span className={`text-[10px] font-bold mt-0.5 ${isSelected ? 'text-amber-100' : 'text-amber-500'}`}>
                      今天
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Meal cards */}
        {selectedDate === today && (
          <h2 className="mb-4 text-xl font-bold text-gray-800">📢 今日菜单</h2>
        )}
        <div className="space-y-4">
          <MealCard
            emoji="🍱"
            title="午餐"
            cutoffText="截止 10:00"
            menu={lunchMenu}
            signups={lunchSignups}
            isSignedUp={isUserSignedUp(lunchSignups)}
            isExpired={isExpiredClient(selectedDate, "lunch")}
            user={user}
            userLoading={userLoading}
            loading={actionLoading === "lunch"}
            onSignup={() => handleSignup("lunch")}
            onCancel={() => handleCancel("lunch")}
            onLogin={() => router.push("/login")}
          />
          <MealCard
            emoji="🌙"
            title="晚餐"
            cutoffText="截止 15:00"
            menu={dinnerMenu}
            signups={dinnerSignups}
            isSignedUp={isUserSignedUp(dinnerSignups)}
            isExpired={isExpiredClient(selectedDate, "dinner")}
            user={user}
            userLoading={userLoading}
            loading={actionLoading === "dinner"}
            onSignup={() => handleSignup("dinner")}
            onCancel={() => handleCancel("dinner")}
            onLogin={() => router.push("/login")}
          />
        </div>

        <div className="mt-8 text-center text-sm text-gray-400 pb-4">
          好好吃饭，认真工作 💪
        </div>
      </main>
    </div>
  );
}

interface MealCardProps {
  emoji: string;
  title: string;
  cutoffText: string;
  menu: Menu | undefined;
  signups: Signup[];
  isSignedUp: boolean;
  isExpired: boolean;
  user: { id: number; name: string } | null;
  userLoading: boolean;
  loading: boolean;
  onSignup: () => void;
  onCancel: () => void;
  onLogin: () => void;
}

function MealCard({
  emoji,
  title,
  cutoffText,
  menu,
  signups,
  isSignedUp,
  isExpired,
  user,
  userLoading,
  loading,
  onSignup,
  onCancel,
  onLogin,
}: MealCardProps) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-md border border-orange-100">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">
          {emoji} {title}
        </h2>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">
          ⏰ {cutoffText}
        </span>
      </div>

      {/* Menu content */}
      {menu ? (
        <div className="mb-4 rounded-xl bg-orange-50 p-3 flex flex-wrap gap-1">
          {menu.dishes.split(/[、，,]/).filter(Boolean).map((dish, i) => (
            <span key={i} className="inline-block rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-800 border border-amber-200">
              {dish.trim()}
            </span>
          ))}
        </div>
      ) : (
        <p className="mb-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-400">
          暂无菜单
        </p>
      )}

      {/* Action button */}
      <div className="mb-4">
        {userLoading ? (
          <button
            disabled
            className="w-full rounded-xl bg-gray-200 py-3 text-base font-medium text-gray-400"
          >
            加载中...
          </button>
        ) : !user ? (
          <button
            onClick={onLogin}
            className="w-full rounded-xl bg-gray-300 py-3 text-base font-medium text-gray-500 hover:bg-gray-400 hover:text-white transition-colors"
          >
            请先登录
          </button>
        ) : isExpired ? (
          <button
            disabled
            className="w-full rounded-xl bg-gray-200 py-3 text-base font-medium text-gray-400 cursor-not-allowed"
          >
            已截止
          </button>
        ) : isSignedUp ? (
          <button
            onClick={onCancel}
            disabled={loading}
            className="w-full rounded-xl bg-red-50 py-3 text-base font-bold text-red-500 hover:bg-red-100 transition-colors border border-red-200 disabled:opacity-50"
          >
            {loading ? "取消中..." : "😴 不吃了"}
          </button>
        ) : (
          <button
            onClick={onSignup}
            disabled={loading}
            className="w-full rounded-xl bg-green-500 py-3 text-base font-bold text-white hover:bg-green-600 transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? "报名中..." : "🍽️ 吃"}
          </button>
        )}
      </div>

      {/* Signup list */}
      <div className="rounded-xl bg-gray-50 p-3">
        <p className="text-sm font-medium text-gray-600 mb-2">
          👥 已报名 ({signups.length}人)
        </p>
        {signups.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {signups.map((s) => (
              <div key={s.id} className="flex flex-col items-center">
                <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-sm font-bold text-amber-700">
                  {s.userName.charAt(0)}
                </div>
                <span className="text-xs text-gray-500 mt-1">{s.userName}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">还没有人报名哦~</p>
        )}
      </div>
    </div>
  );
}
