"use client";
interface ZipRow { zip_code: string; medape: number; n_sales: number; mae: number }

export function ZipAccuracyTable({ rows }: { rows: ZipRow[] }) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <p className="text-xs uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>Accuracy by ZIP Code</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["ZIP", "MedAPE", "MAE", "N Sales"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-medium uppercase tracking-wide" style={{ color: "var(--text-subtle)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.zip_code} style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none" }}>
                <td className="px-4 py-3 font-mono font-medium" style={{ color: "var(--text-primary)" }}>{r.zip_code}</td>
                <td className="px-4 py-3 tabular-nums font-medium" style={{ color: r.medape < 4 ? "#10b981" : r.medape < 6 ? "#f59e0b" : "#ef4444" }}>
                  {r.medape.toFixed(2)}%
                </td>
                <td className="px-4 py-3 tabular-nums" style={{ color: "var(--text-muted)" }}>{fmt(r.mae)}</td>
                <td className="px-4 py-3 tabular-nums" style={{ color: "var(--text-muted)" }}>{r.n_sales.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
