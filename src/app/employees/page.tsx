"use client";

import AdminAccessGate from "@/components/AdminAccessGate";
import EmployeeManagementPanel from "@/components/EmployeeManagementPanel";

export default function EmployeesPage() {
  return (
    <AdminAccessGate>
      <div className="min-h-screen bg-stone-100/70">
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="mb-6 rounded-[28px] border border-stone-200 bg-gradient-to-r from-stone-900 via-stone-800 to-amber-700 px-6 py-5 text-white shadow-lg">
            <p className="text-sm font-semibold tracking-[0.28em] text-amber-100">EMPLOYEE CENTER</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">员工管理</h1>
            <p className="mt-2 text-sm font-medium text-stone-100">
              新增正式员工、停用离职员工，点餐历史会继续保留。
            </p>
          </div>

          <EmployeeManagementPanel />
        </main>
      </div>
    </AdminAccessGate>
  );
}
