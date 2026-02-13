"use client";

import { useState, useEffect } from "react";

type MealStatus = "open" | "closed" | "upcoming";

function getMealStatus(mealType: "lunch" | "dinner"): MealStatus {
  const now = new Date();
  const hours = now.getHours();

  if (mealType === "lunch") {
    return hours < 10 ? "open" : "closed";
  } else {
    if (hours < 10) return "upcoming";
    if (hours < 15) return "open";
    return "closed";
  }
}

const statusConfig: Record<MealStatus, { label: string; className: string }> = {
  open: {
    label: "开放中",
    className: "bg-green-100 text-green-700 border-green-200",
  },
  closed: {
    label: "已截止",
    className: "bg-red-100 text-red-700 border-red-200",
  },
  upcoming: {
    label: "即将开放",
    className: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
};

export default function MealStatusBadge({
  mealType,
}: {
  mealType: "lunch" | "dinner";
}) {
  const [status, setStatus] = useState<MealStatus>(() => getMealStatus(mealType));

  useEffect(() => {
    // Update status every minute
    const interval = setInterval(() => {
      setStatus(getMealStatus(mealType));
    }, 60_000);
    return () => clearInterval(interval);
  }, [mealType]);

  const config = statusConfig[status];
  const deadline = mealType === "lunch" ? "10:00" : "15:00";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${config.className}`}
      >
        {config.label}
      </span>
      {status !== "closed" && (
        <span className="text-sm text-gray-500">{deadline} 前可点</span>
      )}
    </div>
  );
}

