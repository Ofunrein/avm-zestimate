"use client";
import { motion } from "framer-motion";
import { PredictionResponse } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function PredictionCard({ result }: { result: PredictionResponse }) {
  const range = result.upper_bound - result.lower_bound;
  const rangePct = ((range / result.predicted_price) * 100).toFixed(1);
  const conf = result.confidence_score;

  return (
    <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      {/* Price */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--text-subtle)" }}>Estimated Value</p>
          <motion.p
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="text-4xl font-bold tracking-tight tabular-nums"
            style={{ color: "var(--accent)" }}
          >
            {fmt(result.predicted_price)}
          </motion.p>
          <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
            {fmt(result.lower_bound)} – {fmt(result.upper_bound)}
            <span className="ml-1.5" style={{ color: "var(--text-subtle)" }}>({rangePct}% range · 90% CI)</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--text-subtle)" }}>Confidence</p>
          <p className="text-2xl font-bold tabular-nums" style={{ color: conf >= 70 ? "var(--accent)" : conf >= 40 ? "#f59e0b" : "var(--red)" }}>
            {conf}<span className="text-sm font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>/100</span>
          </p>
        </div>
      </div>

      {/* Confidence bar */}
      <div>
        <div className="flex justify-between mb-1.5">
          <span className="text-xs" style={{ color: "var(--text-subtle)" }}>Confidence</span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Model v{result.model_version}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-raised)" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${conf}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className="h-full rounded-full"
            style={{ background: conf >= 70 ? "var(--accent)" : conf >= 40 ? "#f59e0b" : "var(--red)" }}
          />
        </div>
      </div>
    </div>
  );
}
