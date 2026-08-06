"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BowlFood,
  CalendarBlank,
  Copy,
  DownloadSimple,
  ListBullets,
  MoonStars,
  Printer,
  SpinnerGap,
  Trash,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import AdminAccessGate from "@/components/AdminAccessGate";
import {
  addBusinessDays,
  businessDateToUtcDate,
  formatDateLabel,
  formatMenuExportFilename,
  getBusinessDateWeekday,
  getChinaWeekDates,
  getChinaWeekStart,
} from "@/lib/china-date";

interface Menu {
  id: number;
  date: string;
  mealType: string;
  dishes: string;
}

interface ImportStatus {
  type: "success" | "error";
  message: string;
}

interface DeleteTarget {
  date: string;
  mealType: string;
}

function getMondayDate(offset: number): string {
  return getChinaWeekStart(new Date(), offset);
}

function formatDate(dateStr: string): string {
  return dateStr;
}

function getWeekDates(monday: string): string[] {
  return getChinaWeekDates(0, 6, businessDateToUtcDate(monday));
}

export default function AdminPage() {
  return (
    <AdminAccessGate>
      <AdminMenuContent />
    </AdminAccessGate>
  );
}

function AdminMenuContent() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [notice, setNotice] = useState<ImportStatus | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  const dateInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const monday = getMondayDate(weekOffset);
  const weekDates = getWeekDates(monday);
  const saturdayDate = weekDates[5];
  const weekLabel = `${weekDates[0]} ~ ${saturdayDate}`;

  function handleDatePick(dateStr: string) {
    const pickedDay = getBusinessDateWeekday(dateStr);
    const diffToMonday = pickedDay === 0 ? -6 : 1 - pickedDay;
    const pickedMonday = addBusinessDays(dateStr, diffToMonday);
    const currentMonday = getChinaWeekStart();
    const diffWeeks = Math.round(
      (businessDateToUtcDate(pickedMonday).getTime() -
        businessDateToUtcDate(currentMonday).getTime()) /
        (7 * 24 * 60 * 60 * 1000)
    );
    setWeekOffset(diffWeeks);
  }

  const fetchMenus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/menus?weekStart=${formatDate(monday)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      setMenus(data.menus || []);
    } catch {
      setMenus([]);
    } finally {
      setLoading(false);
    }
  }, [weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchMenus();
  }, [fetchMenus]);

  useEffect(() => {
    if (!deleteTarget) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDeleteTarget(null);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [deleteTarget]);

  const getMenu = (date: string, mealType: string) =>
    menus.find((m) => m.date === date && m.mealType === mealType);

  const editKey = (date: string, mealType: string) => `${date}-${mealType}`;

  const startEdit = (date: string, mealType: string) => {
    const menu = getMenu(date, mealType);
    setEditingKey(editKey(date, mealType));
    setEditValue(menu?.dishes || "");
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
  };

  const saveMenu = async (date: string, mealType: string) => {
    if (!editValue.trim()) return;
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/menus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, mealType, dishes: editValue.trim() }),
      });
      if (!response.ok) throw new Error("save failed");
      await fetchMenus();
      setEditingKey(null);
      setEditValue("");
      setNotice({ type: "success", message: "菜单已保存" });
    } catch {
      setNotice({ type: "error", message: "保存失败，请重试" });
    } finally {
      setSaving(false);
    }
  };

  const deleteMenu = (date: string, mealType: string) => {
    setDeleteTarget({ date, mealType });
  };

  const confirmDeleteMenu = async () => {
    if (!deleteTarget) return;
    setNotice(null);
    setDeleting(true);
    try {
      const response = await fetch("/api/admin/menus", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deleteTarget),
      });
      if (!response.ok) throw new Error("delete failed");
      await fetchMenus();
      setDeleteTarget(null);
      setNotice({ type: "success", message: "菜单已删除" });
    } catch {
      setNotice({ type: "error", message: "删除失败，请重试" });
    } finally {
      setDeleting(false);
    }
  };

  const copyLastWeek = async () => {
    setCopyLoading(true);
    setNotice(null);
    try {
      const lastMonday = getMondayDate(weekOffset - 1);
      const res = await fetch(`/api/admin/menus?weekStart=${formatDate(lastMonday)}`);
      const data = await res.json();
      const lastMenus: Menu[] = data.menus || [];
      if (lastMenus.length === 0) {
        setNotice({ type: "error", message: "上周没有菜单可复制" });
        return;
      }
      const lastWeekDates = getWeekDates(lastMonday);
      for (const m of lastMenus) {
        const dayIndex = lastWeekDates.indexOf(m.date);
        if (dayIndex === -1) continue;
        const newDate = weekDates[dayIndex];
        await fetch("/api/admin/menus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: newDate, mealType: m.mealType, dishes: m.dishes }),
        });
      }
      await fetchMenus();
      setNotice({ type: "success", message: "上周菜单已复制到当前周" });
    } catch {
      setNotice({ type: "error", message: "复制失败，请重试" });
    } finally {
      setCopyLoading(false);
    }
  };

  const importMenus = async (file: File) => {
    setImporting(true);
    setImportStatus(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/menus/import", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        setImportStatus({ type: "error", message: data.error || "导入失败" });
        return;
      }

      await fetchMenus();
      setImportStatus({
        type: "success",
        message: `导入成功，共新增或更新 ${data.importedCount} 条菜单`,
      });
    } catch {
      setImportStatus({ type: "error", message: "导入失败，请检查网络后重试" });
    } finally {
      setImporting(false);
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      <main className="page-enter mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        <div className="mb-6 rounded-2xl bg-[#151515] px-6 py-6 text-white shadow-xl print:hidden sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f5c518] text-[#151515]">
                <ListBullets size={27} weight="fill" aria-hidden="true" />
              </div>
              <p className="mt-5 text-xs font-black tracking-[0.24em] text-[#f5c518]">MENU BOARD</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">管理菜单</h1>
              <p className="mt-2 text-sm font-bold text-stone-400">
                一页看完周一到周六，截图、打印、发给阿姨都会更清楚。
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-left lg:text-right">
              <div className="text-xs font-black tracking-[0.2em] text-stone-500">当前周</div>
              <div className="mt-2 text-xl font-black leading-none text-[#f5c518] sm:text-2xl">{weekLabel}</div>
            </div>
          </div>
        </div>

        <div className="mb-4 hidden rounded-[24px] border border-stone-300 bg-white px-5 py-4 print:block">
          <div className="text-center">
            <div className="text-xs font-bold tracking-[0.3em] text-stone-500">COMPANY MEAL MENU</div>
            <h1 className="mt-2 text-3xl font-black text-stone-900">食堂周菜单</h1>
            <p className="mt-2 text-base font-semibold text-stone-600">{weekLabel}</p>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-stone-300 bg-white p-4 shadow-[0_16px_40px_rgba(21,21,21,0.08)] print:hidden">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-3">
              <button
                onClick={() => setWeekOffset((o) => o - 1)}
                aria-label="← 上一周"
                className="outline-button ui-press ui-focus flex h-12 w-12 items-center justify-center rounded-xl sm:w-auto sm:px-4"
              >
                <ArrowLeft size={20} weight="bold" aria-hidden="true" />
                <span className="hidden text-sm font-black sm:ml-2 sm:inline">上一周</span>
              </button>
              <span className="flex min-h-12 min-w-0 items-center justify-center gap-1 rounded-xl bg-stone-100 px-2 text-center text-xs font-black text-stone-700 sm:px-4 sm:text-sm">
                <span className="truncate">{weekLabel}</span>
                <button
                  onClick={() => dateInputRef.current?.showPicker()}
                  className="ui-press ui-focus ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-white"
                  title="选择日期"
                  aria-label="选择日期"
                >
                  <CalendarBlank size={19} weight="bold" aria-hidden="true" />
                </button>
                <input
                  ref={dateInputRef}
                  type="date"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.value) {
                      handleDatePick(e.target.value);
                      e.target.value = "";
                    }
                  }}
                />
              </span>
              <button
                onClick={() => setWeekOffset((o) => o + 1)}
                aria-label="下一周 →"
                className="outline-button ui-press ui-focus flex h-12 w-12 items-center justify-center rounded-xl sm:w-auto sm:px-4"
              >
                <span className="hidden text-sm font-black sm:mr-2 sm:inline">下一周</span>
                <ArrowRight size={20} weight="bold" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center xl:justify-end">
              {weekOffset !== 0 && (
                <button
                  onClick={() => setWeekOffset(0)}
                  className="ui-press ui-focus min-h-12 rounded-xl bg-stone-100 px-4 text-sm font-black text-stone-700 hover:bg-stone-200"
                >
                  回到本周
                </button>
              )}
              <button
                onClick={copyLastWeek}
                disabled={copyLoading}
                className="gold-button ui-press ui-focus flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black disabled:opacity-50"
              >
                {copyLoading ? (
                  <SpinnerGap size={18} weight="bold" className="animate-spin" aria-hidden="true" />
                ) : (
                  <Copy size={18} weight="bold" aria-hidden="true" />
                )}
                {copyLoading ? "复制中..." : "复制上周菜单"}
              </button>
              <a
                href={`/api/admin/menus/export?weekStart=${encodeURIComponent(monday)}`}
                download={formatMenuExportFilename(monday, saturdayDate)}
                data-testid="admin-menu-export"
                className="outline-button ui-press ui-focus flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black"
              >
                <DownloadSimple size={18} weight="bold" aria-hidden="true" />
                导出本周 Excel
              </a>
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                disabled={importing}
                data-testid="admin-menu-import-trigger"
                className="ui-press ui-focus flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-sm font-black text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importing ? (
                  <SpinnerGap size={18} weight="bold" className="animate-spin" aria-hidden="true" />
                ) : (
                  <UploadSimple size={18} weight="bold" aria-hidden="true" />
                )}
                {importing ? "导入中..." : "导入菜单文件"}
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                data-testid="admin-menu-import-input"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importMenus(file);
                }}
              />
              <button
                type="button"
                onClick={() => window.print()}
                className="ink-button ui-press ui-focus flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black"
              >
                <Printer size={18} weight="bold" aria-hidden="true" />
                打印本页
              </button>
            </div>
          </div>
          <div className="mt-4 border-t border-stone-100 pt-4">
            <p className="text-xs font-medium leading-6 text-stone-500">
              导出的 Excel 是适合打印的横向一周菜单，填写后可以直接导入；也兼容原三列表格和 CSV，并支持在同一文件中填写下周和后续周日期。导入会新增或覆盖同日期同餐次菜单，空白菜品不会删除原菜单。
            </p>
            {notice && (
              <p
                role="status"
                className={`status-pop mt-2 text-sm font-black ${
                  notice.type === "success" ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {notice.message}
              </p>
            )}
            {importStatus && (
              <p
                role="status"
                data-testid="admin-menu-import-status"
                className={`mt-2 text-sm font-bold ${
                  importStatus.type === "success" ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {importStatus.message}
              </p>
            )}
          </div>
        </div>

        {/* Weekly layout */}
        {loading ? (
          <p className="py-8 text-center text-gray-400">加载中...</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-stone-300 bg-white shadow-[0_16px_40px_rgba(21,21,21,0.1)] print:overflow-visible print:rounded-[24px] print:border-stone-400 print:shadow-none">
            <div
              data-testid="admin-week-grid"
              className="grid min-w-[1180px] grid-cols-[132px_repeat(6,minmax(174px,1fr))] print:min-w-0 print:grid-cols-[110px_repeat(6,minmax(0,1fr))]"
            >
              <div className="border-b border-r border-stone-300 bg-[#151515] px-4 py-5 text-center text-sm font-black tracking-[0.16em] text-white print:px-2 print:py-4">
                餐次
              </div>
              {weekDates.map((dateStr) => {
                const { dayLabel, shortDate } = formatDateLabel(dateStr);
                return (
                  <div
                    key={`header-${dateStr}`}
                    data-testid={`admin-day-${dateStr}`}
                    className="border-b border-stone-300 bg-stone-50 px-4 py-5 text-center print:px-2 print:py-4"
                  >
                    <div className="text-xl font-black tracking-tight text-stone-900 print:text-lg">{dayLabel}</div>
                    <div className="mt-1 text-sm font-bold text-stone-500 print:text-xs">{shortDate}</div>
                  </div>
                );
              })}

              <div className="border-r border-stone-300 bg-[#fff9dc] px-4 py-8 text-center print:px-2">
                <BowlFood size={36} weight="fill" className="mx-auto text-[#151515]" aria-hidden="true" />
                <div className="mt-3 text-lg font-black text-stone-900 print:text-base">午餐</div>
                <div className="mt-1 text-xs font-bold tracking-[0.2em] text-[#6e5500]">LUNCH</div>
              </div>
              {weekDates.map((dateStr) => (
                <MealSlot
                  key={`lunch-${dateStr}`}
                  label="午餐"
                  date={dateStr}
                  mealType="lunch"
                  menu={getMenu(dateStr, "lunch")}
                  isEditing={editingKey === editKey(dateStr, "lunch")}
                  editValue={editValue}
                  saving={saving}
                  onEditValueChange={setEditValue}
                  onStartEdit={() => startEdit(dateStr, "lunch")}
                  onSave={() => saveMenu(dateStr, "lunch")}
                  onCancel={cancelEdit}
                  onDelete={() => deleteMenu(dateStr, "lunch")}
                />
              ))}

              <div className="border-r border-t border-stone-300 bg-stone-100 px-4 py-8 text-center print:px-2">
                <MoonStars size={36} weight="fill" className="mx-auto text-[#151515]" aria-hidden="true" />
                <div className="mt-3 text-lg font-black text-stone-900 print:text-base">晚餐</div>
                <div className="mt-1 text-xs font-bold tracking-[0.2em] text-stone-600">DINNER</div>
              </div>
              {weekDates.map((dateStr) => (
                <MealSlot
                  key={`dinner-${dateStr}`}
                  label="晚餐"
                  date={dateStr}
                  mealType="dinner"
                  menu={getMenu(dateStr, "dinner")}
                  isEditing={editingKey === editKey(dateStr, "dinner")}
                  editValue={editValue}
                  saving={saving}
                  onEditValueChange={setEditValue}
                  onStartEdit={() => startEdit(dateStr, "dinner")}
                  onSave={() => saveMenu(dateStr, "dinner")}
                  onCancel={cancelEdit}
                  onDelete={() => deleteMenu(dateStr, "dinner")}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {deleteTarget ? (
        <div
          className="modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-4"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-menu-title"
            className="modal-panel w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#1d1d1b] text-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h2 id="delete-menu-title" className="text-xl font-black">删除菜单</h2>
                <p className="mt-2 text-sm font-bold leading-6 text-stone-400">
                  确定删除 {deleteTarget.date} 的{deleteTarget.mealType === "lunch" ? "午餐" : "晚餐"}菜单？
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                aria-label="关闭删除确认"
                className="ui-press ui-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-stone-300 hover:bg-white/10 disabled:opacity-50"
              >
                <X size={21} weight="bold" aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 p-5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="ui-press ui-focus min-h-12 rounded-xl border border-white/20 bg-white/5 text-sm font-black text-white hover:bg-white/10 disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmDeleteMenu}
                disabled={deleting}
                className="ui-press ui-focus flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-500 text-sm font-black text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? (
                  <SpinnerGap size={18} weight="bold" className="animate-spin" aria-hidden="true" />
                ) : (
                  <Trash size={18} weight="bold" aria-hidden="true" />
                )}
                {deleting ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}



interface MealSlotProps {
  label: string;
  date: string;
  mealType: string;
  menu: Menu | undefined;
  isEditing: boolean;
  editValue: string;
  saving: boolean;
  onEditValueChange: (v: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

function MealSlot({
  label,
  date,
  mealType,
  menu,
  isEditing,
  editValue,
  saving,
  onEditValueChange,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
}: MealSlotProps) {
  const MealIcon = mealType === "lunch" ? BowlFood : MoonStars;

  if (isEditing) {
    return (
      <div
        data-testid={`meal-slot-${date}-${mealType}`}
        className="content-swap min-h-[220px] border-r border-t border-stone-300 bg-[#fffdf5] p-4 print:min-h-[180px] print:p-3"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-black tracking-[0.08em] text-stone-700">
            <span className="flex items-center gap-2">
              <MealIcon size={18} weight="fill" aria-hidden="true" />
              {label}
            </span>
          </div>
          <div className="rounded-lg bg-[#151515] px-3 py-1 text-xs font-bold text-[#f5c518]">
            正在编辑
          </div>
        </div>
        <textarea
          value={editValue}
          data-testid={`meal-editor-${date}-${mealType}`}
          onChange={(e) => onEditValueChange(e.target.value)}
          className="ui-focus min-h-[110px] w-full rounded-xl border border-stone-300 bg-white p-3 text-sm font-bold leading-7 text-stone-800 focus:border-[#f5c518] focus:outline-none print:min-h-[90px] print:text-xs"
          rows={4}
          placeholder="输入菜品，如：红烧肉、清炒时蔬、番茄蛋汤"
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={onSave}
            data-testid={`meal-save-${date}-${mealType}`}
            disabled={saving || !editValue.trim()}
            className="gold-button ui-press ui-focus min-h-10 rounded-xl px-4 text-xs font-black disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
          <button
            onClick={onCancel}
            className="outline-button ui-press ui-focus min-h-10 rounded-xl px-4 text-xs font-black"
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid={`meal-slot-${date}-${mealType}`}
      className="group flex min-h-[220px] cursor-pointer flex-col justify-between border-r border-t border-stone-300 bg-white p-4 transition-colors hover:bg-[#fff9dc]/50 print:min-h-[180px] print:p-3"
      onClick={onStartEdit}
    >
      <div className="flex-1">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-black tracking-[0.08em] text-stone-700">
            <span className="flex items-center gap-2">
              <MealIcon size={18} weight="fill" aria-hidden="true" />
              {label}
            </span>
          </div>
          {menu && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              aria-label={`删除${date}${label}菜单`}
              className="danger-button ui-press ui-focus flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-black opacity-100 sm:opacity-0 sm:group-hover:opacity-100 print:hidden"
            >
              <Trash size={15} weight="bold" aria-hidden="true" />
              删除
            </button>
          )}
        </div>
        {menu ? (
          <p
            data-testid={`meal-dishes-${date}-${mealType}`}
            className="whitespace-pre-wrap text-[15px] leading-8 text-stone-700 print:text-xs print:leading-6"
          >
            {menu.dishes}
          </p>
        ) : (
          <div className="flex h-full min-h-[96px] items-center justify-center rounded-xl border border-dashed border-stone-300 bg-stone-50 text-center text-sm font-bold text-stone-400 print:min-h-[80px] print:text-xs">
            点击添加菜单
          </div>
        )}
      </div>
      <div className="mt-4 text-xs font-bold tracking-[0.12em] text-[#6e5500] print:hidden">
        点击本格即可编辑
      </div>
    </div>
  );
}
