import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { id } = await params;
    const menuId = parseInt(id, 10);
    if (isNaN(menuId)) {
      return NextResponse.json({ error: "无效的菜单 ID" }, { status: 400 });
    }

    const body = await request.json();
    const { items } = body as {
      items: { id?: number; name: string; price: number; description?: string }[];
    };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "菜品列表不能为空" },
        { status: 400 }
      );
    }

    const existing = await prisma.dailyMenu.findUnique({
      where: { id: menuId },
    });

    if (!existing) {
      return NextResponse.json({ error: "菜单不存在" }, { status: 404 });
    }

    // Simple replace strategy: delete old items, create new ones
    await prisma.menuItem.deleteMany({ where: { dailyMenuId: menuId } });

    const menu = await prisma.dailyMenu.update({
      where: { id: menuId },
      data: {
        items: {
          create: items.map((item) => ({
            name: item.name,
            price: item.price,
            description: item.description || null,
          })),
        },
      },
      include: { items: true },
    });

    return NextResponse.json({ menu });
  } catch (err) {
    console.error("Failed to update menu:", err);
    return NextResponse.json(
      { error: "更新菜单失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { id } = await params;
    const menuId = parseInt(id, 10);
    if (isNaN(menuId)) {
      return NextResponse.json({ error: "无效的菜单 ID" }, { status: 400 });
    }

    const existing = await prisma.dailyMenu.findUnique({
      where: { id: menuId },
      include: {
        orders: { include: { items: true } },
        items: { include: { orderItems: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "菜单不存在" }, { status: 404 });
    }

    // Cascade delete: OrderItems → Orders → MenuItems → DailyMenu
    // 1. Delete all OrderItems for orders under this menu
    const orderIds = existing.orders.map((o) => o.id);
    if (orderIds.length > 0) {
      await prisma.orderItem.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      // 2. Delete all Orders
      await prisma.order.deleteMany({
        where: { id: { in: orderIds } },
      });
    }

    // 3. Delete all MenuItems
    await prisma.menuItem.deleteMany({
      where: { dailyMenuId: menuId },
    });

    // 4. Delete the DailyMenu
    await prisma.dailyMenu.delete({
      where: { id: menuId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete menu:", err);
    return NextResponse.json(
      { error: "删除菜单失败" },
      { status: 500 }
    );
  }
}

