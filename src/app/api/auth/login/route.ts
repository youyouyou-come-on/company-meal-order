import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

function getPositiveIntegerEnv(name: string, fallback: number) {
  const rawValue = process.env[name];
  if (!rawValue) return fallback;

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;

  return parsed;
}

const MAX_FAILED_ATTEMPTS = getPositiveIntegerEnv(
  "LOGIN_LOCK_MAX_FAILED_ATTEMPTS",
  100
);
const LOCK_DURATION_MINUTES = getPositiveIntegerEnv(
  "LOGIN_LOCK_DURATION_MINUTES",
  15
);

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();

  return "unknown";
}

function getLockedMessage() {
  return `当前网络尝试过多，请 ${LOCK_DURATION_MINUTES} 分钟后再试`;
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
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
    const now = new Date();
    const throttle = await prisma.loginThrottle.findUnique({
      where: { ip: clientIp },
    });

    if (
      throttle?.lockedUntil &&
      throttle.failedCount >= MAX_FAILED_ATTEMPTS &&
      throttle.lockedUntil > now
    ) {
      return NextResponse.json(
        { error: getLockedMessage() },
        { status: 429 }
      );
    }

    if (!loginPassword) {
      return NextResponse.json(
        { error: "系统未配置登录密码" },
        { status: 500 }
      );
    }

    if (trimmedPassword !== loginPassword) {
      const nextFailedCount = (throttle?.failedCount ?? 0) + 1;
      const lockedUntil =
        nextFailedCount >= MAX_FAILED_ATTEMPTS
          ? new Date(now.getTime() + LOCK_DURATION_MINUTES * 60 * 1000)
          : null;

      await prisma.loginThrottle.upsert({
        where: { ip: clientIp },
        update: {
          failedCount: nextFailedCount,
          lockedUntil,
        },
        create: {
          ip: clientIp,
          failedCount: nextFailedCount,
          lockedUntil,
        },
      });

      return NextResponse.json(
        {
          error:
            nextFailedCount >= MAX_FAILED_ATTEMPTS
              ? getLockedMessage()
              : "姓名或密码错误",
        },
        { status: nextFailedCount >= MAX_FAILED_ATTEMPTS ? 429 : 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { name: trimmedName },
    });

    if (!user) {
      const nextFailedCount = (throttle?.failedCount ?? 0) + 1;
      const lockedUntil =
        nextFailedCount >= MAX_FAILED_ATTEMPTS
          ? new Date(now.getTime() + LOCK_DURATION_MINUTES * 60 * 1000)
          : null;

      await prisma.loginThrottle.upsert({
        where: { ip: clientIp },
        update: {
          failedCount: nextFailedCount,
          lockedUntil,
        },
        create: {
          ip: clientIp,
          failedCount: nextFailedCount,
          lockedUntil,
        },
      });

      return NextResponse.json(
        {
          error:
            nextFailedCount >= MAX_FAILED_ATTEMPTS
              ? getLockedMessage()
              : "姓名或密码错误",
        },
        { status: nextFailedCount >= MAX_FAILED_ATTEMPTS ? 429 : 400 }
      );
    }

    if (throttle) {
      await prisma.loginThrottle.delete({
        where: { ip: clientIp },
      });
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
