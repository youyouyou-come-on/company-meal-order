import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import {
  MenuCsvValidationError,
  parseMenuCsv,
  type MenuCsvEntry,
  type MenuCsvRow,
} from "@/lib/menu-csv";

const MAX_UNCOMPRESSED_FILE_SIZE = 10 * 1024 * 1024;

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function decodeXml(value: string) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    );
}

function escapeCsvField(value: string) {
  if (!/[",\r\n]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}

function createInlineStringCell(reference: string, value: string, style = 0) {
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function createBlankCell(reference: string, style: number) {
  return `<c r="${reference}" s="${style}"/>`;
}

function getCellReference(columnIndex: number, rowNumber: number) {
  return `${String.fromCharCode(65 + columnIndex)}${rowNumber}`;
}

function formatDisplayDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}-${month}-${day}`;
}

function formatTitleDate(date: string) {
  return formatDisplayDate(date).replaceAll("-", ".");
}

function getWeekdayLabel(date: string) {
  const labels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return labels[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

function splitDishes(dishes: string) {
  const items = dishes
    .split(/[\s、，,；;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (items.length <= 3) return items;
  return [items[0], items[1], items.slice(2).join("、")];
}

function createWorksheetXml(rows: MenuCsvRow[]) {
  const menuBySlot = new Map(rows.map((row) => [`${row.date}-${row.mealType}`, row.dishes]));
  const dates = Array.from(new Set(rows.map((row) => row.date))).sort();
  const merges = ["A1:H1", "A2:A3", "B2:B3", "C2:H2", "C3:E3", "F3:H3"];

  const title = `${formatTitleDate(dates[0])}-${formatTitleDate(dates.at(-1)!)}一周菜单`;
  const titleCells = Array.from({ length: 8 }, (_, columnIndex) =>
    columnIndex === 0
      ? createInlineStringCell("A1", title, 1)
      : createBlankCell(getCellReference(columnIndex, 1), 1)
  ).join("");
  const firstHeaderCells = [
    createInlineStringCell("A2", "日期", 2),
    createInlineStringCell("B2", "星期", 2),
    createInlineStringCell("C2", "菜      品", 2),
    ...Array.from({ length: 5 }, (_, index) =>
      createBlankCell(getCellReference(index + 3, 2), 2)
    ),
  ].join("");
  const secondHeaderCells = [
    createBlankCell("A3", 2),
    createBlankCell("B3", 2),
    createInlineStringCell("C3", "中午", 2),
    createBlankCell("D3", 2),
    createBlankCell("E3", 2),
    createInlineStringCell("F3", "晚上", 2),
    createBlankCell("G3", 2),
    createBlankCell("H3", 2),
  ].join("");

  const dataRows = dates.map((date, index) => {
    const rowNumber = index + 4;
    const lunch = splitDishes(menuBySlot.get(`${date}-lunch`) ?? "");
    const dinner = splitDishes(menuBySlot.get(`${date}-dinner`) ?? "");
    const cells = [
      createInlineStringCell(`A${rowNumber}`, formatDisplayDate(date), 3),
      createInlineStringCell(`B${rowNumber}`, getWeekdayLabel(date), 3),
    ];

    for (let mealIndex = 0; mealIndex < 2; mealIndex += 1) {
      const items = mealIndex === 0 ? lunch : dinner;
      const startColumn = mealIndex === 0 ? 2 : 5;
      for (let slotIndex = 0; slotIndex < 3; slotIndex += 1) {
        const reference = getCellReference(startColumn + slotIndex, rowNumber);
        const item = items[slotIndex] ?? "";
        cells.push(item ? createInlineStringCell(reference, item, 4) : createBlankCell(reference, 4));
      }
      if (items.length === 1) {
        merges.push(
          `${getCellReference(startColumn, rowNumber)}:${getCellReference(startColumn + 2, rowNumber)}`
        );
      }
    }

    return `<row r="${rowNumber}" ht="58" customHeight="1">${cells.join("")}</row>`;
  });
  const mergeXml = merges.map((reference) => `<mergeCell ref="${reference}"/>`).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:H${dates.length + 3}"/>
  <sheetViews><sheetView showGridLines="0" workbookViewId="0"><selection activeCell="A1" sqref="A1"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols><col min="1" max="1" width="15" customWidth="1"/><col min="2" max="2" width="10" customWidth="1"/><col min="3" max="8" width="18" customWidth="1"/></cols>
  <sheetData><row r="1" ht="44" customHeight="1">${titleCells}</row><row r="2" ht="28" customHeight="1">${firstHeaderCells}</row><row r="3" ht="28" customHeight="1">${secondHeaderCells}</row>${dataRows.join("")}</sheetData>
  <mergeCells count="${merges.length}">${mergeXml}</mergeCells>
  <printOptions horizontalCentered="1" verticalCentered="1"/>
  <pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.15" footer="0.15"/>
  <pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="1"/>
</worksheet>`;
}

export function createMenuWorkbook(rows: MenuCsvRow[]) {
  const files = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews><workbookView/></bookViews>
  <sheets><sheet name="菜单" sheetId="1" r:id="rId1"/></sheets>
  <definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">'菜单'!$A$1:$H$${rows.length / 2 + 3}</definedName></definedNames>
  <calcPr calcId="191029"/>
</workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    "xl/styles.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4"><font><sz val="12"/><name val="PingFang SC"/><charset val="134"/></font><font><b/><sz val="24"/><name val="Songti SC"/><charset val="134"/></font><font><b/><sz val="13"/><name val="PingFang SC"/><charset val="134"/></font><font><b/><sz val="12"/><name val="PingFang SC"/><charset val="134"/></font></fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`),
    "xl/worksheets/sheet1.xml": strToU8(createWorksheetXml(rows)),
  };

  return Buffer.from(zipSync(files, { level: 6 }));
}

function readInlineText(cellXml: string) {
  return Array.from(cellXml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g))
    .map((match) => decodeXml(match[1]))
    .join("");
}

function readSharedStrings(files: Record<string, Uint8Array>) {
  const sharedStrings = files["xl/sharedStrings.xml"];
  if (!sharedStrings) return [];

  const xml = strFromU8(sharedStrings);
  return Array.from(xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)).map((match) =>
    readInlineText(match[1])
  );
}

function excelSerialToBusinessDate(serialText: string) {
  const serial = Number(serialText);
  if (!Number.isFinite(serial)) return serialText;
  const date = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000);
  return date.toISOString().slice(0, 10);
}

function getColumnIndex(reference: string) {
  const letters = reference.replace(/\d/g, "").toUpperCase();
  let index = 0;
  for (const character of letters) {
    index = index * 26 + character.charCodeAt(0) - 64;
  }
  return index - 1;
}

function parseWorksheetGrid(files: Record<string, Uint8Array>) {
  const worksheet = files["xl/worksheets/sheet1.xml"];
  if (!worksheet) {
    throw new MenuCsvValidationError("Excel 文件中没有可读取的工作表");
  }

  const sharedStrings = readSharedStrings(files);
  const xml = strFromU8(worksheet);
  const rows: string[][] = [];
  for (const rowMatch of xml.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    const populatedCellsXml = rowMatch[1].replace(/<c\s[^>]*\/>/g, "");
    for (const cellMatch of populatedCellsXml.matchAll(/<c\s([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attributes = cellMatch[1];
      const content = cellMatch[2];
      const reference = /\br="([A-Z]+\d+)"/i.exec(attributes)?.[1];
      if (!reference) continue;

      const type = /\bt="([^"]+)"/.exec(attributes)?.[1];
      const rawValue = /<v>([\s\S]*?)<\/v>/.exec(content)?.[1] ?? "";
      let value = type === "inlineStr" ? readInlineText(content) : decodeXml(rawValue);
      if (type === "s") value = sharedStrings[Number(value)] ?? "";
      if (!type && getColumnIndex(reference) === 0 && value) {
        value = excelSerialToBusinessDate(value);
      }
      cells[getColumnIndex(reference)] = value;
    }
    rows.push(cells.map((cell) => cell ?? ""));
  }
  return rows;
}

function normalizeHeader(value: string) {
  return value.replace(/\s/g, "").toLowerCase();
}

function normalizeBusinessDate(value: string) {
  const match = /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/.exec(value.trim());
  if (!match) return value.trim();
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function createCsvFromRows(rows: string[][]) {
  return rows
    .map((cells) => cells.map((cell) => escapeCsvField(cell ?? "")).join(","))
    .join("\r\n");
}

function createCsvFromWeeklyLayout(rows: string[][]) {
  const mainHeaderIndex = rows.findIndex((cells) => {
    const headers = cells.map(normalizeHeader);
    return headers.includes("日期") && headers.includes("菜品");
  });
  if (mainHeaderIndex === -1) return null;

  const mealHeaderIndex = rows.findIndex((cells, index) => {
    if (index <= mainHeaderIndex) return false;
    const headers = cells.map(normalizeHeader);
    return headers.some((header) => header === "中午" || header === "午餐") &&
      headers.some((header) => header === "晚上" || header === "晚餐");
  });
  if (mealHeaderIndex === -1) return null;

  const mainHeaders = rows[mainHeaderIndex].map(normalizeHeader);
  const mealHeaders = rows[mealHeaderIndex].map(normalizeHeader);
  const dateIndex = mainHeaders.indexOf("日期");
  const lunchIndex = mealHeaders.findIndex(
    (header) => header === "中午" || header === "午餐"
  );
  const dinnerIndex = mealHeaders.findIndex(
    (header) => header === "晚上" || header === "晚餐"
  );
  if (dateIndex === -1 || lunchIndex === -1 || dinnerIndex === -1) return null;

  const lines = ["日期,餐次,菜品"];
  for (const cells of rows.slice(mealHeaderIndex + 1)) {
    const rawDate = cells[dateIndex]?.trim();
    if (!rawDate) continue;
    const date = normalizeBusinessDate(rawDate);
    const lunch = cells
      .slice(lunchIndex, dinnerIndex)
      .map((cell) => cell.trim())
      .filter(Boolean)
      .join(" ");
    const dinner = cells
      .slice(dinnerIndex)
      .map((cell) => cell.trim())
      .filter(Boolean)
      .join(" ");

    if (lunch) lines.push([date, "午餐", lunch].map(escapeCsvField).join(","));
    if (dinner) lines.push([date, "晚餐", dinner].map(escapeCsvField).join(","));
  }
  return lines.join("\r\n");
}

export function parseMenuWorkbook(data: ArrayBuffer): MenuCsvEntry[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(data), {
      filter(file) {
        if (file.originalSize > MAX_UNCOMPRESSED_FILE_SIZE) {
          throw new MenuCsvValidationError("Excel 文件解压后内容过大");
        }
        return (
          file.name === "xl/worksheets/sheet1.xml" ||
          file.name === "xl/sharedStrings.xml"
        );
      },
    });
  } catch (error) {
    if (error instanceof MenuCsvValidationError) throw error;
    throw new MenuCsvValidationError("Excel 文件无法读取，请确认文件格式为 .xlsx");
  }

  const rows = parseWorksheetGrid(files);
  return parseMenuCsv(createCsvFromWeeklyLayout(rows) ?? createCsvFromRows(rows));
}
