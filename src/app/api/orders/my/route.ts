import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const orders = await prisma.order.findMany({
      where: {
        userId: session.userId,
        dailyMenu: {
          date: {
            gte: today,
            lt: tomorrow,
          },
        },
      },
      include: {
        dailyMenu: true,
        items: {
          include: {
            menuItem: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    return NextResponse.json(
      { error: "获取订单失败" },
      { status: 500 }
    );
  }
}

