"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  BowlFood,
  CheckCircle,
  Clock,
  Minus,
  MoonStars,
  Plus,
  SpinnerGap,
  Users,
  X,
} from "@phosphor-icons/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  businessDateToUtcDate,
  formatDateLabel,
  getChinaHourInteger,
  getChinaTodayString,
  getChinaWeekDates,
  getOrderableDates,
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
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const signupRequestVersionRef = useRef<Record<string, number>>({});
  const summaryButtonRefs = useRef<Record<MealType, HTMLButtonElement | null>>({
    lunch: null,
    dinner: null,
  });
  const summaryCloseRef = useRef<HTMLButtonElement | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekStart = weekDates[0];
  const orderableDates = useMemo(() => getOrderableDates(businessDateToUtcDate(today)), [today]);

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

  useEffect(() => {
    if (!summaryModal) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    summaryCloseRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const trigger = summaryButtonRefs.current[summaryModal.mealType];
        setSummaryModal(null);
        requestAnimationFrame(() => trigger?.focus());
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [summaryModal]);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

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
      setActionSuccess(loadingKey);
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = setTimeout(() => setActionSuccess(null), 1200);
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
  if (chinaHour < 11) greeting = "早上好";
  else if (chinaHour < 14) greeting = "中午好";
  else if (chinaHour < 18) greeting = "下午好";
  else greeting = "晚上好";

  const summaryModalSignups = summaryModal
    ? getSignups(selectedDate, summaryModal.mealType)
    : [];
  const isSelectedDateOrderable = orderableDates.includes(selectedDate);

  const closeSummaryModal = () => {
    if (!summaryModal) return;
    const trigger = summaryButtonRefs.current[summaryModal.mealType];
    setSummaryModal(null);
    requestAnimationFrame(() => trigger?.focus());
  };

  return (
    <div className="min-h-screen bg-[#f7f5ef] pb-8 print:bg-white">
      <main className="page-enter mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6 print:max-w-none print:px-3 print:py-3">
        <div className="mb-4 flex items-center justify-between gap-4 px-1 lg:hidden">
          <div>
            <div className="text-sm font-bold text-stone-500">{greeting}</div>
            <div className="mt-0.5 text-xl font-black text-stone-950">
              {user ? `${user.name}，你好` : "欢迎来到公司食堂"}
            </div>
          </div>
          <div className="rounded-xl bg-[#151515] px-3 py-2 text-right text-white">
            <div className="text-[10px] font-bold tracking-[0.16em] text-stone-500">当前选择</div>
            <div className="mt-0.5 text-sm font-black text-[#f5c518]">
              {selectedDateLabel.dayLabel} {selectedDateLabel.shortDate}
            </div>
          </div>
        </div>

        <div className="surface-card mb-3 rounded-2xl p-2 print:shadow-none">
          <div className="grid grid-cols-2 gap-2">
            {[0, 1].map((offset) => {
              const active = weekOffset === offset;
              return (
                <button
                  key={offset}
                  type="button"
                  onClick={() => setWeekOffset(offset)}
                  aria-pressed={active}
                  className={`ui-press ui-focus min-h-12 rounded-xl px-4 text-sm font-black sm:text-base ${
                    active
                      ? "gold-button shadow-none"
                      : "border border-transparent bg-white text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  {offset === 0 ? "本周点餐" : "下周点餐"}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-4 overflow-hidden border-y border-stone-300 bg-white sm:rounded-2xl sm:border">
          <div className="grid grid-cols-6 divide-x divide-stone-200">
            {weekDates.map((date) => {
              const { dayLabel, shortDate } = formatDateLabel(date);
              const isToday = date === today;
              const isSelected = date === selectedDate;
              const isExpiredDay = isDayExpired(date);
              const isOrderableDay = orderableDates.includes(date);
              const status = isSelected
                ? "已选择"
                : isExpiredDay
                  ? "已过期"
                  : isToday
                    ? "今天"
                    : isOrderableDay
                      ? "可点餐"
                      : "查看菜单";

              return (
                <button
                  type="button"
                  key={date}
                  data-testid={`home-day-tab-${date}`}
                  onClick={() => setSelectedDate(date)}
                  aria-pressed={isSelected}
                  className={`ui-press ui-focus min-w-0 px-1 py-3 text-center sm:px-3 sm:py-4 ${
                    isSelected
                      ? "bg-[#151515] text-white"
                      : isExpiredDay
                        ? "bg-stone-100 text-stone-400"
                        : "bg-white text-stone-900 hover:bg-stone-50"
                  }`}
                >
                  <div className={`text-xs font-black sm:text-sm ${isSelected ? "text-[#f5c518]" : ""}`}>
                    {dayLabel}
                  </div>
                  <div className="mt-1 text-lg font-black leading-none sm:text-2xl">{shortDate}</div>
                  <div
                    className={`mt-2 truncate text-[9px] font-bold sm:text-xs ${
                      isSelected
                        ? "text-[#f5c518]"
                        : isOrderableDay && !isExpiredDay
                          ? "text-[#6e5500]"
                          : "text-stone-500"
                    }`}
                  >
                    {status}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <section
          key={selectedDate}
          data-testid={`home-selected-day-${selectedDate}`}
          className="content-swap overflow-hidden rounded-2xl border border-stone-300 bg-white shadow-[0_16px_40px_rgba(21,21,21,0.08)] print:break-inside-avoid print:shadow-none"
        >
          <div className="flex flex-col gap-4 border-b border-stone-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-end gap-3">
              <h2 className="text-3xl font-black tracking-tight text-stone-950">{selectedDateLabel.dayLabel}</h2>
              <p className="pb-1 text-sm font-bold text-stone-500">{selectedDateLabel.shortDate}</p>
            </div>
            <div
              data-testid={`home-selected-day-summary-${selectedDate}`}
              className="grid grid-cols-2 gap-2 sm:flex"
            >
              {([
                ["lunch", "午餐", selectedLunchTotal],
                ["dinner", "晚餐", selectedDinnerTotal],
              ] as const).map(([mealType, label, total]) => (
                <button
                  key={mealType}
                  ref={(node) => {
                    summaryButtonRefs.current[mealType] = node;
                  }}
                  type="button"
                  data-testid={`home-selected-day-summary-${selectedDate}-${mealType}`}
                  onClick={() => setSummaryModal({ mealType, title: label })}
                  className="ui-press ui-focus flex min-h-11 items-center justify-between gap-4 rounded-xl border border-stone-200 bg-stone-50 px-3 text-left hover:border-[#f5c518] hover:bg-[#fff9dc] sm:min-w-36"
                >
                  <span className="text-xs font-bold text-stone-500">{label}总份数</span>
                  <span className="text-xl font-black text-stone-950">{total}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-stone-200">
            <div className="border-b border-stone-200 lg:border-b-0">
              <MealBlock
                date={selectedDate}
                mealType="lunch"
                title="午餐"
                testId={`home-meal-${selectedDate}-lunch`}
                cutoffText="截止 10:00"
                menu={getMenu(selectedDate, "lunch")}
                signups={getSignups(selectedDate, "lunch")}
                currentUserQuantity={getUserQuantity(selectedDate, "lunch")}
                draftQuantity={getDraftQuantity(selectedDate, "lunch")}
                isExpired={isExpiredClient(selectedDate, "lunch")}
                isOrderable={isSelectedDateOrderable}
                user={user}
                userLoading={userLoading}
                loading={actionLoading === slotKey(selectedDate, "lunch")}
                success={actionSuccess === slotKey(selectedDate, "lunch")}
                onDraftQuantityChange={(quantity) => updateDraftQuantity(selectedDate, "lunch", quantity)}
                onConfirmQuantity={() => handleConfirmQuantity(selectedDate, "lunch")}
                onCancel={() => handleCancel(selectedDate, "lunch")}
                onLogin={() => router.push("/login")}
              />
            </div>
            <div>
              <MealBlock
                date={selectedDate}
                mealType="dinner"
                title="晚餐"
                testId={`home-meal-${selectedDate}-dinner`}
                cutoffText="截止 15:30"
                menu={getMenu(selectedDate, "dinner")}
                signups={getSignups(selectedDate, "dinner")}
                currentUserQuantity={getUserQuantity(selectedDate, "dinner")}
                draftQuantity={getDraftQuantity(selectedDate, "dinner")}
                isExpired={isExpiredClient(selectedDate, "dinner")}
                isOrderable={isSelectedDateOrderable}
                user={user}
                userLoading={userLoading}
                loading={actionLoading === slotKey(selectedDate, "dinner")}
                success={actionSuccess === slotKey(selectedDate, "dinner")}
                onDraftQuantityChange={(quantity) => updateDraftQuantity(selectedDate, "dinner", quantity)}
                onConfirmQuantity={() => handleConfirmQuantity(selectedDate, "dinner")}
                onCancel={() => handleCancel(selectedDate, "dinner")}
                onLogin={() => router.push("/login")}
              />
            </div>
          </div>
        </section>
      </main>

      {summaryModal ? (
        <div
          className="modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-4"
          onClick={closeSummaryModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="summary-modal-title"
            data-testid="home-summary-modal"
            className="modal-panel w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#1d1d1b] text-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h3 id="summary-modal-title" className="text-xl font-black">
                  {summaryModal.title}点餐名单
                </h3>
                <p className="mt-1 text-sm font-bold text-stone-400">
                  {selectedDateLabel.dayLabel} {selectedDateLabel.shortDate}
                </p>
              </div>
              <button
                ref={summaryCloseRef}
                type="button"
                aria-label="关闭点餐名单"
                data-testid="home-summary-modal-close"
                onClick={closeSummaryModal}
                className="ui-press ui-focus flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-stone-300 hover:bg-white/10"
              >
                <X size={22} weight="bold" aria-hidden="true" />
              </button>
            </div>

            <div data-testid="home-summary-modal-list" className="max-h-[60vh] overflow-y-auto px-5 py-4">
              {summaryModalSignups.length > 0 ? (
                <div className="divide-y divide-white/10">
                  {summaryModalSignups.map((signup) => (
                    <div
                      key={`summary-${selectedDate}-${summaryModal.mealType}-${signup.id}`}
                      className="flex min-h-12 items-center justify-between py-3"
                    >
                      <span className="font-bold text-white">{signup.userName}</span>
                      <span className="rounded-lg bg-[#f5c518] px-2.5 py-1 text-sm font-black text-[#151515]">
                        {signup.quantity} 份
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-10 text-center text-sm font-bold text-stone-500">还没有人点餐</p>
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
  mealType: MealType;
  title: string;
  testId: string;
  cutoffText: string;
  menu: Menu | undefined;
  signups: Signup[];
  currentUserQuantity: number;
  draftQuantity: number;
  isExpired: boolean;
  isOrderable: boolean;
  user: { id: number; name: string } | null;
  userLoading: boolean;
  loading: boolean;
  success: boolean;
  onDraftQuantityChange: (quantity: number) => void;
  onConfirmQuantity: () => void;
  onCancel: () => void;
  onLogin: () => void;
}

function MealBlock({
  date,
  mealType,
  title,
  testId,
  cutoffText,
  menu,
  signups,
  currentUserQuantity,
  draftQuantity,
  isExpired,
  isOrderable,
  user,
  userLoading,
  loading,
  success,
  onDraftQuantityChange,
  onConfirmQuantity,
  onCancel,
  onLogin,
}: MealBlockProps) {
  const totalQuantity = signups.reduce((sum, signup) => sum + signup.quantity, 0);
  const hasSignup = currentUserQuantity > 0;
  const isQuantityChanged = draftQuantity !== currentUserQuantity;
  const MealIcon = mealType === "lunch" ? BowlFood : MoonStars;
  const statusNote = userLoading
    ? "正在读取你的点餐状态。"
    : !user
      ? "登录后才能点餐或取消。"
      : !isOrderable && hasSignup
        ? `你已点 ${currentUserQuantity} 份，但当前日期暂未开放修改。`
      : !isOrderable
        ? "当前日期仅开放查看菜单，暂不允许提交点餐。"
      : hasSignup && isExpired
        ? `你已点 ${currentUserQuantity} 份，但当前餐次已截止，不能再修改。`
        : isExpired
          ? "当前餐次已经截止，不能再点餐。"
        : hasSignup
            ? `你当前已点 ${currentUserQuantity} 份，如有客人可以直接调整份数。`
            : "请选择 1 份或多份，确认后就会计入当前餐次。";

  return (
    <div data-testid={testId} className="p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#151515] text-[#f5c518]">
            <MealIcon size={24} weight="fill" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-xl font-black text-stone-950">{title}</h3>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-black text-[#866800]">
              <Clock size={16} weight="bold" aria-hidden="true" />
              {cutoffText}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-bold tracking-[0.08em] text-stone-500">本餐总份数</div>
          <div data-testid={`${testId}-total-quantity`} className="mt-1 text-3xl font-black leading-none text-stone-950">
            {totalQuantity}
          </div>
        </div>
      </div>

      {menu ? (
        <div
          data-testid={`${testId}-dishes`}
          className="mb-4 border-y border-stone-200 py-4 text-base font-bold leading-7 text-stone-800"
        >
          {menu.dishes}
        </div>
      ) : (
        <div className="mb-4 border-y border-dashed border-stone-300 py-4 text-sm font-bold text-stone-400">
          暂无菜单
        </div>
      )}

      <div className="mb-4">
        {userLoading ? (
          <button
            disabled
            className="min-h-12 w-full rounded-xl bg-stone-200 text-base font-black text-stone-400"
          >
            加载中...
          </button>
        ) : !user ? (
          <button
            onClick={onLogin}
            className="ink-button ui-press ui-focus min-h-12 w-full rounded-xl text-base font-black"
          >
            请先登录
          </button>
        ) : !isOrderable ? (
          <button
            disabled
            className="min-h-12 w-full rounded-xl bg-stone-200 text-base font-black text-stone-500"
          >
            暂未开放点餐
          </button>
        ) : hasSignup && isExpired ? (
          <button
            disabled
            className="min-h-12 w-full rounded-xl border border-[#f5c518] bg-[#fff9dc] text-base font-black text-[#6e5500]"
          >
            已点 {currentUserQuantity} 份（已截止）
          </button>
        ) : isExpired ? (
          <button
            disabled
            className="min-h-12 w-full rounded-xl bg-stone-200 text-base font-black text-stone-500"
          >
            已截止
          </button>
        ) : (
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black text-stone-800">点餐份数</div>
                <p className="mt-1 text-xs font-bold text-stone-500">支持帮来访客人一起代点</p>
              </div>
              {hasSignup ? (
                <div className="text-right text-xs font-black text-[#16855b]">
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
                aria-label="减少一份"
                className="ui-press ui-focus flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-stone-300 bg-white text-stone-950 hover:border-[#f5c518] hover:bg-[#fff9dc] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Minus size={22} weight="bold" aria-hidden="true" />
              </button>
              <input
                type="number"
                min={MIN_MEAL_QUANTITY}
                max={MAX_MEAL_QUANTITY}
                inputMode="numeric"
                data-testid={`${testId}-quantity-input`}
                value={draftQuantity}
                onChange={(event) => onDraftQuantityChange(Number.parseInt(event.target.value || "1", 10))}
                aria-label={`${title}点餐份数`}
                className="ui-focus h-12 min-w-0 flex-1 rounded-xl border border-stone-300 bg-stone-50 px-4 text-center text-xl font-black text-stone-950 outline-none transition-colors focus:border-[#f5c518] focus:bg-white"
              />
              <button
                type="button"
                data-testid={`${testId}-quantity-plus`}
                onClick={() => onDraftQuantityChange(draftQuantity + 1)}
                disabled={loading || draftQuantity >= MAX_MEAL_QUANTITY}
                aria-label="增加一份"
                className="ui-press ui-focus flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#f5c518] bg-[#f5c518] text-stone-950 hover:bg-[#ffd327] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus size={22} weight="bold" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                data-testid={`${testId}-confirm`}
                onClick={onConfirmQuantity}
                disabled={loading || (hasSignup && !isQuantityChanged)}
                className={`ui-press ui-focus flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-black disabled:cursor-not-allowed disabled:opacity-60 ${
                  success || (hasSignup && !isQuantityChanged) ? "ink-button text-[#6ee7ad]" : "gold-button"
                }`}
              >
                {loading ? (
                  <>
                    <SpinnerGap size={20} weight="bold" className="animate-spin" aria-hidden="true" />
                    {hasSignup ? "更新中..." : "点餐中..."}
                  </>
                ) : success || (hasSignup && !isQuantityChanged) ? (
                  <>
                    <CheckCircle size={20} weight="fill" aria-hidden="true" />
                    已点 {currentUserQuantity} 份
                  </>
                ) : hasSignup ? (
                  `更新为 ${draftQuantity} 份`
                ) : (
                  `确认 ${draftQuantity} 份`
                )}
              </button>
              {hasSignup ? (
                <button
                  type="button"
                  data-testid={`${testId}-cancel`}
                  onClick={onCancel}
                  disabled={loading}
                  className="danger-button ui-press ui-focus min-h-12 rounded-xl px-4 text-base font-black disabled:opacity-50"
                >
                  不吃了
                </button>
              ) : null}
            </div>
          </div>
        )}
        <p
          data-testid={`${testId}-status-note`}
          role="status"
          aria-live="polite"
          className={`mt-3 text-center text-xs font-bold leading-5 ${success ? "status-pop text-[#16855b]" : "text-stone-500"}`}
        >
          {success ? `${title}已成功提交 ${currentUserQuantity} 份。` : statusNote}
        </p>
      </div>

      <div className="border-t border-stone-200 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-black text-stone-800">
            <Users size={18} weight="bold" aria-hidden="true" />
            本餐点餐明细
          </span>
          <span className="text-sm font-black text-[#6e5500]">{totalQuantity} 份</span>
        </div>
        {signups.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {signups.map((signup) => (
              <span
                key={`${date}-${title}-${signup.id}`}
                className="rounded-lg bg-[#fff9dc] px-2.5 py-1 text-xs font-bold text-[#6e5500]"
              >
                {signup.quantity > 1 ? `${signup.userName} × ${signup.quantity}` : signup.userName}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs font-bold text-stone-400">还没有人点餐</p>
        )}
      </div>
    </div>
  );
}
