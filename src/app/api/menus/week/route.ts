import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function getWeekRange(now: Date): { start: Date; end: Date } {
  // Get Monday of the current week (UTC)
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + diffToMonday
    )
  );

  const sunday = new Date(
    Date.UTC(
      monday.getUTCFullYear(),
      monday.getUTCMonth(),
      monday.getUTCDate() + 6
    )
  );

  return { start: monday, end: sunday };
}

export async function GET() {
  try {
    const now = new Date();
    const { start, end } = getWeekRange(now);

    const menus = await prisma.weeklyMenu.findMany({
      where: {
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: [{ date: "asc" }, { mealType: "asc" }],
    });

    return NextResponse.json({
      menus: menus.map((m) => ({
        id: m.id,
        date: m.date.toISOString().split("T")[0],
        mealType: m.mealType,
        dishes: m.dishes,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "获取菜单失败" },
      { status: 500 }
    );
  }
}

