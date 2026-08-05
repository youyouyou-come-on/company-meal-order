"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKey, SpinnerGap } from "@phosphor-icons/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface AdminAccessGateProps {
  children: ReactNode;
}

export default function AdminAccessGate({ children }: AdminAccessGateProps) {
  const { user, loading: userLoading } = useCurrentUser();
  const router = useRouter();
  const [adminVerified, setAdminVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/login");
      return;
    }

    if (!user) return;

    fetch("/api/admin/verify")
      .then((response) => response.json())
      .then((data) => {
        if (data.verified) {
          setAdminVerified(true);
        }
      })
      .catch(() => {});
  }, [router, user, userLoading]);

  const handleVerifyPassword = async () => {
    setVerifying(true);
    setVerifyError("");
    try {
      const response = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setAdminVerified(true);
      } else {
        setVerifyError(data.error || "验证失败");
      }
    } catch {
      setVerifyError("验证失败");
    } finally {
      setVerifying(false);
    }
  };

  if (userLoading) {
    return (
      <div className="flex min-h-[calc(100vh-72px)] items-center justify-center bg-[#f7f5ef]">
        <p className="flex items-center gap-2 text-sm font-bold text-stone-500">
          <SpinnerGap size={20} weight="bold" className="animate-spin" aria-hidden="true" />
          加载中...
        </p>
      </div>
    );
  }

  if (!user) return null;

  if (!adminVerified) {
    return (
      <div className="page-enter flex min-h-[calc(100vh-72px)] items-center justify-center bg-[#f7f5ef] px-4 py-8">
        <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-stone-300 bg-white shadow-[0_24px_70px_rgba(21,21,21,0.14)]">
          <div className="bg-[#151515] px-6 py-6 text-white">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f5c518] text-[#151515]">
              <LockKey size={26} weight="fill" aria-hidden="true" />
            </div>
            <h2 className="mt-5 text-2xl font-black">管理员验证</h2>
            <p className="mt-2 text-sm font-bold text-stone-400">请输入管理员密码继续</p>
          </div>
          <div className="p-6">
          <input
            type="password"
            value={password}
            data-testid="admin-password-input"
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && password && !verifying) {
                handleVerifyPassword();
              }
            }}
            placeholder="请输入管理员密码"
            className="ui-focus mb-4 min-h-12 w-full rounded-xl border border-stone-300 bg-stone-50 px-4 text-sm font-bold text-stone-900 focus:border-[#f5c518] focus:bg-white focus:outline-none"
          />
          {verifyError && (
            <p role="alert" className="status-pop mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-bold text-red-700">
              {verifyError}
            </p>
          )}
          <button
            onClick={handleVerifyPassword}
            data-testid="admin-password-submit"
            disabled={verifying || !password}
            className="gold-button ui-press ui-focus flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-black disabled:opacity-50"
          >
            {verifying ? (
              <>
                <SpinnerGap size={19} weight="bold" className="animate-spin" aria-hidden="true" />
                验证中...
              </>
            ) : (
              "确认"
            )}
          </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
