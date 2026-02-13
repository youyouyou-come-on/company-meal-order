import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const body = await request.json();
    const { date, mealType, items } = body as {
      date: string;
      mealType: "lunch" | "dinner";
      items: { name: string; price?: number; description?: string }[];
    };

    if (!date || !mealType || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "请填写完整的菜单信息" },
        { status: 400 }
      );
    }

    if (!["lunch", "dinner"].includes(mealType)) {
      return NextResponse.json(
        { error: "餐次必须是 lunch 或 dinner" },
        { status: 400 }
      );
    }

    const menuDate = new Date(date);
    menuDate.setHours(0, 0, 0, 0);

    // Check if menu already exists for this date + mealType
    const existing = await prisma.dailyMenu.findUnique({
      where: { date_mealType: { date: menuDate, mealType } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "该日期和餐次的菜单已存在" },
        { status: 409 }
      );
    }

    const menu = await prisma.dailyMenu.create({
      data: {
        date: menuDate,
        mealType,
        items: {
          create: items.map((item) => ({
            name: item.name,
            price: item.price ?? 0,
            description: item.description || null,
          })),
        },
      },
      include: { items: true },
    });

    return NextResponse.json({ menu }, { status: 201 });
  } catch (err) {
    console.error("Failed to create menu:", err);
    return NextResponse.json(
      { error: "创建菜单失败" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");

    const targetDate = dateStr ? new Date(dateStr) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const menus = await prisma.dailyMenu.findMany({
      where: {
        date: {
          gte: targetDate,
          lt: nextDay,
        },
      },
      include: {
        items: true,
        _count: { select: { orders: true } },
      },
      orderBy: { mealType: "asc" },
    });

    return NextResponse.json({ menus });
  } catch (err) {
    console.error("Failed to fetch menus:", err);
    return NextResponse.json(
      { error: "获取菜单失败" },
      { status: 500 }
    );
  }
}

