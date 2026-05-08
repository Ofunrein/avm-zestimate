"use client";
import { CompProperty } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function CompsTable({ comps }: { comps: CompProperty[] }) {
  if (!comps.length) return null;
  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <p className="text-xs uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>Comparable Sales</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Address", "Sale Price", "Sqft", "Bed/Bath", "Dist", "Match"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-medium uppercase tracking-wide" style={{ color: "var(--text-subtle)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comps.map((c, i) => (
              <tr key={i} className="group" style={{ borderBottom: i < comps.length - 1 ? "1px solid var(--border)" : "none" }}>
                <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>{c.address ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums font-medium" style={{ color: "var(--text-primary)" }}>{fmt(c.sale_price)}</td>
                <td className="px-4 py-3 tabular-nums" style={{ color: "var(--text-muted)" }}>{c.sqft_living?.toLocaleString()}</td>
                <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>{c.beds ?? "—"}/{c.bath_total ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums" style={{ color: "var(--text-muted)" }}>{c.distance_miles?.toFixed(2) ?? "—"} mi</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded text-xs font-medium tabular-nums" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                    {(c.similarity_score * 100).toFixed(0)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
