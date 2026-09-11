import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  formatBusinessDate,
  formatMenuExportFilename,
  getBusinessWeekDates,
  getBusinessWeekRange,
  getChinaWeekStart,
} from "@/lib/china-date";
import {
  assertBusinessDate,
  MenuCsvValidationError,
  type CsvMealType,
} from "@/lib/menu-csv";
import { createMenuWorkbook } from "@/lib/menu-excel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    if (!session.adminVerified) {
      return NextResponse.json({ error: "未验证管理员密码" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("weekStart") || getChinaWeekStart();
    assertBusinessDate(weekStart);
    const { start, end } = getBusinessWeekRange(weekStart);
    const menus = await prisma.weeklyMenu.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: [{ date: "asc" }, { mealType: "asc" }, { id: "asc" }],
    });

    const menuBySlot = new Map<string, string>();
    for (const menu of menus) {
      const date = formatBusinessDate(menu.date);
      menuBySlot.set(`${date}-${menu.mealType}`, menu.dishes);
    }

    const weekDates = getBusinessWeekDates(weekStart);
    const rows = weekDates.flatMap((date) =>
      (["lunch", "dinner"] as CsvMealType[]).map((mealType) => ({
        date,
        mealType,
        dishes: menuBySlot.get(`${date}-${mealType}`) ?? "",
      }))
    );
    const workbook = await createMenuWorkbook(rows);
    const filename = formatMenuExportFilename(weekStart, weekDates.at(-1) ?? weekStart);

    return new NextResponse(workbook, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof MenuCsvValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "导出菜单失败" }, { status: 500 });
  }
}
