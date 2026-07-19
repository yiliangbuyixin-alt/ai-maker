"use client";

import { useEffect, useState } from "react";

type PlanFeatureValue = string | boolean;
type PaidPlan = "pro" | "business";

type PlanFeatureRow = {
  label: string;
  free: PlanFeatureValue;
  pro: PlanFeatureValue;
  business: PlanFeatureValue;
};

const PLAN_FEATURES: PlanFeatureRow[] = [
  { label: "月額料金", free: "¥0", pro: "¥1,980", business: "¥9,800" },
  {
    label: "ヒアリングモード",
    free: "さくっと作る(3問)のみ",
    pro: "しっかり作る(5カテゴリ)",
    business: "しっかり作る(5カテゴリ)",
  },
  { label: "AIモデル", free: "Claude Haiku", pro: "Claude Sonnet", business: "Claude Sonnet" },
  { label: "知識ベースの保存数", free: "1件まで", pro: "無制限", business: "無制限" },
  { label: "Web公開", free: false, pro: true, business: true },
  { label: "API発行", free: false, pro: true, business: true },
  { label: "チームメンバー招待", free: false, pro: false, business: true },
  { label: "優先サポート", free: false, pro: false, business: true },
];

function FeatureCell({ value }: { value: PlanFeatureValue }) {
  if (typeof value === "boolean") {
    return value ? (
      <span className="text-green-600 dark:text-green-400">✓</span>
    ) : (
      <span className="text-black/25 dark:text-white/25">—</span>
    );
  }
  return <span>{value}</span>;
}

type UpgradeModalProps = {
  open: boolean;
  onClose: () => void;
  /** Name of the gated feature that triggered this modal, e.g. "Web公開". */
  featureName?: string;
};

export default function UpgradeModal({ open, onClose, featureName }: UpgradeModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<PaidPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  async function handleUpgrade(plan: PaidPlan) {
    setLoadingPlan(plan);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        setError(data.error ?? "決済ページの作成に失敗しました");
        setLoadingPlan(null);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("通信エラーが発生しました");
      setLoadingPlan(null);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-black/10 dark:border-white/15 bg-background p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="upgrade-modal-title" className="text-lg font-semibold">
              {featureName ? `${featureName}はProプラン以上の機能です` : "プランをアップグレード"}
            </h2>
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              プランを比較して、あなたに合ったプランを選んでください。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="shrink-0 rounded-md px-2 py-1 text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        <p className="mt-4 text-[11px] text-black/40 dark:text-white/40 sm:hidden">
          ← 横にスクロールして他のプランも見られます →
        </p>
        <div className="mt-2 overflow-x-auto sm:mt-5">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-2/5 pb-3 text-left font-medium text-black/50 dark:text-white/50" />
                <th className="pb-3 text-center font-semibold">Free</th>
                <th className="pb-3 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-medium text-background">
                      おすすめ
                    </span>
                    <span className="font-semibold">Pro</span>
                  </div>
                </th>
                <th className="pb-3 text-center font-semibold">Business</th>
              </tr>
            </thead>
            <tbody>
              {PLAN_FEATURES.map((row, i) => (
                <tr
                  key={row.label}
                  className={i > 0 ? "border-t border-black/10 dark:border-white/10" : ""}
                >
                  <td className="py-2.5 pr-2 text-black/70 dark:text-white/70">{row.label}</td>
                  <td className="py-2.5 text-center">
                    <FeatureCell value={row.free} />
                  </td>
                  <td className="bg-black/[0.03] py-2.5 text-center dark:bg-white/[0.04]">
                    <FeatureCell value={row.pro} />
                  </td>
                  <td className="py-2.5 text-center">
                    <FeatureCell value={row.business} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-col items-center gap-2">
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => handleUpgrade("pro")}
              disabled={loadingPlan !== null}
              className="flex-1 rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-50"
            >
              {loadingPlan === "pro" ? "処理中..." : "Proにアップグレード"}
            </button>
            <button
              type="button"
              onClick={() => handleUpgrade("business")}
              disabled={loadingPlan !== null}
              className="flex-1 rounded-md border border-black/15 dark:border-white/20 px-4 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {loadingPlan === "business" ? "処理中..." : "Businessにアップグレード"}
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loadingPlan !== null}
            className="text-xs text-black/50 underline dark:text-white/50 disabled:opacity-50"
          >
            あとで
          </button>
        </div>
      </div>
    </div>
  );
}
