export type CsvMealType = "lunch" | "dinner";

export interface MenuCsvEntry {
  date: string;
  mealType: CsvMealType;
  dishes: string;
  sourceRow: number;
}

export interface MenuCsvRow {
  date: string;
  mealType: CsvMealType;
  dishes: string;
}

export class MenuCsvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MenuCsvValidationError";
  }
}

const MAX_IMPORT_ROWS = 200;
const MAX_DISHES_LENGTH = 1000;

function parseCsvRows(csvText: string) {
  const text = csvText.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      if (field.length > 0) {
        throw new MenuCsvValidationError(`第 ${rows.length + 1} 行 CSV 格式有误`);
      }
      inQuotes = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (character === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
    } else {
      field += character;
    }
  }

  if (inQuotes) {
    throw new MenuCsvValidationError("CSV 中存在未闭合的双引号");
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
}

function findHeaderIndex(headers: string[], candidates: string[]) {
  return headers.findIndex((header) => candidates.includes(header));
}

function isValidBusinessDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normalizeMealType(value: string): CsvMealType | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "午餐" || normalized === "lunch") return "lunch";
  if (normalized === "晚餐" || normalized === "dinner") return "dinner";
  return null;
}

export function parseMenuCsv(csvText: string): MenuCsvEntry[] {
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) {
    throw new MenuCsvValidationError("CSV 文件为空");
  }

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const dateIndex = findHeaderIndex(headers, ["日期", "date"]);
  const mealTypeIndex = findHeaderIndex(headers, ["餐次", "mealtype", "meal_type"]);
  const dishesIndex = findHeaderIndex(headers, ["菜品", "dishes", "menu"]);

  if (dateIndex === -1 || mealTypeIndex === -1 || dishesIndex === -1) {
    throw new MenuCsvValidationError("表头必须包含：日期、餐次、菜品");
  }

  if (rows.length - 1 > MAX_IMPORT_ROWS) {
    throw new MenuCsvValidationError(`一次最多导入 ${MAX_IMPORT_ROWS} 行菜单`);
  }

  const entries: MenuCsvEntry[] = [];
  const seenKeys = new Set<string>();

  rows.slice(1).forEach((cells, index) => {
    const sourceRow = index + 2;
    const date = (cells[dateIndex] ?? "").trim();
    const mealTypeText = (cells[mealTypeIndex] ?? "").trim();
    const dishes = (cells[dishesIndex] ?? "").trim();

    // 导出的空菜单格可以直接保留；重新导入时不会因此删除线上菜单。
    if (date && mealTypeText && !dishes) return;

    if (!date || !mealTypeText || !dishes) {
      throw new MenuCsvValidationError(`第 ${sourceRow} 行的日期、餐次或菜品不完整`);
    }
    if (!isValidBusinessDate(date)) {
      throw new MenuCsvValidationError(`第 ${sourceRow} 行日期无效，请使用 YYYY-MM-DD`);
    }

    const mealType = normalizeMealType(mealTypeText);
    if (!mealType) {
      throw new MenuCsvValidationError(`第 ${sourceRow} 行餐次无效，请填写午餐或晚餐`);
    }
    if (dishes.length > MAX_DISHES_LENGTH) {
      throw new MenuCsvValidationError(
        `第 ${sourceRow} 行菜品超过 ${MAX_DISHES_LENGTH} 个字符`
      );
    }

    const key = `${date}-${mealType}`;
    if (seenKeys.has(key)) {
      throw new MenuCsvValidationError(`第 ${sourceRow} 行与前面的日期、餐次重复`);
    }
    seenKeys.add(key);
    entries.push({ date, mealType, dishes, sourceRow });
  });

  if (entries.length === 0) {
    throw new MenuCsvValidationError("没有可导入的菜单，请至少填写一行菜品");
  }

  return entries;
}

function escapeCsvField(value: string) {
  if (!/[",\r\n]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}

export function createMenuCsv(rows: MenuCsvRow[]) {
  const lines = ["日期,餐次,菜品"];
  for (const row of rows) {
    const mealLabel = row.mealType === "lunch" ? "午餐" : "晚餐";
    lines.push(
      [row.date, mealLabel, row.dishes].map((field) => escapeCsvField(field)).join(",")
    );
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function assertBusinessDate(value: string) {
  if (!isValidBusinessDate(value)) {
    throw new MenuCsvValidationError("日期无效，请使用 YYYY-MM-DD");
  }
}
