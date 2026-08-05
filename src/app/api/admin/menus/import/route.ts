import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { businessDateToUtcDate } from "@/lib/china-date";
import { MenuCsvValidationError, parseMenuCsv } from "@/lib/menu-csv";
import { parseMenuWorkbook } from "@/lib/menu-excel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    if (!session.adminVerified) {
      return NextResponse.json({ error: "未验证管理员密码" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请选择 Excel 或 CSV 文件" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "菜单文件不能超过 5MB" }, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    let entries;
    if (lowerName.endsWith(".xlsx")) {
      entries = await parseMenuWorkbook(await file.arrayBuffer());
    } else if (lowerName.endsWith(".csv")) {
      entries = parseMenuCsv(await file.text());
    } else {
      return NextResponse.json(
        { error: "仅支持 .xlsx 或 .csv 格式的菜单文件" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (transaction) => {
      for (const entry of entries) {
        const date = businessDateToUtcDate(entry.date);
        const menu = await transaction.weeklyMenu.upsert({
          where: { date_mealType: { date, mealType: entry.mealType } },
          update: { dishes: entry.dishes },
          create: { date, mealType: entry.mealType, dishes: entry.dishes },
        });

        await transaction.$executeRaw`
          DELETE FROM "WeeklyMenu"
          WHERE "mealType" = ${entry.mealType}
            AND substr("date", 1, 10) = ${entry.date}
            AND "id" <> ${menu.id}
        `;
      }
    });

    return NextResponse.json({ success: true, importedCount: entries.length });
  } catch (error) {
    if (error instanceof MenuCsvValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "导入菜单失败" }, { status: 500 });
  }
}
