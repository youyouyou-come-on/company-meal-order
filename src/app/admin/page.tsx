"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";

/* ───── Types ───── */

interface MenuItem {
  id?: number;
  name: string;
  price: number;
  description?: string | null;
}

interface DailyMenu {
  id: number;
  date: string;
  mealType: string;
  items: MenuItem[];
  _count?: { orders: number };
}

interface ItemSummary {
  menuItemId: number;
  name: string;
  price: number;
  totalQuantity: number;
  subtotal: number;
}

interface UserOrder {
  orderId: number;
  userName: string;
  items: { name: string; price: number; quantity: number }[];
  total: number;
}

interface OrderSummary {
  menu: { id: number; date: string; mealType: string } | null;
  itemSummary: ItemSummary[];
  userOrders: UserOrder[];
  totalOrders: number;
  totalItems: number;
}

/* ───── Helpers ───── */

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mealLabel(t: string) {
  return t === "lunch" ? "午餐" : "晚餐";
}

/* ───── Main Page ───── */

export default function AdminPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const router = useRouter();
  const [tab, setTab] = useState<"menus" | "orders">("menus");

  useEffect(() => {
    if (!userLoading && (!user || user.role !== "admin")) {
      router.push(user ? "/" : "/login");
    }
  }, [user, userLoading, router]);

  if (userLoading) {
    return (
      <div className="min-h-screen bg-orange-50/30 flex items-center justify-center">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  if (!user || user.role !== "admin") return null;

  return (
    <div className="min-h-screen bg-orange-50/30">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-2xl font-bold text-gray-800">⚙️ 管理后台</h1>

        {/* Tab bar */}
        <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1">
          {(["menus", "orders"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-white text-orange-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "menus" ? "📋 菜单管理" : "📊 订单汇总"}
            </button>
          ))}
        </div>

        {tab === "menus" ? <MenuManagement /> : <OrderSummaryTab />}
      </main>
    </div>
  );
}

/* ───── Menu Management Tab ───── */

