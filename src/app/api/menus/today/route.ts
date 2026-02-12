import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function getMealStatus(mealType: "lunch" | "dinner"): "open" | "closed" | "upcoming" {
  const now = new Date();
  const hours = now.getHours();

  if (mealType === "lunch") {
    // 午餐：10:00 前 = "open"，之后 = "closed"
    return hours < 10 ? "open" : "closed";
  } else {
    // 晚餐：15:00 前 = "open"（但 10:00 前显示 "upcoming"），之后 = "closed"
    if (hours < 10) return "upcoming";
    if (hours < 15) return "open";
    return "closed";
  }
}

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [lunchMenu, dinnerMenu] = await Promise.all([
      prisma.dailyMenu.findUnique({
        where: { date_mealType: { date: today, mealType: "lunch" } },
        include: { items: true },
      }),
      prisma.dailyMenu.findUnique({
        where: { date_mealType: { date: today, mealType: "dinner" } },
        include: { items: true },
      }),
    ]);

    return NextResponse.json({
      lunch: lunchMenu
        ? {
            menu: {
              id: lunchMenu.id,
              date: lunchMenu.date,
              mealType: lunchMenu.mealType,
            },
            items: lunchMenu.items,
            status: getMealStatus("lunch"),
          }
        : null,
      dinner: dinnerMenu
        ? {
            menu: {
              id: dinnerMenu.id,
              date: dinnerMenu.date,
              mealType: dinnerMenu.mealType,
            },
            items: dinnerMenu.items,
            status: getMealStatus("dinner"),
          }
        : null,
    });
  } catch (error) {
    console.error("Failed to fetch today's menus:", error);
    return NextResponse.json(
      { error: "Failed to fetch menus" },
      { status: 500 }
    );
  }
}

