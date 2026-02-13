import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

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

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("weekStart") || getMondayOfCurrentWeek();
    const { start, end } = getWeekRange(weekStart);

    const menus = await prisma.weeklyMenu.findMany({
      where: {
        date: { gte: start, lte: end },
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
    return NextResponse.json({ error: "获取菜单失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
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

    const body = await request.json();
    const { date, mealType } = body as { date: string; mealType: string };

    if (!date || !mealType) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    const dateObj = new Date(date + "T00:00:00.000Z");

    await prisma.weeklyMenu.delete({
      where: { date_mealType: { date: dateObj, mealType } },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "删除菜单失败" }, { status: 500 });
  }
}

