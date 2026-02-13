import Link from "next/link";
import { prisma } from "@/lib/prisma";
import MealStatusBadge from "./components/MealStatusBadge";

export const dynamic = "force-dynamic";

interface MenuItem {
  id: number;
  name: string;
  price: number;
  description: string | null;
}

interface MealData {
  id: number;
  mealType: string;
  items: MenuItem[];
}

async function getTodayMenus() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [lunch, dinner] = await Promise.all([
    prisma.dailyMenu.findUnique({
      where: { date_mealType: { date: today, mealType: "lunch" } },
      include: { items: true },
    }),
    prisma.dailyMenu.findUnique({
      where: { date_mealType: { date: today, mealType: "dinner" } },
      include: { items: true },
    }),
  ]);

  return { lunch, dinner };
}

function MealSection({
  meal,
  mealType,
  emoji,
  title,
  deadline,
}: {
  meal: MealData | null;
  mealType: "lunch" | "dinner";
  emoji: string;
  title: string;
  deadline: string;
}) {
  if (!meal) return null;

  return (
    <section className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-gray-800">
          {emoji} {title}
        </h2>
        <MealStatusBadge mealType={mealType} />
      </div>
      <p className="mb-4 text-sm text-gray-400">截止时间：{deadline}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {meal.items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-gray-100 bg-orange-50/40 p-4 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-gray-800">{item.name}</h3>
              <span className="shrink-0 font-bold text-orange-500">
                ¥{item.price.toFixed(0)}
              </span>
            </div>
            {item.description && (
              <p className="mt-1 text-sm text-gray-500">{item.description}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function Home() {
  const { lunch, dinner } = await getTodayMenus();
  const hasMenu = lunch || dinner;

  return (
    <div className="min-h-screen bg-orange-50/30">
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="mb-8 text-center text-3xl font-bold text-gray-800">
          🍽️ 今日菜单
        </h1>

        {!hasMenu ? (
          <div className="rounded-2xl bg-gray-100 p-8 text-center text-gray-500">
            今日菜单暂未发布
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <MealSection
              meal={lunch}
              mealType="lunch"
              emoji="🍱"
              title="午餐"
              deadline="10:00"
            />
            <MealSection
              meal={dinner}
              mealType="dinner"
              emoji="🌙"
              title="晚餐"
              deadline="15:00"
            />
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/order"
            className="inline-block rounded-full bg-orange-500 px-8 py-3 text-lg font-semibold text-white shadow-md transition-colors hover:bg-orange-600 active:bg-orange-700"
          >
            去点餐
          </Link>
        </div>
      </main>
    </div>
  );
}
