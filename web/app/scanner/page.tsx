"use client";
import { useState } from "react";
import Papa from "papaparse";
import { scanProperties } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export default function ScannerPage() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    setError(null);
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      complete: async (parsed) => {
        try {
          const props = (parsed.data as Record<string, unknown>[]).filter(r => r.sqft_living && r.list_price);
          const scan = await scanProperties(props as any);
          setResults(scan);
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : "Scan failed");
        } finally { setLoading(false); }
      },
    });
  };

  const undervalued = results.filter(r => r.is_undervalued);

  return (
    <div className="max-w-6xl mx-auto px-5 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>Undervalued Scanner</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Upload a CSV of listings to surface properties priced below model estimate.</p>
      </div>

      <div className="rounded-xl border p-6 space-y-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Required columns:{" "}
          <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: "var(--surface-raised)", color: "var(--accent)", fontFamily: "var(--font-geist-mono)" }}>
            sqft_living, beds, baths_full, year_built, zip_code, lat, lng, list_price
          </code>
        </p>
        <label className="flex items-center gap-3 cursor-pointer w-fit">
          <span className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--surface-raised)", color: "var(--text-primary)", border: "1px solid var(--border-strong)" }}>
            {loading ? "Processing…" : "Choose CSV"}
          </span>
          {fileName && <span className="text-sm" style={{ color: "var(--text-muted)" }}>{fileName}</span>}
          <input type="file" accept=".csv" onChange={handleFile} className="hidden" disabled={loading} />
        </label>
        {error && (
          <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", color: "var(--red)", border: "1px solid rgba(239,68,68,0.12)" }}>{error}</p>
        )}
      </div>

      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>{results.length} scanned</span>
              <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                {undervalued.length} undervalued
              </span>
            </div>
            <button
              onClick={() => { const csv = Papa.unparse(results); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], {type:"text/csv"})); a.download = "scan_results.csv"; a.click(); }}
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{ background: "var(--surface-raised)", color: "var(--text-muted)", border: "1px solid var(--border-strong)" }}
            >
              Export CSV
            </button>
          </div>

          <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["#", "List Price", "AVM Estimate", "Gap", "Top Driver"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium uppercase tracking-wide" style={{ color: "var(--text-subtle)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} style={{ borderBottom: i < results.length - 1 ? "1px solid var(--border)" : "none", background: r.is_undervalued ? "rgba(16,185,129,0.03)" : "transparent" }}>
                    <td className="px-4 py-3 tabular-nums" style={{ color: "var(--text-subtle)" }}>{r.index + 1}</td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: "var(--text-muted)" }}>{fmt(r.list_price)}</td>
                    <td className="px-4 py-3 tabular-nums font-medium" style={{ color: "var(--text-primary)" }}>{fmt(r.predicted_price)}</td>
                    <td className="px-4 py-3">
                      <span className="tabular-nums font-semibold" style={{ color: r.value_gap_pct > 0 ? "var(--accent)" : "var(--red)" }}>
                        {r.value_gap_pct > 0 ? "+" : ""}{r.value_gap_pct.toFixed(1)}%
                      </span>
                      {r.is_undervalued && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-xs" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>deal</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono" style={{ color: "var(--text-subtle)" }}>{r.shap_top_driver ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
