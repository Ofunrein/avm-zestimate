import { getBenchmark } from "@/lib/api";
import { BenchmarkChart } from "@/components/BenchmarkChart";
import { ZipAccuracyTable } from "@/components/ZipAccuracyTable";

export const revalidate = 3600;

export default async function BenchmarkPage() {
  let data;
  try { data = await getBenchmark(); } catch {
    return (
      <div className="max-w-6xl mx-auto px-5 py-10">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Could not load benchmark data. API may be warming up.</p>
      </div>
    );
  }

  const chartData = [
    { name: "This Model", medape: data.test_medape, color: "#10b981" },
    { name: "ZIP Median", medape: data.baseline_zip_median_medape || 8.5, color: "#6366f1" },
    { name: "PPSF", medape: data.baseline_ppsf_medape || 9.2, color: "#8b5cf6" },
  ];

  const stats = [
    { label: "MedAPE", value: `${data.test_medape.toFixed(2)}%`, ok: data.test_medape < 6 },
    { label: "Within 5%", value: `${(data.test_within_5pct * 100).toFixed(1)}%`, ok: data.test_within_5pct > 0.5 },
    { label: "Within 10%", value: `${(data.test_within_10pct * 100).toFixed(1)}%`, ok: data.test_within_10pct > 0.7 },
    { label: "MAE", value: `$${(data.test_mae / 1000).toFixed(1)}k`, ok: data.test_mae < 100000 },
    { label: "Test set", value: data.n_test.toLocaleString(), ok: true },
    { label: "Model", value: `v${data.model_version}`, ok: true },
  ];

  return (
    <div className="max-w-6xl mx-auto px-5 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>Benchmark Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Austin TX · Model accuracy vs internal baselines</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map(({ label, value, ok }) => (
          <div key={label} className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <p className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--text-subtle)" }}>{label}</p>
            <p className="text-xl font-bold tabular-nums" style={{ color: ok ? "var(--text-primary)" : "var(--red)" }}>{value}</p>
          </div>
        ))}
      </div>

      <BenchmarkChart data={chartData} />

      <div className="rounded-xl border p-4 flex items-start gap-3" style={{ background: "rgba(245,158,11,0.04)", borderColor: "rgba(245,158,11,0.15)" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" className="mt-0.5 shrink-0">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p className="text-xs" style={{ color: "#b45309" }}>
          Zillow&apos;s published Zestimate MedAPE for Austin is approximately 4.5%. Shown as external reference only — not a property-level comparison.
        </p>
      </div>

      {data.by_zip?.length > 0 && <ZipAccuracyTable rows={data.by_zip} />}
    </div>
  );
}
