import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const body = await request.json();
    const { dailyMenuId, items } = body as {
      dailyMenuId: number;
      items: { menuItemId: number; quantity: number }[];
    };

    if (!dailyMenuId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "请选择至少一道菜品" },
        { status: 400 }
      );
    }

    // Fetch the dailyMenu to check mealType and deadline
    const dailyMenu = await prisma.dailyMenu.findUnique({
      where: { id: dailyMenuId },
    });

    if (!dailyMenu) {
      return NextResponse.json({ error: "菜单不存在" }, { status: 404 });
    }

    // Time validation
    const now = new Date();
    const hours = now.getHours();

    if (dailyMenu.mealType === "lunch" && hours >= 10) {
      return NextResponse.json(
        { error: "午餐点餐已截止（截止时间 10:00）" },
        { status: 400 }
      );
    }

    if (dailyMenu.mealType === "dinner" && hours >= 15) {
      return NextResponse.json(
        { error: "晚餐点餐已截止（截止时间 15:00）" },
        { status: 400 }
      );
    }

    // Check if user already ordered for this meal
    const existingOrder = await prisma.order.findUnique({
      where: {
        userId_dailyMenuId: {
          userId: session.userId,
          dailyMenuId,
        },
      },
    });

    if (existingOrder) {
      return NextResponse.json(
        { error: "您已经点过该餐了" },
        { status: 409 }
      );
    }

    // Create order with items in a transaction
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId: session.userId,
          dailyMenuId,
          items: {
            create: items.map((item) => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
            })),
          },
        },
        include: {
          items: {
            include: {
              menuItem: true,
            },
          },
          dailyMenu: true,
        },
      });
      return newOrder;
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error("Failed to create order:", error);
    return NextResponse.json(
      { error: "下单失败，请重试" },
      { status: 500 }
    );
  }
}

