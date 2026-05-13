"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
      <div className="flex min-h-screen items-center justify-center bg-orange-50/30">
        <p className="text-gray-400">加载中...</p>
      </div>
    );
  }

  if (!user) return null;

  if (!adminVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-orange-50/30">
        <div className="w-full max-w-sm rounded-2xl border border-orange-100 bg-white p-8 shadow-lg">
          <h2 className="mb-6 text-center text-xl font-bold text-gray-800">
            管理员验证
          </h2>
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
            className="mb-4 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-700 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          {verifyError && (
            <p className="mb-4 text-center text-sm text-red-500">{verifyError}</p>
          )}
          <button
            onClick={handleVerifyPassword}
            data-testid="admin-password-submit"
            disabled={verifying || !password}
            className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-medium text-white shadow-md transition-colors hover:bg-amber-600 disabled:opacity-50"
          >
            {verifying ? "验证中..." : "确认"}
          </button>
        </div>
      </div>
    );
  }

  return children;
}
