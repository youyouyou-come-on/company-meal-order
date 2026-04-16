import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, password } = body as { name?: unknown; password?: unknown };

    if (
      !name ||
      typeof name !== "string" ||
      name.trim().length === 0 ||
      !password ||
      typeof password !== "string" ||
      password.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "请输入姓名和密码" },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    const trimmedPassword = password.trim();
    const loginPassword = process.env.LOGIN_PASSWORD;

    if (!loginPassword) {
      return NextResponse.json(
        { error: "系统未配置登录密码" },
        { status: 500 }
      );
    }

    if (trimmedPassword !== loginPassword) {
      return NextResponse.json(
        { error: "姓名或密码错误" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { name: trimmedName },
    });

    if (!user) {
      return NextResponse.json(
        { error: "姓名或密码错误" },
        { status: 400 }
      );
    }

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
