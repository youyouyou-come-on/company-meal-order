import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  addBusinessDays,
  formatBusinessDate,
  getBusinessWeekRange,
  getChinaWeekStart,
} from "@/lib/china-date";
import {
  assertBusinessDate,
  createMenuCsv,
  MenuCsvValidationError,
  type CsvMealType,
} from "@/lib/menu-csv";

export const dynamic = "force-dynamic";

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

    const rows = Array.from({ length: 6 }, (_, dayIndex) =>
      addBusinessDays(weekStart, dayIndex)
    ).flatMap((date) =>
      (["lunch", "dinner"] as CsvMealType[]).map((mealType) => ({
        date,
        mealType,
        dishes: menuBySlot.get(`${date}-${mealType}`) ?? "",
      }))
    );
    const csv = createMenuCsv(rows);
    const weekEnd = addBusinessDays(weekStart, 5);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="menu-${weekStart}-to-${weekEnd}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof MenuCsvValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "导出菜单失败" }, { status: 500 });
  }
}