function MenuManagement() {
  const [date, setDate] = useState(todayStr());
  const [menus, setMenus] = useState<DailyMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingMenu, setEditingMenu] = useState<DailyMenu | null>(null);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchMenus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/menus?date=${date}`);
      const data = await res.json();
      setMenus(data.menus || []);
    } catch {
      setMsg({ type: "error", text: "加载菜单失败" });
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchMenus();
  }, [fetchMenus]);

  async function handleDelete(menuId: number) {
    if (!confirm("确定要删除此菜单？关联的订单也会被删除。")) return;
    try {
      const res = await fetch(`/api/admin/menus/${menuId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        setMsg({ type: "error", text: d.error || "删除失败" });
        return;
      }
      setMsg({ type: "success", text: "菜单已删除" });
      fetchMenus();
    } catch {
      setMsg({ type: "error", text: "网络错误" });
    }
  }

  async function handleCopyPrev() {
    const prev = new Date(date);
    prev.setDate(prev.getDate() - 1);
    const fromDate = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`;
    try {
      const res = await fetch("/api/admin/menus/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromDate, toDate: date }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: "error", text: data.error || "复制失败" });
        return;
      }
      setMsg({ type: "success", text: data.message });
      fetchMenus();
    } catch {
      setMsg({ type: "error", text: "网络错误" });
    }
  }

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
        />
        <button
          onClick={() => { setShowCreate(true); setEditingMenu(null); }}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
        >
          + 发布新菜单
        </button>
        <button
          onClick={handleCopyPrev}
          className="rounded-lg border border-orange-300 bg-white px-4 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50 transition-colors"
        >
          📋 复制前一天菜单
        </button>
      </div>

      {msg && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
            msg.type === "success"
              ? "bg-green-100 text-green-700 border border-green-200"
              : "bg-red-100 text-red-700 border border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">加载中...</p>
      ) : menus.length === 0 ? (
        <div className="rounded-xl bg-gray-100 p-6 text-center text-gray-500 text-sm">
          该日期暂无菜单
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {menus.map((menu) => (
            <div
              key={menu.id}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-800">
                  {menu.mealType === "lunch" ? "🍱 午餐" : "🌙 晚餐"}
                </h3>
                <div className="flex items-center gap-2">
                  {menu._count && (
                    <span className="text-xs text-gray-400">
                      {menu._count.orders} 份订单
                    </span>
                  )}
                  <button
                    onClick={() => { setEditingMenu(menu); setShowCreate(false); }}
                    className="rounded-md px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(menu.id)}
                    className="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {menu.items.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                  >
                    <span className="text-gray-700">{item.name}</span>
                    <span className="font-medium text-orange-600">¥{item.price}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {(showCreate || editingMenu) && (
        <MenuFormModal
          date={date}
          editMenu={editingMenu}
          existingMealTypes={menus.map((m) => m.mealType)}
          onClose={() => { setShowCreate(false); setEditingMenu(null); }}
          onSaved={() => {
            setShowCreate(false);
            setEditingMenu(null);
            setMsg({ type: "success", text: editingMenu ? "菜单已更新" : "菜单已创建" });
            fetchMenus();
          }}
        />
      )}
    </div>
  );
}

/* ───── Menu Form Modal ───── */

function MenuFormModal({
  date,
  editMenu,
  existingMealTypes,
  onClose,
  onSaved,
}: {
  date: string;
  editMenu: DailyMenu | null;
  existingMealTypes: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const availableMealTypes = (["lunch", "dinner"] as const).filter(
    (t) => !existingMealTypes.includes(t)
  );
  const [mealType, setMealType] = useState<"lunch" | "dinner">(
    (editMenu?.mealType as "lunch" | "dinner") || availableMealTypes[0] || "lunch"
  );
  const [items, setItems] = useState<MenuItem[]>(
    editMenu
      ? editMenu.items.map((i) => ({ name: i.name, price: i.price, description: i.description || "" }))
      : [{ name: "", price: 0, description: "" }]
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function updateItem(idx: number, field: keyof MenuItem, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  }

  function addItem() {
    setItems((prev) => [...prev, { name: "", price: 0, description: "" }]);
  }

  function removeItem(idx: number) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    const validItems = items.filter((i) => i.name.trim());
    if (validItems.length === 0) {
      setError("请至少添加一道菜品");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const payload = validItems.map((i) => ({
        name: i.name.trim(),
        price: Number(i.price),
        description: i.description?.trim() || undefined,
      }));

      let res: Response;
      if (editMenu) {
        res = await fetch(`/api/admin/menus/${editMenu.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: payload }),
        });
      } else {
        res = await fetch("/api/admin/menus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, mealType, items: payload }),
        });
      }

      if (!res.ok) {
        const d = await res.json();
        if (res.status === 409) {
          setError("该日期和餐次的菜单已存在，请关闭窗口后点击对应菜单的「编辑」按钮来添加菜品");
        } else {
          setError(d.error || "操作失败");
        }
        return;
      }

      onSaved();
    } catch {
      setError("网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="mb-4 text-lg font-bold text-gray-800">
          {editMenu ? `编辑${mealLabel(editMenu.mealType)}菜单` : "发布新菜单"}
        </h2>

        {!editMenu && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">餐次</label>
            {availableMealTypes.length === 0 ? (
              <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                该日期的午餐和晚餐菜单均已创建，请关闭窗口后点击「编辑」按钮来修改菜品
              </p>
            ) : (
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value as "lunch" | "dinner")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
              >
                {availableMealTypes.map((t) => (
                  <option key={t} value={t}>
                    {mealLabel(t)}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="mb-4 space-y-3">
          <label className="block text-sm font-medium text-gray-700">菜品列表</label>
          {items.map((item, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <div className="flex-1 space-y-1">
                <input
                  type="text"
                  placeholder="菜名"
                  value={item.name}
                  onChange={(e) => updateItem(idx, "name", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="价格"
                    value={item.price || ""}
                    onChange={(e) => updateItem(idx, "price", parseFloat(e.target.value) || 0)}
                    className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                  <input
                    type="text"
                    placeholder="描述（可选）"
                    value={item.description || ""}
                    onChange={(e) => updateItem(idx, "description", e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                </div>
              </div>
              <button
                onClick={() => removeItem(idx)}
                disabled={items.length <= 1}
                className="mt-1 rounded-md p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={addItem}
            className="w-full rounded-lg border border-dashed border-gray-300 py-2 text-sm text-gray-500 hover:border-orange-400 hover:text-orange-500 transition-colors"
          >
            + 添加菜品
          </button>
        </div>

        {error && (
          <p className="mb-3 text-sm text-red-600">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || (!editMenu && availableMealTypes.length === 0)}
            className="flex-1 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {submitting ? "提交中..." : editMenu ? "保存修改" : "创建菜单"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───── Order Summary Tab ───── */

function OrderSummaryTab() {
  const [date, setDate] = useState(todayStr());
  const [mealType, setMealType] = useState<"lunch" | "dinner">("lunch");
  const [data, setData] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders?date=${date}&mealType=${mealType}`);
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [date, mealType]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const grandTotal = data?.itemSummary.reduce((s, i) => s + i.subtotal, 0) ?? 0;

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
        />
        <select
          value={mealType}
          onChange={(e) => setMealType(e.target.value as "lunch" | "dinner")}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
        >
          <option value="lunch">午餐</option>
          <option value="dinner">晚餐</option>
        </select>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">加载中...</p>
      ) : !data?.menu ? (
        <div className="rounded-xl bg-gray-100 p-6 text-center text-gray-500 text-sm">
          该日期暂无{mealLabel(mealType)}菜单
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary stats */}
          <div className="flex gap-4">
            <div className="flex-1 rounded-xl bg-orange-50 p-4 text-center">
              <p className="text-2xl font-bold text-orange-600">{data.totalOrders}</p>
              <p className="text-sm text-gray-500">人点餐</p>
            </div>
            <div className="flex-1 rounded-xl bg-blue-50 p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{data.totalItems}</p>
              <p className="text-sm text-gray-500">份菜品</p>
            </div>
            <div className="flex-1 rounded-xl bg-green-50 p-4 text-center">
              <p className="text-2xl font-bold text-green-600">¥{grandTotal.toFixed(0)}</p>
              <p className="text-sm text-gray-500">总金额</p>
            </div>
          </div>

          {/* Item summary table */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <h3 className="px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-gray-200">
              📊 菜品统计
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="px-4 py-2 font-medium">菜名</th>
                  <th className="px-4 py-2 font-medium text-center">数量</th>
                  <th className="px-4 py-2 font-medium text-right">小计</th>
                </tr>
              </thead>
              <tbody>
                {data.itemSummary.map((item) => (
                  <tr key={item.menuItemId} className="border-b border-gray-50">
                    <td className="px-4 py-2 text-gray-700">{item.name}</td>
                    <td className="px-4 py-2 text-center text-gray-600">{item.totalQuantity}</td>
                    <td className="px-4 py-2 text-right font-medium text-orange-600">
                      ¥{item.subtotal.toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-2 text-gray-700">合计</td>
                  <td className="px-4 py-2 text-center text-gray-600">{data.totalItems}</td>
                  <td className="px-4 py-2 text-right text-orange-700">¥{grandTotal.toFixed(0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* User orders */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <h3 className="px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-gray-200">
              👥 点餐人员
            </h3>
            {data.userOrders.length === 0 ? (
              <p className="px-4 py-4 text-sm text-gray-400">暂无订单</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-gray-500">
                    <th className="px-4 py-2 font-medium">姓名</th>
                    <th className="px-4 py-2 font-medium">点的菜品</th>
                    <th className="px-4 py-2 font-medium text-right">金额</th>
                  </tr>
                </thead>
                <tbody>
                  {data.userOrders.map((uo) => (
                    <tr key={uo.orderId} className="border-b border-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-700">{uo.userName}</td>
                      <td className="px-4 py-2 text-gray-600">
                        {uo.items.map((i) => `${i.name}×${i.quantity}`).join("、")}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-orange-600">
                        ¥{uo.total.toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

