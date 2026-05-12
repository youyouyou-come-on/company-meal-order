import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_NAME_LENGTH = 20;

async function requireAdminSession() {
  const session = await getSession();

  if (!session.userId) {
    return {
      session,
      response: NextResponse.json({ error: "未登录" }, { status: 401 }),
    };
  }

  if (!session.adminVerified) {
    return {
      session,
      response: NextResponse.json({ error: "未验证管理员密码" }, { status: 403 }),
    };
  }

  return { session, response: null };
}

function serializeUser(user: {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}

function normalizeName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, "");
}

export async function GET() {
  try {
    const { response } = await requireAdminSession();
    if (response) return response;

    const users = await prisma.user.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }, { id: "asc" }],
    });

    return NextResponse.json(
      { users: users.map(serializeUser) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "获取员工失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { response } = await requireAdminSession();
    if (response) return response;

    const body = await request.json();
    const name = normalizeName((body as { name?: unknown }).name);

    if (!name) {
      return NextResponse.json({ error: "请输入员工姓名" }, { status: 400 });
    }

    if (name.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `姓名不能超过 ${MAX_NAME_LENGTH} 个字` },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { name } });
    const user = existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: { isActive: true },
        })
      : await prisma.user.create({ data: { name, isActive: true } });

    return NextResponse.json(
      { user: serializeUser(user), restored: Boolean(existingUser) },
      { status: existingUser ? 200 : 201 }
    );
  } catch {
    return NextResponse.json({ error: "保存员工失败" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { session, response } = await requireAdminSession();
    if (response) return response;

    const body = await request.json();
    const { id, isActive } = body as { id?: unknown; isActive?: unknown };

    if (typeof id !== "number" || !Number.isInteger(id) || typeof isActive !== "boolean") {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    if (session.userId === id && !isActive) {
      return NextResponse.json(
        { error: "不能停用当前登录的账号" },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
    });

    return NextResponse.json({ user: serializeUser(user) });
  } catch {
    return NextResponse.json({ error: "更新员工失败" }, { status: 500 });
  }
}
