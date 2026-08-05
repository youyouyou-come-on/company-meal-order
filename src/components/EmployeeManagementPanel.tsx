"use client";

import { useCallback, useEffect, useState } from "react";
import { FloppyDisk, MagnifyingGlass, SpinnerGap, UserPlus } from "@phosphor-icons/react";

interface Employee {
  id: number;
  name: string;
  dingtalkUserId: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function EmployeeManagementPanel() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newEmployeeDingtalkUserId, setNewEmployeeDingtalkUserId] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [dingtalkUserIdEdits, setDingtalkUserIdEdits] = useState<Record<number, string>>({});
  const [employeeMessage, setEmployeeMessage] = useState("");
  const [employeeError, setEmployeeError] = useState("");
  const [employeeSaving, setEmployeeSaving] = useState(false);
  const [employeeUpdatingId, setEmployeeUpdatingId] = useState<number | null>(null);

  const activeEmployeeCount = employees.filter((employee) => employee.isActive).length;
  const inactiveEmployeeCount = employees.length - activeEmployeeCount;
  const normalizedSearch = employeeSearch.trim().toLowerCase();
  const visibleEmployees = normalizedSearch
    ? employees.filter(
        (employee) =>
          employee.name.toLowerCase().includes(normalizedSearch) ||
          (employee.dingtalkUserId || "").toLowerCase().includes(normalizedSearch)
      )
    : employees;

  const fetchEmployees = useCallback(async () => {
    setEmployeesLoading(true);
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await response.json();
      const users = (data.users || []) as Employee[];
      setEmployees(users);
      setDingtalkUserIdEdits(
        Object.fromEntries(
          users.map((employee) => [employee.id, employee.dingtalkUserId || ""])
        )
      );
    } catch {
      setEmployees([]);
    } finally {
      setEmployeesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const addEmployee = async () => {
    const name = newEmployeeName.trim();
    if (!name) {
      setEmployeeError("请输入员工姓名");
      return;
    }

    setEmployeeSaving(true);
    setEmployeeMessage("");
    setEmployeeError("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          dingtalkUserId: newEmployeeDingtalkUserId.trim() || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setEmployeeError(data.error || "保存员工失败");
        return;
      }
      setNewEmployeeName("");
      setNewEmployeeDingtalkUserId("");
      setEmployeeMessage(data.restored ? "员工已重新启用" : "员工已添加");
      await fetchEmployees();
    } catch {
      setEmployeeError("保存员工失败");
    } finally {
      setEmployeeSaving(false);
    }
  };

  const saveDingtalkUserId = async (employee: Employee) => {
    setEmployeeUpdatingId(employee.id);
    setEmployeeMessage("");
    setEmployeeError("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: employee.id,
          dingtalkUserId: dingtalkUserIdEdits[employee.id]?.trim() || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setEmployeeError(data.error || "更新钉钉 UserId 失败");
        return;
      }
      setEmployeeMessage(data.user.dingtalkUserId ? "钉钉 UserId 已保存" : "钉钉 UserId 已清空");
      await fetchEmployees();
    } catch {
      setEmployeeError("更新钉钉 UserId 失败");
    } finally {
      setEmployeeUpdatingId(null);
    }
  };

  const toggleEmployee = async (employee: Employee) => {
    setEmployeeUpdatingId(employee.id);
    setEmployeeMessage("");
    setEmployeeError("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: employee.id, isActive: !employee.isActive }),
      });
      const data = await response.json();
      if (!response.ok) {
        setEmployeeError(data.error || "更新员工失败");
        return;
      }
      setEmployeeMessage(data.user.isActive ? "员工已启用" : "员工已停用");
      await fetchEmployees();
    } catch {
      setEmployeeError("更新员工失败");
    } finally {
      setEmployeeUpdatingId(null);
    }
  };

  return (
    <section
      data-testid="admin-employee-panel"
      className="rounded-2xl border border-stone-300 bg-white p-5 shadow-[0_16px_40px_rgba(21,21,21,0.08)] print:hidden sm:p-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black tracking-[0.24em] text-[#866800]">EMPLOYEES</p>
          <h2 className="mt-2 text-2xl font-black text-stone-900">员工管理</h2>
          <p className="mt-2 text-sm font-semibold text-stone-500">
            新同事直接在这里添加；离职或误加的员工先停用，历史点餐记录会保留。
          </p>
        </div>
        <div className="flex gap-3 rounded-xl bg-[#151515] px-4 py-3 text-sm font-black text-white">
          <span>启用 {activeEmployeeCount} 人</span>
          <span className="text-stone-600">/</span>
          <span className="text-[#f5c518]">停用 {inactiveEmployeeCount} 人</span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <input
          value={newEmployeeName}
          data-testid="admin-employee-name-input"
          onChange={(event) => setNewEmployeeName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && newEmployeeName.trim() && !employeeSaving) {
              addEmployee();
            }
          }}
          placeholder="输入员工姓名，如：郭丽阳"
          className="ui-focus min-h-12 min-w-0 flex-1 rounded-xl border border-stone-300 bg-stone-50 px-4 text-sm font-bold text-stone-900 focus:border-[#f5c518] focus:bg-white focus:outline-none"
        />
        <input
          value={newEmployeeDingtalkUserId}
          data-testid="admin-employee-new-dingtalk-input"
          onChange={(event) => setNewEmployeeDingtalkUserId(event.target.value)}
          placeholder="钉钉 UserId，可稍后补"
          className="ui-focus min-h-12 min-w-0 flex-1 rounded-xl border border-stone-300 bg-stone-50 px-4 text-sm font-bold text-stone-900 focus:border-[#f5c518] focus:bg-white focus:outline-none"
        />
        <button
          type="button"
          data-testid="admin-employee-add"
          onClick={addEmployee}
          disabled={employeeSaving || !newEmployeeName.trim()}
          className="gold-button ui-press ui-focus flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black disabled:opacity-50"
        >
          {employeeSaving ? (
            <>
              <SpinnerGap size={19} weight="bold" className="animate-spin" aria-hidden="true" />
              添加中...
            </>
          ) : (
            <>
              <UserPlus size={19} weight="bold" aria-hidden="true" />
              添加员工
            </>
          )}
        </button>
      </div>

      {employeeMessage && (
        <p role="status" className="status-pop mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {employeeMessage}
        </p>
      )}
      {employeeError && (
        <p role="alert" className="status-pop mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {employeeError}
        </p>
      )}

      <div className="mt-5 rounded-xl border border-stone-200 bg-stone-50 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <label
              htmlFor="employee-search"
              className="mb-2 flex items-center gap-2 text-xs font-black tracking-[0.12em] text-stone-500"
            >
              <MagnifyingGlass size={16} weight="bold" aria-hidden="true" />
              查询员工
            </label>
            <input
              id="employee-search"
              value={employeeSearch}
              data-testid="admin-employee-search-input"
              onChange={(event) => setEmployeeSearch(event.target.value)}
              placeholder="输入姓名快速查询，如：张小龙"
              className="ui-focus min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-sm font-bold text-stone-900 focus:border-[#f5c518] focus:outline-none"
            />
          </div>
          <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
            <div
              data-testid="admin-employee-search-count"
              className="text-sm font-bold text-stone-500"
            >
              显示 {visibleEmployees.length} / {employees.length} 人
            </div>
            {employeeSearch ? (
              <button
                type="button"
                data-testid="admin-employee-search-clear"
                onClick={() => setEmployeeSearch("")}
                className="outline-button ui-press ui-focus min-h-10 rounded-xl px-3 text-xs font-black"
              >
                清空查询
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div
        data-testid="admin-employee-list"
        className="mt-5 grid max-h-[360px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3"
      >
          {employeesLoading ? (
          <p className="flex items-center gap-2 text-sm font-bold text-stone-400">
            <SpinnerGap size={18} weight="bold" className="animate-spin" aria-hidden="true" />
            员工加载中...
          </p>
        ) : visibleEmployees.length > 0 ? (
          visibleEmployees.map((employee) => (
            <div
              key={employee.id}
              data-testid="admin-employee-row"
              className="rounded-xl border border-stone-200 bg-white px-4 py-3 transition-colors hover:border-stone-300 hover:bg-stone-50"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-stone-900">{employee.name}</div>
                  <div
                    className={
                      employee.isActive
                        ? "mt-1 text-xs font-bold text-emerald-600"
                        : "mt-1 text-xs font-bold text-stone-400"
                    }
                  >
                    {employee.isActive ? "可登录" : "已停用"}
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="admin-employee-toggle"
                  onClick={() => toggleEmployee(employee)}
                  disabled={employeeUpdatingId === employee.id}
                  className={
                    employee.isActive
                      ? "danger-button ui-press ui-focus min-h-10 shrink-0 rounded-xl px-3 text-xs font-black disabled:opacity-50"
                      : "ui-press ui-focus min-h-10 shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  }
                >
                  {employeeUpdatingId === employee.id
                    ? "处理中"
                    : employee.isActive
                      ? "停用"
                      : "启用"}
                </button>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                <label className="text-xs font-black tracking-[0.14em] text-stone-400">
                  钉钉 UserId
                </label>
                <div className="flex gap-2">
                  <input
                    value={dingtalkUserIdEdits[employee.id] || ""}
                    data-testid="admin-employee-dingtalk-input"
                    onChange={(event) =>
                      setDingtalkUserIdEdits((current) => ({
                        ...current,
                        [employee.id]: event.target.value,
                      }))
                    }
                    placeholder="未绑定"
                    className="ui-focus min-h-10 min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 text-xs font-bold text-stone-900 focus:border-[#f5c518] focus:outline-none"
                  />
                  <button
                    type="button"
                    data-testid="admin-employee-dingtalk-save"
                    onClick={() => saveDingtalkUserId(employee)}
                    disabled={
                      employeeUpdatingId === employee.id ||
                      (dingtalkUserIdEdits[employee.id] || "").trim() ===
                        (employee.dingtalkUserId || "")
                    }
                    className="gold-button ui-press ui-focus flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-black disabled:opacity-50"
                  >
                    <FloppyDisk size={15} weight="bold" aria-hidden="true" />
                    保存
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p
            data-testid="admin-employee-search-empty"
            className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center text-sm font-bold text-stone-400 sm:col-span-2 xl:col-span-3"
          >
            没有找到匹配的员工
          </p>
        )}
      </div>
    </section>
  );
}
