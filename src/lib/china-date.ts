export const CHINA_TIME_ZONE = "Asia/Shanghai";

export type MealType = "lunch" | "dinner";

export const DAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

// 周日补班需要同时出现在菜单中，并参与“下一个可点餐日”的计算。
const SPECIAL_WORKDAYS = new Set(["2026-09-20"]);

const CHINA_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: CHINA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function getChinaParts(date = new Date()) {
  const parts = CHINA_DATE_TIME_FORMATTER.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  const hour = Number(values.hour);
  const minute = Number(values.minute);

  return { year, month, day, hour, minute };
}

export function formatBusinessDate(date: Date) {
  return date.toISOString().split("T")[0];
}

export function getChinaTodayString(date = new Date()) {
  const { year, month, day } = getChinaParts(date);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function getChinaHour(date = new Date()) {
  const { hour, minute } = getChinaParts(date);
  return hour + minute / 60;
}

export function getChinaHourInteger(date = new Date()) {
  return getChinaParts(date).hour;
}

export function businessDateToUtcDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addBusinessDays(dateStr: string, days: number) {
  const date = businessDateToUtcDate(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return formatBusinessDate(date);
}

export function getBusinessDateWeekday(dateStr: string) {
  return businessDateToUtcDate(dateStr).getUTCDay();
}

export function getChinaWeekStart(date = new Date(), weekOffset = 0) {
  const today = getChinaTodayString(date);
  return getBusinessWeekStart(today, weekOffset);
}

export function getBusinessWeekStart(dateStr: string, weekOffset = 0) {
  const today = dateStr;
  const day = getBusinessDateWeekday(today);
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return addBusinessDays(today, diffToMonday + weekOffset * 7);
}

export function getBusinessWeekDates(weekStart: string, days = 6) {
  const dates = Array.from({ length: days }, (_, index) => addBusinessDays(weekStart, index));
  const sunday = addBusinessDays(weekStart, 6);

  if (days === 6 && SPECIAL_WORKDAYS.has(sunday)) {
    dates.push(sunday);
  }

  return dates;
}

export function getChinaWeekDates(weekOffset = 0, days = 6, date = new Date()) {
  const monday = getChinaWeekStart(date, weekOffset);
  return getBusinessWeekDates(monday, days);
}

export function getBusinessWeekRange(weekStart?: string, days = 6) {
  const startDate = weekStart || getChinaWeekStart();
  const weekDates = getBusinessWeekDates(startDate, days);
  const endDate = weekDates.at(-1) ?? startDate;

  return {
    start: businessDateToUtcDate(startDate),
    end: businessDateToUtcDate(endDate),
  };
}

export function formatDateLabel(dateStr: string) {
  const date = businessDateToUtcDate(dateStr);
  return {
    dayLabel: DAY_LABELS[date.getUTCDay()],
    shortDate: `${date.getUTCMonth() + 1}/${date.getUTCDate()}`,
  };
}

export function formatMenuExportFilename(weekStart: string, weekEnd: string) {
  return `${weekStart.replaceAll("-", ".")}-${weekEnd.replaceAll("-", ".")}.xlsx`;
}

export function getOrderableDates(date = new Date()) {
  const today = getChinaTodayString(date);
  const isOrderableWorkday = (dateStr: string) =>
    getBusinessDateWeekday(dateStr) !== 0 || SPECIAL_WORKDAYS.has(dateStr);
  const targetDateCount = isOrderableWorkday(today) ? 2 : 1;
  const dates: string[] = [];
  let candidate = today;

  while (dates.length < targetDateCount) {
    if (isOrderableWorkday(candidate)) {
      dates.push(candidate);
    }
    candidate = addBusinessDays(candidate, 1);
  }

  return dates;
}

export function isMealOrderableDate(dateStr: string, now = new Date()) {
  return getOrderableDates(now).includes(dateStr);
}

export function isMealExpired(dateStr: string, mealType: MealType, now = new Date()) {
  const today = getChinaTodayString(now);
  if (dateStr < today) return true;
  if (dateStr > today) return false;

  const cutoffHour = mealType === "lunch" ? 10 : 15.5;
  return getChinaHour(now) >= cutoffHour;
}
