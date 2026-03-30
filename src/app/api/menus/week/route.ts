import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getWeekRange(weekStart?: string): { start: Date; end: Date } {
  let monday: Date;

  if (weekStart) {
    monday = new Date(`${weekStart}T00:00:00.000Z`);
  } else {
    const now = new Date();
    const day = now.getUTCDay(); // 0=Sun, 1=Mon, ...
    const diffToMonday = day === 0 ? -6 : 1 - day;

    monday = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + diffToMonday
      )
    );
  }

  const sunday = new Date(
    Date.UTC(
      monday.getUTCFullYear(),
      monday.getUTCMonth(),
      monday.getUTCDate() + 6
    )
  );

  return { start: monday, end: sunday };
}

function serializeMenus(
  menus: Array<{ id: number; date: Date; mealType: string; dishes: string }>
) {
  const deduped = new Map<
    string,
    { id: number; date: string; mealType: string; dishes: string }
  >();

  for (const menu of menus) {
    const date = menu.date.toISOString().split("T")[0];
    deduped.set(`${date}-${menu.mealType}`, {
      id: menu.id,
      date,
      mealType: menu.mealType,
      dishes: menu.dishes,
    });
  }

  return Array.from(deduped.values()).sort((a, b) => {
    if (a.date === b.date) return a.mealType.localeCompare(b.mealType);
    return a.date.localeCompare(b.date);
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("weekStart") ?? undefined;
    const { start, end } = getWeekRange(weekStart);

    const menus = await prisma.weeklyMenu.findMany({
      where: {
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: [{ date: "asc" }, { mealType: "asc" }, { id: "asc" }],
    });

    return NextResponse.json(
      { menus: serializeMenus(menus) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "获取菜单失败" },
      { status: 500 }
    );
  }
}
