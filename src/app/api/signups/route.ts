import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { businessDateToUtcDate, isMealExpired, type MealType } from "@/lib/china-date";

const MIN_MEAL_QUANTITY = 1;
const MAX_MEAL_QUANTITY = 20;

function isExpired(dateStr: string, mealType: string): boolean {
  return isMealExpired(dateStr, mealType as MealType);
}

function parseQuantity(value: unknown) {
  const quantity = Number(value);

  if (!Number.isInteger(quantity)) {
    return null;
  }

  if (quantity < MIN_MEAL_QUANTITY || quantity > MAX_MEAL_QUANTITY) {
    return null;
  }

  return quantity;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");
    const mealType = searchParams.get("mealType");
    if (!dateStr || !mealType) {
      return NextResponse.json({ error: "缺少 date 或 mealType 参数" }, { status: 400 });
    }
    const date = businessDateToUtcDate(dateStr);
    const signups = await prisma.mealSignup.findMany({
      where: { date, mealType },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });

    const totalQuantity = signups.reduce((sum, signup) => sum + signup.quantity, 0);

    return NextResponse.json({
      signups: signups.map((signup) => ({
        id: signup.id,
        userName: signup.user.name,
        quantity: signup.quantity,
      })),
      count: totalQuantity,
    });
  } catch {
    return NextResponse.json({ error: "获取报名列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    const body = await request.json();
    const { date: dateStr, mealType, quantity: rawQuantity } = body;
    if (!dateStr || !mealType || !["lunch", "dinner"].includes(mealType)) {
      return NextResponse.json({ error: "参数错误" }, { status: 400 });
    }
    const quantity = parseQuantity(rawQuantity);
    if (quantity === null) {
      return NextResponse.json(
        { error: `份数必须是 ${MIN_MEAL_QUANTITY} 到 ${MAX_MEAL_QUANTITY} 的整数` },
        { status: 400 }
      );
    }
    if (isExpired(dateStr, mealType)) {
      return NextResponse.json({ error: "已超过报名截止时间" }, { status: 400 });
    }
    const date = businessDateToUtcDate(dateStr);
    await prisma.mealSignup.upsert({
      where: { userId_date_mealType: { userId: session.userId, date, mealType } },
      update: { quantity },
      create: { userId: session.userId, date, mealType, quantity },
    });
    return NextResponse.json({ success: true, quantity });
  } catch {
    return NextResponse.json({ error: "报名失败" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    const body = await request.json();
    const { date: dateStr, mealType } = body;
    if (!dateStr || !mealType || !["lunch", "dinner"].includes(mealType)) {
      return NextResponse.json({ error: "参数错误" }, { status: 400 });
    }
    if (isExpired(dateStr, mealType)) {
      return NextResponse.json({ error: "已超过取消截止时间" }, { status: 400 });
    }
    const date = businessDateToUtcDate(dateStr);
    await prisma.mealSignup.deleteMany({
      where: { userId: session.userId, date, mealType },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "取消报名失败" }, { status: 500 });
  }
}
