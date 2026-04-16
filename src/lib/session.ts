import { getIronSession, IronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId: number;
  userName: string;
  adminVerified?: boolean;
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export const sessionOptions: SessionOptions = {
  password:
    process.env.SESSION_PASSWORD ||
    "complex_password_at_least_32_characters_long_for_dev",
  ttl: SESSION_TTL_SECONDS,
  cookieName: "meal-order-session",
  cookieOptions: {
    secure: process.env.COOKIE_SECURE === "true",
    httpOnly: true,
    sameSite: "lax" as const,
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(
    cookieStore,
    sessionOptions
  );
  return session;
}

export async function refreshSession(session: IronSession<SessionData>) {
  if (!session.userId) return;
  await session.save();
}
