import Image from "next/image";

interface BrandMarkProps {
  compact?: boolean;
  inverse?: boolean;
}

export default function BrandMark({ compact = false, inverse = false }: BrandMarkProps) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Image
        src="/brand/engineering-gorilla-avatar.png"
        alt="广众与众创工程猩形象"
        width={compact ? 40 : 48}
        height={compact ? 40 : 48}
        priority
        unoptimized
        className="shrink-0 rounded-xl border border-yellow-300/70 object-cover"
      />
      <div className="min-w-0">
        <div
          className={`truncate text-sm font-black tracking-tight sm:text-base ${
            inverse ? "text-white" : "text-stone-950"
          }`}
        >
          广众&众创<span className="text-[#f5c518]">内部点餐系统</span>
        </div>
        {!compact ? (
          <div
            className={`mt-0.5 text-[10px] font-bold tracking-[0.2em] ${
              inverse ? "text-stone-400" : "text-stone-500"
            }`}
          >
            ENGINEERING CANTEEN
          </div>
        ) : null}
      </div>
    </div>
  );
}
