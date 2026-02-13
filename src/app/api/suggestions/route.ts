import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const suggestions = await prisma.dishSuggestion.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    });
    return NextResponse.json({
      suggestions: suggestions.map((s) => ({
        id: s.id,
        content: s.content,
        userName: s.user.name,
        createdAt: s.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "获取建议列表失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "请输入建议内容" }, { status: 400 });
    }

    if (content.trim().length > 100) {
      return NextResponse.json(
        { error: "建议内容最多100字" },
        { status: 400 }
      );
    }

    await prisma.dishSuggestion.create({
      data: {
        userId: session.userId,
        content: content.trim(),
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "提交建议失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id || typeof id !== "number") {
      return NextResponse.json({ error: "参数错误" }, { status: 400 });
    }

    const suggestion = await prisma.dishSuggestion.findUnique({
      where: { id },
    });

    if (!suggestion) {
      return NextResponse.json({ error: "建议不存在" }, { status: 404 });
    }

    if (suggestion.userId !== session.userId) {
      return NextResponse.json(
        { error: "只能删除自己的建议" },
        { status: 403 }
      );
    }

    await prisma.dishSuggestion.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "删除建议失败" },
      { status: 500 }
    );
  }
}

