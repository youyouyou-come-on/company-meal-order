"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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

type MealType = "lunch" | "dinner";
type SignupMap = Record<string, Signup[]>;

const DAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function getWeekDates(weekOffset: number): string[] {
  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + diffToMonday + weekOffset * 7
    )
  );

  const dates: string[] = [];
  for (let i = 0; i < 6; i++) {
    const date = new Date(
      Date.UTC(
        monday.getUTCFullYear(),
        monday.getUTCMonth(),
        monday.getUTCDate() + i
      )
    );
    dates.push(date.toISOString().split("T")[0]);
  }
  return dates;
}

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDateLabel(dateStr: string): { dayLabel: string; shortDate: string } {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  return {
    dayLabel: DAY_LABELS[date.getUTCDay()],
    shortDate: `${date.getUTCMonth() + 1}/${date.getUTCDate()}`,
  };
}

function isExpiredClient(dateStr: string, mealType: MealType): boolean {
  const now = new Date();
  const todayUTC = now.toISOString().split("T")[0];
  if (dateStr < todayUTC) return true;
  if (dateStr > todayUTC) return false;
  const cutoffHour = mealType === "lunch" ? 10 : 15;
  const chinaHour = (now.getUTCHours() + 8) % 24 + now.getUTCMinutes() / 60;
  return chinaHour >= cutoffHour;
}

function slotKey(date: string, mealType: MealType) {
  return `${date}-${mealType}`;
}

