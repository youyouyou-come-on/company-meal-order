"use client";

import AdminAccessGate from "@/components/AdminAccessGate";
import EmployeeManagementPanel from "@/components/EmployeeManagementPanel";
import { UsersThree } from "@phosphor-icons/react";

export default function EmployeesPage() {
  return (
    <AdminAccessGate>
      <div className="min-h-screen bg-[#f7f5ef]">
        <main className="page-enter mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="mb-6 rounded-2xl bg-[#151515] px-6 py-6 text-white shadow-xl sm:px-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f5c518] text-[#151515]">
              <UsersThree size={27} weight="fill" aria-hidden="true" />
            </div>
            <p className="mt-5 text-xs font-black tracking-[0.24em] text-[#f5c518]">EMPLOYEE CENTER</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">员工管理</h1>
            <p className="mt-2 text-sm font-bold text-stone-400">
              新增正式员工、停用离职员工，点餐历史会继续保留。
            </p>
          </div>

          <EmployeeManagementPanel />
        </main>
      </div>
    </AdminAccessGate>
  );
}
