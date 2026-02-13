import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    return NextResponse.json({ verified: session.adminVerified === true });
  } catch {
    return NextResponse.json({ error: "检查验证状态失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const body = await request.json();
    const { password } = body as { password: string };

    const adminPassword = process.env.ADMIN_PASSWORD || "123456";

    if (password !== adminPassword) {
      return NextResponse.json({ error: "密码错误" }, { status: 400 });
    }

    session.adminVerified = true;
    await session.save();

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "验证失败" }, { status: 500 });
  }
}