export default function Home() {
  const { user, loading: userLoading } = useCurrentUser();
  const router = useRouter();
  const today = getTodayStr();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(today);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [signupsBySlot, setSignupsBySlot] = useState<SignupMap>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const signupRequestVersionRef = useRef<Record<string, number>>({});

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekStart = weekDates[0];

  useEffect(() => {
    fetch(`/api/menus/week?weekStart=${weekStart}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setMenus(data.menus || []))
      .catch(() => setMenus([]));
  }, [weekStart]);

  const fetchSignupsForDate = useCallback(async (date: string) => {
    const requestVersion = (signupRequestVersionRef.current[date] || 0) + 1;
    signupRequestVersionRef.current[date] = requestVersion;

    try {
      const [lunchRes, dinnerRes] = await Promise.all([
        fetch(`/api/signups?date=${date}&mealType=lunch`, { cache: "no-store" }),
        fetch(`/api/signups?date=${date}&mealType=dinner`, { cache: "no-store" }),
      ]);
      const lunchData = await lunchRes.json();
      const dinnerData = await dinnerRes.json();

      if (signupRequestVersionRef.current[date] !== requestVersion) {
        return;
      }

      setSignupsBySlot((current) => ({
        ...current,
        [slotKey(date, "lunch")]: lunchData.signups || [],
        [slotKey(date, "dinner")]: dinnerData.signups || [],
      }));
    } catch {
      if (signupRequestVersionRef.current[date] !== requestVersion) {
        return;
      }

      setSignupsBySlot((current) => ({
        ...current,
        [slotKey(date, "lunch")]: [],
        [slotKey(date, "dinner")]: [],
      }));
    }
  }, []);

  useEffect(() => {
    setSignupsBySlot({});
    Promise.all(weekDates.map((date) => fetchSignupsForDate(date))).catch(() => {});
  }, [fetchSignupsForDate, weekDates]);

  useEffect(() => {
    setSelectedDate((current) => {
      if (weekDates.includes(current)) return current;
      if (weekDates.includes(today)) return today;
      return weekStart;
    });
  }, [today, weekDates, weekStart]);

  const handleSignup = async (date: string, mealType: MealType) => {
    const loadingKey = slotKey(date, mealType);
    setActionLoading(loadingKey);
    try {
      const response = await fetch("/api/signups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, mealType }),
      });

      if (!response.ok) {
        await fetchSignupsForDate(date);
        return;
      }

      await fetchSignupsForDate(date);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (date: string, mealType: MealType) => {
    const loadingKey = slotKey(date, mealType);
    setActionLoading(loadingKey);
    try {
      const response = await fetch("/api/signups", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, mealType }),
      });

      if (!response.ok) {
        await fetchSignupsForDate(date);
        return;
      }

      await fetchSignupsForDate(date);
    } finally {
      setActionLoading(null);
    }
  };

  const getMenu = (date: string, mealType: MealType) =>
    menus.find((menu) => menu.date === date && menu.mealType === mealType);

  const getSignups = (date: string, mealType: MealType) =>
    signupsBySlot[slotKey(date, mealType)] || [];

  const selectedDateLabel = formatDateLabel(selectedDate);
  const selectedTotal =
    getSignups(selectedDate, "lunch").length + getSignups(selectedDate, "dinner").length;

  const chinaHour = (new Date().getUTCHours() + 8) % 24;
  let greeting = "";
  if (chinaHour < 11) greeting = "早上好 ☀️";
  else if (chinaHour < 14) greeting = "中午好 🌤️";
  else if (chinaHour < 18) greeting = "下午好 🌅";
  else greeting = "晚上好 🌙";

  return (
    <div className="min-h-screen bg-orange-50/30 print:bg-white">
      <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6 print:max-w-none print:px-3 print:py-3">
        <div className="mb-4 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 px-5 py-4 text-white shadow-md print:shadow-none">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-2xl font-bold">
                {user ? `${greeting}，${user.name}！` : `${greeting}，欢迎来到公司食堂 🍽️`}
              </div>
              <p className="mt-1 text-sm text-amber-50">
                先选周几，再点当天午餐和晚餐，页面会更清爽。
              </p>
            </div>
            <div className="hidden rounded-2xl bg-white/15 px-4 py-3 text-right sm:block">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100">
                当前日期
              </div>
              <div className="mt-1 text-3xl font-extrabold leading-none">
                {selectedDateLabel.dayLabel}
              </div>
              <div className="mt-1 text-sm font-semibold text-amber-50">
                {selectedDateLabel.shortDate}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-5 rounded-2xl bg-white p-3 shadow-sm border border-orange-100 print:shadow-none">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className={`rounded-xl px-4 py-3 text-base font-bold transition-all ${
                weekOffset === 0
                  ? "bg-amber-500 text-white shadow-md"
                  : "bg-orange-50 text-amber-700 hover:bg-amber-100"
              }`}
            >
              本周点餐
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset(1)}
              className={`rounded-xl px-4 py-3 text-base font-bold transition-all ${
                weekOffset === 1
                  ? "bg-amber-500 text-white shadow-md"
                  : "bg-orange-50 text-amber-700 hover:bg-amber-100"
              }`}
            >
              下周点餐
            </button>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 print:grid-cols-3">
          {weekDates.map((date) => {
            const { dayLabel, shortDate } = formatDateLabel(date);
            const isToday = date === today;
            const isSelected = date === selectedDate;
            return (
              <button
                type="button"
                key={date}
                data-testid={`home-day-tab-${date}`}
                onClick={() => setSelectedDate(date)}
                className={`rounded-2xl border px-3 py-3 text-center shadow-sm transition-all print:shadow-none ${
                  isSelected
                    ? "border-amber-500 bg-amber-500 text-white"
                    : isToday
                      ? "border-amber-400 bg-amber-100"
                      : "border-orange-100 bg-white"
                }`}
              >
                <div className={`text-sm font-bold ${isSelected ? "text-white" : "text-gray-700"}`}>{dayLabel}</div>
                <div className={`mt-1 text-2xl font-extrabold leading-none ${isSelected ? "text-white" : "text-gray-900"}`}>{shortDate}</div>
                <div className="mt-2">
                  {isSelected ? (
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold text-white">
                      已选择
                    </span>
                  ) : isToday ? (
                    <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                      今天
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-gray-400">可点餐日</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <section
          data-testid={`home-selected-day-${selectedDate}`}
          className="rounded-3xl border border-orange-100 bg-white p-4 shadow-md print:break-inside-avoid print:shadow-none"
        >
          <div className="mb-4 flex items-center justify-between border-b border-orange-100 pb-3">
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900">
                {selectedDateLabel.dayLabel}
              </h2>
              <p className="text-sm font-medium text-gray-500">{selectedDateLabel.shortDate}</p>
            </div>
            <div className="rounded-2xl bg-orange-50 px-3 py-2 text-right">
              <div className="text-xs font-semibold tracking-wide text-amber-700">
                当天合计
              </div>
              <div className="text-4xl font-extrabold leading-none text-amber-600">
                {selectedTotal}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <MealBlock
              date={selectedDate}
              emoji="🍱"
              title="午餐"
              testId={`home-meal-${selectedDate}-lunch`}
              cutoffText="截止 10:00"
              menu={getMenu(selectedDate, "lunch")}
              signups={getSignups(selectedDate, "lunch")}
              isSignedUp={user ? getSignups(selectedDate, "lunch").some((signup) => signup.userName === user.name) : false}
              isExpired={isExpiredClient(selectedDate, "lunch")}
              user={user}
              userLoading={userLoading}
              loading={actionLoading === slotKey(selectedDate, "lunch")}
              onSignup={() => handleSignup(selectedDate, "lunch")}
              onCancel={() => handleCancel(selectedDate, "lunch")}
              onLogin={() => router.push("/login")}
            />
            <MealBlock
              date={selectedDate}
              emoji="🌙"
              title="晚餐"
              testId={`home-meal-${selectedDate}-dinner`}
              cutoffText="截止 15:00"
              menu={getMenu(selectedDate, "dinner")}
              signups={getSignups(selectedDate, "dinner")}
              isSignedUp={user ? getSignups(selectedDate, "dinner").some((signup) => signup.userName === user.name) : false}
              isExpired={isExpiredClient(selectedDate, "dinner")}
              user={user}
              userLoading={userLoading}
              loading={actionLoading === slotKey(selectedDate, "dinner")}
              onSignup={() => handleSignup(selectedDate, "dinner")}
              onCancel={() => handleCancel(selectedDate, "dinner")}
              onLogin={() => router.push("/login")}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

interface MealBlockProps {
  date: string;
  emoji: string;
  title: string;
  testId: string;
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

function MealBlock({
  date,
  emoji,
  title,
  testId,
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
}: MealBlockProps) {
  const signupCount = signups.length;
  const statusNote = userLoading
    ? "正在读取你的点餐状态。"
    : !user
      ? "登录后才能报名或取消。"
      : isSignedUp && isExpired
        ? "你已经报名，但当前餐次已截止，不能再取消。"
        : isExpired
          ? "当前餐次已经截止，不能再报名。"
          : isSignedUp
            ? "如果临时不吃了，可以点“不吃了”取消。"
            : "现在点“吃”，截止前都还能改回“不吃了”。";

  return (
    <div data-testid={testId} className="rounded-2xl border border-orange-100 bg-orange-50/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-extrabold text-gray-900">
            {emoji} {title}
          </h3>
          <p className="mt-1 text-sm font-semibold text-amber-700">{cutoffText}</p>
        </div>
        <div className="min-w-[100px] rounded-2xl bg-amber-500 px-3 py-3 text-center text-white">
          <div className="text-xs font-semibold tracking-wide text-amber-100">吃饭人数</div>
          <div className="text-4xl font-extrabold leading-none">{signupCount}</div>
        </div>
      </div>

      {menu ? (
        <div data-testid={`${testId}-dishes`} className="mb-3 rounded-2xl bg-white p-3 text-sm leading-6 text-gray-700">
          {menu.dishes}
        </div>
      ) : (
        <div className="mb-3 rounded-2xl bg-white p-3 text-sm text-gray-400">暂无菜单</div>
      )}

      <div className="mb-3">
        {userLoading ? (
          <button
            disabled
            className="w-full rounded-2xl bg-gray-200 py-3 text-base font-bold text-gray-400"
          >
            加载中...
          </button>
        ) : !user ? (
          <button
            onClick={onLogin}
            className="w-full rounded-2xl bg-gray-300 py-3 text-base font-bold text-gray-600 transition-colors hover:bg-gray-400 hover:text-white"
          >
            请先登录
          </button>
        ) : isSignedUp && isExpired ? (
          <button
            disabled
            className="w-full rounded-2xl border border-amber-200 bg-amber-50 py-3 text-base font-bold text-amber-700"
          >
            已报名（已截止）
          </button>
        ) : isExpired ? (
          <button
            disabled
            className="w-full rounded-2xl bg-gray-200 py-3 text-base font-bold text-gray-400"
          >
            已截止
          </button>
        ) : isSignedUp ? (
          <button
            onClick={onCancel}
            disabled={loading}
            className="w-full rounded-2xl border border-red-200 bg-red-50 py-3 text-base font-bold text-red-500 transition-colors hover:bg-red-100 disabled:opacity-50"
          >
            {loading ? "取消中..." : "😴 不吃了"}
          </button>
        ) : (
          <button
            onClick={onSignup}
            disabled={loading}
            className="w-full rounded-2xl bg-green-500 py-3 text-base font-bold text-white transition-colors hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? "报名中..." : "🍽️ 吃"}
          </button>
        )}
        <p
          data-testid={`${testId}-status-note`}
          className="mt-2 text-center text-xs font-medium leading-5 text-gray-500"
        >
          {statusNote}
        </p>
      </div>

      <div className="rounded-2xl bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-700">已报名名单</span>
          <span className="text-sm font-bold text-amber-600">{signupCount} 人</span>
        </div>
        {signups.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {signups.map((signup) => (
              <span
                key={`${date}-${title}-${signup.id}`}
                className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800"
              >
                {signup.userName}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">还没有人报名</p>
        )}
      </div>
    </div>
  );
}
