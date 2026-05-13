"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  formatDateLabel,
  getChinaHourInteger,
  getChinaTodayString,
  getChinaWeekDates,
  isMealExpired,
  type MealType,
} from "@/lib/china-date";

interface Menu {
  id: number;
  date: string;
  mealType: string;
  dishes: string;
}

interface Signup {
  id: number;
  userName: string;
  quantity: number;
}

type SignupMap = Record<string, Signup[]>;
type QuantityDraftMap = Record<string, number>;
type SummaryModalState = {
  mealType: MealType;
  title: string;
} | null;

const MIN_MEAL_QUANTITY = 1;
const MAX_MEAL_QUANTITY = 20;

function getWeekDates(weekOffset: number): string[] {
  return getChinaWeekDates(weekOffset);
}

function getTodayStr(): string {
  return getChinaTodayString();
}

function isExpiredClient(dateStr: string, mealType: MealType): boolean {
  return isMealExpired(dateStr, mealType);
}

function isDayExpired(dateStr: string) {
  return isExpiredClient(dateStr, "dinner");
}

function slotKey(date: string, mealType: MealType) {
  return `${date}-${mealType}`;
}

function clampMealQuantity(value: number) {
  if (!Number.isFinite(value)) {
    return MIN_MEAL_QUANTITY;
  }

  return Math.min(MAX_MEAL_QUANTITY, Math.max(MIN_MEAL_QUANTITY, Math.trunc(value)));
}

function getSignupQuantity(signups: Signup[], userName?: string | null) {
  if (!userName) {
    return 0;
  }

  return signups.find((signup) => signup.userName === userName)?.quantity ?? 0;
}

function getInitialDraftQuantity(signups: Signup[], userName?: string | null) {
  const quantity = getSignupQuantity(signups, userName);
  return quantity > 0 ? quantity : MIN_MEAL_QUANTITY;
}

