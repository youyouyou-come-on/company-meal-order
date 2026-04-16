import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "该接口不可用" },
    { status: 404 }
  );
}
