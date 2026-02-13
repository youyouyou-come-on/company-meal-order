import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");
    const mealType = searchParams.get("mealType") || "lunch";

    const targetDate = dateStr ? new Date(dateStr) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    // Find the daily menu for this date + mealType
    const dailyMenu = await prisma.dailyMenu.findUnique({
      where: {
        date_mealType: { date: targetDate, mealType },
      },
      include: {
        items: true,
        orders: {
          include: {
            user: true,
            items: {
              include: {
                menuItem: true,
              },
            },
          },
        },
      },
    });

    if (!dailyMenu) {
      return NextResponse.json({
        menu: null,
        itemSummary: [],
        userOrders: [],
        totalOrders: 0,
        totalItems: 0,
      });
    }

    // Aggregate: per-item totals
    const itemMap = new Map<
      number,
      { name: string; totalQuantity: number }
    >();

    for (const item of dailyMenu.items) {
      itemMap.set(item.id, {
        name: item.name,
        totalQuantity: 0,
      });
    }

    for (const order of dailyMenu.orders) {
      for (const oi of order.items) {
        const entry = itemMap.get(oi.menuItemId);
        if (entry) {
          entry.totalQuantity += oi.quantity;
        }
      }
    }

    const itemSummary = Array.from(itemMap.entries()).map(
      ([id, { name, totalQuantity }]) => ({
        menuItemId: id,
        name,
        totalQuantity,
      })
    );

    // Per-user order details
    const userOrders = dailyMenu.orders.map((order) => ({
      orderId: order.id,
      userName: order.user.name,
      items: order.items.map((oi) => ({
        name: oi.menuItem.name,
        quantity: oi.quantity,
      })),
    }));

    const totalOrders = dailyMenu.orders.length;
    const totalItems = itemSummary.reduce((s, i) => s + i.totalQuantity, 0);

    return NextResponse.json({
      menu: {
        id: dailyMenu.id,
        date: dailyMenu.date,
        mealType: dailyMenu.mealType,
      },
      itemSummary,
      userOrders,
      totalOrders,
      totalItems,
    });
  } catch (err) {
    console.error("Failed to fetch order summary:", err);
    return NextResponse.json(
      { error: "获取订单汇总失败" },
      { status: 500 }
    );
  }
}