export default function Home() {
  const { user, loading: userLoading } = useCurrentUser();
  const router = useRouter();
  const today = getTodayStr();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(today);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [signupsBySlot, setSignupsBySlot] = useState<SignupMap>({});
  const [quantityDrafts, setQuantityDrafts] = useState<QuantityDraftMap>({});
  const [summaryModal, setSummaryModal] = useState<SummaryModalState>(null);
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

      const lunchSignups = lunchData.signups || [];
      const dinnerSignups = dinnerData.signups || [];

      setSignupsBySlot((current) => ({
        ...current,
        [slotKey(date, "lunch")]: lunchSignups,
        [slotKey(date, "dinner")]: dinnerSignups,
      }));
      setQuantityDrafts((current) => ({
        ...current,
        [slotKey(date, "lunch")]: getInitialDraftQuantity(lunchSignups, user?.name),
        [slotKey(date, "dinner")]: getInitialDraftQuantity(dinnerSignups, user?.name),
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
      setQuantityDrafts((current) => ({
        ...current,
        [slotKey(date, "lunch")]: MIN_MEAL_QUANTITY,
        [slotKey(date, "dinner")]: MIN_MEAL_QUANTITY,
      }));
    }
  }, [user?.name]);

  useEffect(() => {
    setSignupsBySlot({});
    setQuantityDrafts({});
    Promise.all(weekDates.map((date) => fetchSignupsForDate(date))).catch(() => {});
  }, [fetchSignupsForDate, weekDates]);

  useEffect(() => {
    setSelectedDate((current) => {
      if (weekDates.includes(current)) return current;
      if (weekDates.includes(today)) return today;
      return weekStart;
    });
  }, [today, weekDates, weekStart]);

  const getMenu = (date: string, mealType: MealType) =>
    menus.find((menu) => menu.date === date && menu.mealType === mealType);

  const getSignups = (date: string, mealType: MealType) =>
    signupsBySlot[slotKey(date, mealType)] || [];

  const getUserQuantity = (date: string, mealType: MealType) =>
    getSignupQuantity(getSignups(date, mealType), user?.name);

  const getDraftQuantity = (date: string, mealType: MealType) =>
    quantityDrafts[slotKey(date, mealType)] ??
    getInitialDraftQuantity(getSignups(date, mealType), user?.name);

  const updateDraftQuantity = (date: string, mealType: MealType, nextQuantity: number) => {
    setQuantityDrafts((current) => ({
      ...current,
      [slotKey(date, mealType)]: clampMealQuantity(nextQuantity),
    }));
  };

  const handleConfirmQuantity = async (date: string, mealType: MealType) => {
    const loadingKey = slotKey(date, mealType);
    const quantity = getDraftQuantity(date, mealType);
    setActionLoading(loadingKey);
    try {
      const response = await fetch("/api/signups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, mealType, quantity }),
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

      updateDraftQuantity(date, mealType, MIN_MEAL_QUANTITY);
      await fetchSignupsForDate(date);
    } finally {
      setActionLoading(null);
    }
  };

  const selectedDateLabel = formatDateLabel(selectedDate);
  const selectedLunchTotal = getSignups(selectedDate, "lunch").reduce(
    (sum, signup) => sum + signup.quantity,
    0
  );
  const selectedDinnerTotal = getSignups(selectedDate, "dinner").reduce(
    (sum, signup) => sum + signup.quantity,
    0
  );

  const chinaHour = getChinaHourInteger();
  let greeting = "";
  if (chinaHour < 11) greeting = "早上好 ☀️";
  else if (chinaHour < 14) greeting = "中午好 🌤️";
  else if (chinaHour < 18) greeting = "下午好 🌅";
  else greeting = "晚上好 🌙";

  const summaryModalSignups = summaryModal
    ? getSignups(selectedDate, summaryModal.mealType)
    : [];

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
            const isExpiredDay = isDayExpired(date);
            return (
              <button
                type="button"
                key={date}
                data-testid={`home-day-tab-${date}`}
                onClick={() => setSelectedDate(date)}
                className={`rounded-2xl border px-3 py-3 text-center shadow-sm transition-all print:shadow-none ${
                  isSelected
                    ? "border-amber-500 bg-amber-500 text-white"
                    : isExpiredDay
                      ? "border-gray-200 bg-gray-100 text-gray-400"
                      : isToday
                      ? "border-amber-400 bg-amber-100"
                      : "border-orange-100 bg-white"
                }`}
              >
                <div
                  className={`text-sm font-bold ${
                    isSelected ? "text-white" : isExpiredDay ? "text-gray-500" : "text-gray-700"
                  }`}
                >
                  {dayLabel}
                </div>
                <div
                  className={`mt-1 text-2xl font-extrabold leading-none ${
                    isSelected ? "text-white" : isExpiredDay ? "text-gray-600" : "text-gray-900"
                  }`}
                >
                  {shortDate}
                </div>
                <div className="mt-2">
                  {isSelected ? (
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold text-white">
                      已选择
                    </span>
                  ) : isExpiredDay ? (
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-bold text-gray-600">
                      已过期
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
          <div className="mb-4 border-b border-orange-100 pb-3">
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900">
                {selectedDateLabel.dayLabel}
              </h2>
              <p className="text-sm font-medium text-gray-500">{selectedDateLabel.shortDate}</p>
            </div>
          </div>

          <div
            data-testid={`home-selected-day-summary-${selectedDate}`}
            className="mb-4 grid gap-3 sm:grid-cols-2"
          >
            <button
              type="button"
              data-testid={`home-selected-day-summary-${selectedDate}-lunch`}
              onClick={() => setSummaryModal({ mealType: "lunch", title: "午餐" })}
              className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-left transition-colors hover:bg-orange-100"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold tracking-wide text-amber-700">午餐总份数</div>
                <span className="text-xs font-medium text-gray-400">点击查看名单</span>
              </div>
              <div className="mt-1 text-3xl font-extrabold leading-none text-gray-900">
                {selectedLunchTotal}
              </div>
            </button>
            <button
              type="button"
              data-testid={`home-selected-day-summary-${selectedDate}-dinner`}
              onClick={() => setSummaryModal({ mealType: "dinner", title: "晚餐" })}
              className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-left transition-colors hover:bg-orange-100"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold tracking-wide text-amber-700">晚餐总份数</div>
                <span className="text-xs font-medium text-gray-400">点击查看名单</span>
              </div>
              <div className="mt-1 text-3xl font-extrabold leading-none text-gray-900">
                {selectedDinnerTotal}
              </div>
            </button>
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
              currentUserQuantity={getUserQuantity(selectedDate, "lunch")}
              draftQuantity={getDraftQuantity(selectedDate, "lunch")}
              isExpired={isExpiredClient(selectedDate, "lunch")}
              user={user}
              userLoading={userLoading}
              loading={actionLoading === slotKey(selectedDate, "lunch")}
              onDraftQuantityChange={(quantity) => updateDraftQuantity(selectedDate, "lunch", quantity)}
              onConfirmQuantity={() => handleConfirmQuantity(selectedDate, "lunch")}
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
              currentUserQuantity={getUserQuantity(selectedDate, "dinner")}
              draftQuantity={getDraftQuantity(selectedDate, "dinner")}
              isExpired={isExpiredClient(selectedDate, "dinner")}
              user={user}
              userLoading={userLoading}
              loading={actionLoading === slotKey(selectedDate, "dinner")}
              onDraftQuantityChange={(quantity) => updateDraftQuantity(selectedDate, "dinner", quantity)}
              onConfirmQuantity={() => handleConfirmQuantity(selectedDate, "dinner")}
              onCancel={() => handleCancel(selectedDate, "dinner")}
              onLogin={() => router.push("/login")}
            />
          </div>
        </section>
      </main>

      {summaryModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/45 px-4"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="summary-modal-title"
            data-testid="home-summary-modal"
            className="w-full max-w-md rounded-3xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-orange-100 px-5 py-4">
              <div>
                <h3
                  id="summary-modal-title"
                  className="text-xl font-extrabold text-gray-900"
                >
                  {summaryModal.title}点餐名单
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedDateLabel.dayLabel} {selectedDateLabel.shortDate}
                </p>
              </div>
              <button
                type="button"
                data-testid="home-summary-modal-close"
                onClick={() => setSummaryModal(null)}
                className="rounded-full bg-orange-50 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-orange-100"
              >
                关闭
              </button>
            </div>

            <div
              data-testid="home-summary-modal-list"
              className="max-h-[60vh] overflow-y-auto px-5 py-4"
            >
              {summaryModalSignups.length > 0 ? (
                <div className="space-y-3">
                  {summaryModalSignups.map((signup) => (
                    <div
                      key={`summary-${selectedDate}-${summaryModal.mealType}-${signup.id}`}
                      className="flex items-center justify-between rounded-2xl border border-orange-100 bg-orange-50/60 px-4 py-3"
                    >
                      <span className="font-semibold text-gray-900">{signup.userName}</span>
                      <span className="text-sm font-bold text-amber-700">{signup.quantity} 份</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-gray-400">还没有人点餐</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
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
  currentUserQuantity: number;
  draftQuantity: number;
  isExpired: boolean;
  user: { id: number; name: string } | null;
  userLoading: boolean;
  loading: boolean;
  onDraftQuantityChange: (quantity: number) => void;
  onConfirmQuantity: () => void;
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
  currentUserQuantity,
  draftQuantity,
  isExpired,
  user,
  userLoading,
  loading,
  onDraftQuantityChange,
  onConfirmQuantity,
  onCancel,
  onLogin,
}: MealBlockProps) {
  const totalQuantity = signups.reduce((sum, signup) => sum + signup.quantity, 0);
  const hasSignup = currentUserQuantity > 0;
  const isQuantityChanged = draftQuantity !== currentUserQuantity;
  const statusNote = userLoading
    ? "正在读取你的点餐状态。"
    : !user
      ? "登录后才能点餐或取消。"
      : hasSignup && isExpired
        ? `你已点 ${currentUserQuantity} 份，但当前餐次已截止，不能再修改。`
        : isExpired
          ? "当前餐次已经截止，不能再点餐。"
        : hasSignup
            ? `你当前已点 ${currentUserQuantity} 份，如有客人可以直接调整份数。`
            : "请选择 1 份或多份，确认后就会计入当前餐次。";

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
          <div className="text-xs font-semibold tracking-wide text-amber-100">本餐总份数</div>
          <div
            data-testid={`${testId}-total-quantity`}
            className="text-4xl font-extrabold leading-none"
          >
            {totalQuantity}
          </div>
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
        ) : hasSignup && isExpired ? (
          <button
            disabled
            className="w-full rounded-2xl border border-amber-200 bg-amber-50 py-3 text-base font-bold text-amber-700"
          >
            已点 {currentUserQuantity} 份（已截止）
          </button>
        ) : isExpired ? (
          <button
            disabled
            className="w-full rounded-2xl bg-gray-200 py-3 text-base font-bold text-gray-400"
          >
            已截止
          </button>
        ) : (
          <div className="rounded-2xl bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-gray-700">点餐份数</div>
                <p className="mt-1 text-xs text-gray-500">支持帮来访客人一起代点</p>
              </div>
              {hasSignup ? (
                <div className="text-right text-xs font-semibold text-amber-600">
                  你已点 {currentUserQuantity} 份
                </div>
              ) : null}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                data-testid={`${testId}-quantity-minus`}
                onClick={() => onDraftQuantityChange(draftQuantity - 1)}
                disabled={loading || draftQuantity <= MIN_MEAL_QUANTITY}
                className="h-11 w-11 rounded-2xl border border-orange-200 bg-orange-50 text-2xl font-bold text-amber-700 transition-colors hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                -
              </button>
              <input
                type="number"
                min={MIN_MEAL_QUANTITY}
                max={MAX_MEAL_QUANTITY}
                inputMode="numeric"
                data-testid={`${testId}-quantity-input`}
                value={draftQuantity}
                onChange={(event) => onDraftQuantityChange(Number.parseInt(event.target.value || "1", 10))}
                className="h-11 flex-1 rounded-2xl border border-orange-200 bg-orange-50 px-4 text-center text-lg font-bold text-gray-900 outline-none transition-colors focus:border-amber-400 focus:bg-white"
              />
              <button
                type="button"
                data-testid={`${testId}-quantity-plus`}
                onClick={() => onDraftQuantityChange(draftQuantity + 1)}
                disabled={loading || draftQuantity >= MAX_MEAL_QUANTITY}
                className="h-11 w-11 rounded-2xl border border-orange-200 bg-orange-50 text-2xl font-bold text-amber-700 transition-colors hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                +
              </button>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                data-testid={`${testId}-confirm`}
                onClick={onConfirmQuantity}
                disabled={loading || (hasSignup && !isQuantityChanged)}
                className="rounded-2xl bg-green-500 py-3 text-base font-bold text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-green-300"
              >
                {loading
                  ? hasSignup
                    ? "更新中..."
                    : "点餐中..."
                  : hasSignup
                    ? isQuantityChanged
                      ? `更新为 ${draftQuantity} 份`
                      : `已点 ${currentUserQuantity} 份`
                    : `确认 ${draftQuantity} 份`}
              </button>
              {hasSignup ? (
                <button
                  type="button"
                  data-testid={`${testId}-cancel`}
                  onClick={onCancel}
                  disabled={loading}
                  className="rounded-2xl border border-red-200 bg-red-50 py-3 text-base font-bold text-red-500 transition-colors hover:bg-red-100 disabled:opacity-50"
                >
                  😴 不吃了
                </button>
              ) : null}
            </div>
          </div>
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
          <span className="text-sm font-bold text-gray-700">本餐点餐明细</span>
          <span className="text-sm font-bold text-amber-600">{totalQuantity} 份</span>
        </div>
        {signups.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {signups.map((signup) => (
              <span
                key={`${date}-${title}-${signup.id}`}
                className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800"
              >
                {signup.quantity > 1 ? `${signup.userName} × ${signup.quantity}` : signup.userName}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">还没有人点餐</p>
        )}
      </div>
    </div>
  );
}
