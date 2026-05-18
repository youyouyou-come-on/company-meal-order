export const CHINA_TIME_ZONE = "Asia/Shanghai";

export type MealType = "lunch" | "dinner";

export const DAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

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

export function getChinaWeekDates(weekOffset = 0, days = 6, date = new Date()) {
  const monday = getChinaWeekStart(date, weekOffset);
  return Array.from({ length: days }, (_, index) => addBusinessDays(monday, index));
}

export function getBusinessWeekRange(weekStart?: string, days = 6) {
  const startDate = weekStart || getChinaWeekStart();
  const endDate = addBusinessDays(startDate, days - 1);

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

export function getOrderableDates(date = new Date()) {
  const today = getChinaTodayString(date);
  const weekday = getBusinessDateWeekday(today);

  if (weekday === 0) {
    return [addBusinessDays(today, 1)];
  }

  const nextOrderableDate = weekday === 6 ? addBusinessDays(today, 2) : addBusinessDays(today, 1);
  return [today, nextOrderableDate];
}

export function isMealOrderableDate(dateStr: string, now = new Date()) {
  return getOrderableDates(now).includes(dateStr);
}

export function isMealExpired(dateStr: string, mealType: MealType, now = new Date()) {
  const today = getChinaTodayString(now);
  if (dateStr < today) return true;
  if (dateStr > today) return false;

  const cutoffHour = mealType === "lunch" ? 10 : 16;
  return getChinaHour(now) >= cutoffHour;
}
