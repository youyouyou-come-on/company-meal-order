import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function requireAdmin() {
  const session = await getSession();

  if (!session.userId) {
    return {
      error: NextResponse.json({ error: "请先登录" }, { status: 401 }),
      session: null,
    };
  }

  if (session.userRole !== "admin") {
    return {
      error: NextResponse.json({ error: "无权限访问" }, { status: 403 }),
      session: null,
    };
  }

  return { error: null, session };
}

