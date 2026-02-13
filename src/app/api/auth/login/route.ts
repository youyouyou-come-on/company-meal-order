import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "请输入姓名" },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();

    const user = await prisma.user.upsert({
      where: { name: trimmedName },
      update: {},
      create: { name: trimmedName },
    });

    const session = await getSession();
    session.userId = user.id;
    session.userName = user.name;
    await session.save();

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "登录失败，请重试" },
      { status: 500 }
    );
  }
}
