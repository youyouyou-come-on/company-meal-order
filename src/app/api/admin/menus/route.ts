import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getWeekRange(weekStart: string): { start: Date; end: Date } {
  const start = new Date(weekStart + "T00:00:00.000Z");
  const end = new Date(
    Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth(),
      start.getUTCDate() + 6
    )
  );
  return { start, end };
}

function getMondayOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMonday)
  );
  return monday.toISOString().split("T")[0];
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
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    if (!session.adminVerified) {
      return NextResponse.json({ error: "未验证管理员密码" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("weekStart") || getMondayOfCurrentWeek();
    const { start, end } = getWeekRange(weekStart);

    const menus = await prisma.weeklyMenu.findMany({
      where: {
        date: { gte: start, lte: end },
      },
      orderBy: [{ date: "asc" }, { mealType: "asc" }, { id: "asc" }],
    });

    return NextResponse.json(
      { menus: serializeMenus(menus) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "获取菜单失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    if (!session.adminVerified) {
      return NextResponse.json({ error: "未验证管理员密码" }, { status: 403 });
    }

    const body = await request.json();
    const { date, mealType, dishes } = body as {
      date: string;
      mealType: string;
      dishes: string;
    };

    if (!date || !mealType || !dishes) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    if (mealType !== "lunch" && mealType !== "dinner") {
      return NextResponse.json({ error: "无效的餐类型" }, { status: 400 });
    }

    const dateObj = new Date(date + "T00:00:00.000Z");

    const menu = await prisma.weeklyMenu.upsert({
      where: { date_mealType: { date: dateObj, mealType } },
      update: { dishes },
      create: { date: dateObj, mealType, dishes },
    });

    await prisma.$executeRaw`
      DELETE FROM "WeeklyMenu"
      WHERE "mealType" = ${mealType}
        AND substr("date", 1, 10) = ${date}
        AND "id" <> ${menu.id}
    `;

    return NextResponse.json({
      menu: {
        id: menu.id,
        date: menu.date.toISOString().split("T")[0],
        mealType: menu.mealType,
        dishes: menu.dishes,
      },
    });
  } catch {
    return NextResponse.json({ error: "保存菜单失败" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    if (!session.adminVerified) {
      return NextResponse.json({ error: "未验证管理员密码" }, { status: 403 });
    }

    const body = await request.json();
    const { date, mealType } = body as { date: string; mealType: string };

    if (!date || !mealType) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    await prisma.$executeRaw`
      DELETE FROM "WeeklyMenu"
      WHERE "mealType" = ${mealType}
        AND substr("date", 1, 10) = ${date}
    `;

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "删除菜单失败" }, { status: 500 });
  }
}
