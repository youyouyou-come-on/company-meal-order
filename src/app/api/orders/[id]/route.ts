import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { id } = await params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json({ error: "无效的订单ID" }, { status: 400 });
    }

    // Find the order with its dailyMenu
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { dailyMenu: true },
    });

    if (!order) {
      return NextResponse.json({ error: "订单不存在" }, { status: 404 });
    }

    // Check ownership
    if (order.userId !== session.userId) {
      return NextResponse.json(
        { error: "无权取消他人订单" },
        { status: 403 }
      );
    }

    // Time validation
    const now = new Date();
    const hours = now.getHours();

    if (order.dailyMenu.mealType === "lunch" && hours >= 10) {
      return NextResponse.json(
        { error: "午餐取消已截止（截止时间 10:00）" },
        { status: 400 }
      );
    }

    if (order.dailyMenu.mealType === "dinner" && hours >= 15) {
      return NextResponse.json(
        { error: "晚餐取消已截止（截止时间 15:00）" },
        { status: 400 }
      );
    }

    // Delete order items first, then order (in transaction)
    await prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({
        where: { orderId: order.id },
      });
      await tx.order.delete({
        where: { id: order.id },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete order:", error);
    return NextResponse.json(
      { error: "取消订单失败，请重试" },
      { status: 500 }
    );
  }
}

