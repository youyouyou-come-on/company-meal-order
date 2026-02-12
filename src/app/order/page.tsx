"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface MenuItem {
  id: number;
  name: string;
  price: number;
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
  const [quantities, setQuantities] = useState<Record<number, number>>({});
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

  function updateQuantity(itemId: number, delta: number) {
    setQuantities((prev) => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [itemId]: next };
    });
  }

  async function handleSubmitOrder(meal: MealData) {
    const selectedItems = meal.items
      .filter((item) => (quantities[item.id] || 0) > 0)
      .map((item) => ({ menuItemId: item.id, quantity: quantities[item.id] }));

    if (selectedItems.length === 0) {
      setMessage({ type: "error", text: "请至少选择一道菜品" });
      return;
    }

    setSubmitting(meal.menu.mealType);
    setMessage(null);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailyMenuId: meal.menu.id,
          items: selectedItems,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "下单失败" });
        return;
      }

      setMessage({ type: "success", text: "下单成功！" });
      setQuantities({});
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

  function calcTotal(meal: MealData): number {
    return meal.items.reduce(
      (sum, item) => sum + item.price * (quantities[item.id] || 0),
      0
    );
  }

  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-orange-50/30 flex items-center justify-center">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  if (!user) return null;

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
                  <OrderDetail
                    order={existingOrder}
                    isClosed={isClosed}
                    submitting={submitting}
                    onCancel={handleCancelOrder}
                  />
                ) : isClosed ? (
                  <p className="text-gray-400 text-sm">点餐已截止，未下单</p>
                ) : (
                  <MenuItemList
                    meal={meal}
                    quantities={quantities}
                    total={calcTotal(meal)}
                    submitting={submitting}
                    onUpdateQuantity={updateQuantity}
                    onSubmit={() => handleSubmitOrder(meal)}
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

function OrderDetail({
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
  const total = order.items.reduce(
    (sum, item) => sum + item.menuItem.price * item.quantity,
    0
  );

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-orange-50 p-4">
        <p className="text-sm font-medium text-orange-700 mb-2">✅ 已下单</p>
        {order.items.map((item) => (
          <div
            key={item.id}
            className="flex justify-between text-sm text-gray-700 py-1"
          >
            <span>
              {item.menuItem.name} × {item.quantity}
            </span>
            <span className="text-orange-600 font-medium">
              ¥{(item.menuItem.price * item.quantity).toFixed(1)}
            </span>
          </div>
        ))}
        <div className="mt-2 pt-2 border-t border-orange-200 flex justify-between text-sm font-semibold">
          <span>合计</span>
          <span className="text-orange-700">¥{total.toFixed(1)}</span>
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

function MenuItemList({
  meal,
  quantities,
  total,
  submitting,
  onUpdateQuantity,
  onSubmit,
}: {
  meal: MealData;
  quantities: Record<number, number>;
  total: number;
  submitting: string | null;
  onUpdateQuantity: (id: number, delta: number) => void;
  onSubmit: () => void;
}) {
  const hasSelection = meal.items.some((item) => (quantities[item.id] || 0) > 0);

  return (
    <div className="space-y-3">
      {meal.items.map((item) => {
        const qty = quantities[item.id] || 0;
        return (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-gray-800">{item.name}</span>
                <span className="text-sm text-orange-600 font-medium">
                  ¥{item.price.toFixed(1)}
                </span>
              </div>
              {item.description && (
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {item.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={() => onUpdateQuantity(item.id, -1)}
                disabled={qty === 0}
                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                −
              </button>
              <span className="w-6 text-center text-sm font-medium text-gray-800">
                {qty}
              </span>
              <button
                onClick={() => onUpdateQuantity(item.id, 1)}
                className="w-8 h-8 rounded-full border border-orange-300 bg-orange-50 flex items-center justify-center text-orange-600 hover:bg-orange-100 transition-colors"
              >
                +
              </button>
            </div>
          </div>
        );
      })}

      {hasSelection && (
        <div className="flex justify-between items-center pt-2 text-sm font-semibold text-gray-700">
          <span>合计</span>
          <span className="text-orange-700">¥{total.toFixed(1)}</span>
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={!hasSelection || submitting === meal.menu.mealType}
        className="w-full rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-orange-500 transition-colors"
      >
        {submitting === meal.menu.mealType ? "提交中..." : "提交订单"}
      </button>
    </div>
  );
}

