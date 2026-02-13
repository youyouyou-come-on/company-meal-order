import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

function isExpired(dateStr: string, mealType: string): boolean {
  const now = new Date();
  const todayUTC = now.toISOString().split("T")[0];
  if (dateStr < todayUTC) return true;
  if (dateStr > todayUTC) return false;
  // Same day: check time cutoff (UTC+8)
  const cutoffHour = mealType === "lunch" ? 10 : 15;
  const chinaHour = (now.getUTCHours() + 8) % 24 + now.getUTCMinutes() / 60;
  return chinaHour >= cutoffHour;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");
    const mealType = searchParams.get("mealType");
    if (!dateStr || !mealType) {
      return NextResponse.json({ error: "缺少 date 或 mealType 参数" }, { status: 400 });
    }
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    const signups = await prisma.mealSignup.findMany({
      where: { date, mealType },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({
      signups: signups.map((s) => ({ id: s.id, userName: s.user.name })),
      count: signups.length,
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
    const { date: dateStr, mealType } = body;
    if (!dateStr || !mealType || !["lunch", "dinner"].includes(mealType)) {
      return NextResponse.json({ error: "参数错误" }, { status: 400 });
    }
    if (isExpired(dateStr, mealType)) {
      return NextResponse.json({ error: "已超过报名截止时间" }, { status: 400 });
    }
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    const existing = await prisma.mealSignup.findUnique({
      where: { userId_date_mealType: { userId: session.userId, date, mealType } },
    });
    if (existing) {
      return NextResponse.json({ error: "您已报名" }, { status: 409 });
    }
    await prisma.mealSignup.create({
      data: { userId: session.userId, date, mealType },
    });
    return NextResponse.json({ success: true });
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
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    await prisma.mealSignup.deleteMany({
      where: { userId: session.userId, date, mealType },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "取消报名失败" }, { status: 500 });
  }
}

