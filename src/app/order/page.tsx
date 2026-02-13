"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface MenuItem {
  id: number;
  name: string;
  description: string | null;
}

interface DailyMenu {
  id: number;
  date: string;
  mealType: string;
}

interface MealData {
  menu: DailyMenu;
  items: MenuItem[];
  status: "open" | "closed" | "upcoming";
}

interface OrderItem {
  id: number;
  menuItemId: number;
  quantity: number;
  menuItem: MenuItem;
}

interface Order {
  id: number;
  dailyMenuId: number;
  dailyMenu: DailyMenu;
  items: OrderItem[];
}

interface MenuResponse {
  lunch: MealData | null;
  dinner: MealData | null;
}

export default function OrderPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const router = useRouter();
  const [menuData, setMenuData] = useState<MenuResponse | null>(null);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [menuRes, ordersRes] = await Promise.all([
        fetch("/api/menus/today"),
        fetch("/api/orders/my"),
      ]);
      const menuJson = await menuRes.json();
      const ordersJson = await ordersRes.json();
      setMenuData(menuJson);
      setMyOrders(ordersJson.orders || []);
    } catch {
      setMessage({ type: "error", text: "加载数据失败" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      fetchData();
    }
  }, [user, userLoading, router, fetchData]);

  async function handleConfirmMeal(meal: MealData) {
    setSubmitting(meal.menu.mealType);
    setMessage(null);

    try {
      // Refetch latest menu to get current menuItemIds (avoids stale ID issues)
      const menuRes = await fetch("/api/menus/today");
      const latestMenus = await menuRes.json();
      const latestMeal = latestMenus[meal.menu.mealType as "lunch" | "dinner"] as MealData | null;

      if (!latestMeal || latestMeal.items.length === 0) {
        setMessage({ type: "error", text: "菜单已变更，请刷新页面" });
        await fetchData();
        return;
      }

      // Order all items, each with quantity 1
      const items = latestMeal.items.map((item) => ({
        menuItemId: item.id,
        quantity: 1,
      }));

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailyMenuId: latestMeal.menu.id,
          items,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "下单失败" });
        return;
      }

      setMessage({ type: "success", text: "下单成功！" });
      await fetchData();
    } catch {
      setMessage({ type: "error", text: "网络错误，请重试" });
    } finally {
      setSubmitting(null);
    }
  }

  async function handleCancelOrder(orderId: number) {
    if (!confirm("确定要取消订单吗？")) return;

    setSubmitting("cancel");
    setMessage(null);

    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "取消失败" });
        return;
      }

      setMessage({ type: "success", text: "订单已取消" });
      await fetchData();
    } catch {
      setMessage({ type: "error", text: "网络错误，请重试" });
    } finally {
      setSubmitting(null);
    }
  }

  function getOrderForMeal(mealType: string): Order | undefined {
    return myOrders.find((o) => o.dailyMenu.mealType === mealType);
  }

  if (userLoading) {
    return (
      <div className="min-h-screen bg-orange-50/30 flex items-center justify-center">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-orange-50/30 flex items-center justify-center">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  const meals: { key: "lunch" | "dinner"; emoji: string; title: string; deadline: string }[] = [
    { key: "lunch", emoji: "🍱", title: "午餐", deadline: "10:00" },
    { key: "dinner", emoji: "🌙", title: "晚餐", deadline: "15:00" },
  ];

  return (
    <div className="min-h-screen bg-orange-50/30">
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="mb-8 text-center text-3xl font-bold text-gray-800">
          🛒 点餐
        </h1>

        {message && (
          <div
            className={`mb-6 rounded-xl px-4 py-3 text-sm font-medium ${
              message.type === "success"
                ? "bg-green-100 text-green-700 border border-green-200"
                : "bg-red-100 text-red-700 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex flex-col gap-6">
          {meals.map(({ key, emoji, title, deadline }) => {
            const meal = menuData?.[key];
            const existingOrder = getOrderForMeal(key);

            if (!meal) {
              return (
                <div
                  key={key}
                  className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100"
                >
                  <h2 className="text-xl font-semibold text-gray-800">
                    {emoji} {title}
                  </h2>
                  <p className="mt-2 text-gray-400">暂无菜单</p>
                </div>
              );
            }

            const isClosed = meal.status === "closed";

            return (
              <div
                key={key}
                className={`rounded-2xl bg-white p-6 shadow-sm border ${
                  isClosed ? "border-gray-200 opacity-75" : "border-orange-100"
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-800">
                    {emoji} {title}
                  </h2>
                  {isClosed ? (
                    <span className="inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium bg-red-100 text-red-700 border-red-200">
                      已截止
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium bg-green-100 text-green-700 border-green-200">
                      {deadline} 前可点
                    </span>
                  )}
                </div>

                {existingOrder ? (
                  <OrderConfirmed
                    order={existingOrder}
                    isClosed={isClosed}
                    submitting={submitting}
                    onCancel={handleCancelOrder}
                  />
                ) : isClosed ? (
                  <p className="text-gray-400 text-sm">点餐已截止，未下单</p>
                ) : (
                  <MealConfirm
                    meal={meal}
                    submitting={submitting}
                    onConfirm={() => handleConfirmMeal(meal)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

/* ---- Sub-components ---- */

function OrderConfirmed({
  order,
  isClosed,
  submitting,
  onCancel,
}: {
  order: Order;
  isClosed: boolean;
  submitting: string | null;
  onCancel: (id: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-orange-50 p-4">
        <p className="text-sm font-medium text-orange-700 mb-2">✅ 已下单</p>
        <div className="flex flex-wrap gap-2">
          {order.items.map((item) => (
            <span
              key={item.id}
              className="inline-block rounded-lg bg-white px-3 py-1.5 text-sm text-gray-700 border border-orange-200"
            >
              {item.menuItem.name}
            </span>
          ))}
        </div>
      </div>
      {!isClosed && (
        <button
          onClick={() => onCancel(order.id)}
          disabled={submitting === "cancel"}
          className="w-full rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          {submitting === "cancel" ? "取消中..." : "取消订单"}
        </button>
      )}
    </div>
  );
}

function MealConfirm({
  meal,
  submitting,
  onConfirm,
}: {
  meal: MealData;
  submitting: string | null;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {meal.items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl bg-gray-50 px-4 py-2.5"
          >
            <span className="font-medium text-gray-800">{item.name}</span>
            {item.description && (
              <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onConfirm}
        disabled={submitting === meal.menu.mealType}
        className="w-full rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-orange-500 transition-colors"
      >
        {submitting === meal.menu.mealType ? "提交中..." : "确认用餐"}
      </button>
    </div>
  );
}

