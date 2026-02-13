import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const body = await request.json();
    const { fromDate, toDate, mealType } = body as {
      fromDate: string;
      toDate: string;
      mealType?: "lunch" | "dinner";
    };

    if (!fromDate || !toDate) {
      return NextResponse.json(
        { error: "请指定源日期和目标日期" },
        { status: 400 }
      );
    }

    const sourceDate = new Date(fromDate);
    sourceDate.setHours(0, 0, 0, 0);
    const targetDate = new Date(toDate);
    targetDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(sourceDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Find source menus
    const sourceMenus = await prisma.dailyMenu.findMany({
      where: {
        date: { gte: sourceDate, lt: nextDay },
        ...(mealType ? { mealType } : {}),
      },
      include: { items: true },
    });

    if (sourceMenus.length === 0) {
      return NextResponse.json(
        { error: "源日期没有可复制的菜单" },
        { status: 404 }
      );
    }

    const created = [];
    const skipped = [];

    for (const menu of sourceMenus) {
      // Check if target already exists
      const existing = await prisma.dailyMenu.findUnique({
        where: {
          date_mealType: { date: targetDate, mealType: menu.mealType },
        },
      });

      if (existing) {
        skipped.push(menu.mealType);
        continue;
      }

      const newMenu = await prisma.dailyMenu.create({
        data: {
          date: targetDate,
          mealType: menu.mealType,
          items: {
            create: menu.items.map((item) => ({
              name: item.name,
              price: item.price,
              description: item.description,
            })),
          },
        },
        include: { items: true },
      });

      created.push(newMenu);
    }

    return NextResponse.json({
      created,
      skipped,
      message:
        skipped.length > 0
          ? `已复制 ${created.length} 个菜单，${skipped.join("、")} 已存在被跳过`
          : `已成功复制 ${created.length} 个菜单`,
    });
  } catch (err) {
    console.error("Failed to copy menus:", err);
    return NextResponse.json(
      { error: "复制菜单失败" },
      { status: 500 }
    );
  }
}

