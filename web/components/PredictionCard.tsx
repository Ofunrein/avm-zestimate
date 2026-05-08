"use client";
import { PredictionResponse } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function PredictionCard({ result }: { result: PredictionResponse }) {
  const range = result.upper_bound - result.lower_bound;
  const rangePct = ((range / result.predicted_price) * 100).toFixed(1);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
      <div className="text-center">
        <p className="text-sm text-zinc-500 uppercase tracking-wide">Estimated Value</p>
        <p className="text-4xl font-bold text-zinc-900">{fmt(result.predicted_price)}</p>
        <p className="text-sm text-zinc-500 mt-1">
          {fmt(result.lower_bound)} – {fmt(result.upper_bound)}{" "}
          <span className="text-zinc-400">({rangePct}% range, 90% CI)</span>
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${result.confidence_score}%` }}
          />
        </div>
        <span className="text-sm text-zinc-600 font-medium">{result.confidence_score}/100 confidence</span>
      </div>

      <p className="text-xs text-zinc-400">Model v{result.model_version}</p>
    </div>
  );
}
