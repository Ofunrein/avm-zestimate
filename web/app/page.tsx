"use client";
import { useState, useEffect } from "react";
import { getBenchmark } from "@/lib/api";
import { ValueCanvas } from "@/components/ValueCanvas";
import { BrowseCanvas } from "@/components/BrowseCanvas";
import { UploadCanvas } from "@/components/UploadCanvas";

type Mode = "value" | "browse" | "upload";

const MODES: { id: Mode; label: string }[] = [
  { id: "value",  label: "Value a Property" },
  { id: "browse", label: "Browse Opportunities" },
  { id: "upload", label: "Upload Listings" },
];

export default function HomePage() {
  const [mode, setMode] = useState<Mode>("value");
  const [stats, setStats] = useState({ medape: "—", nTest: "—" });

  useEffect(() => {
    getBenchmark().then(b => setStats({
      medape: b.test_medape != null ? `${b.test_medape.toFixed(2)}%` : "—",
      nTest:  b.n_test != null ? b.n_test.toLocaleString() : "—",
    })).catch(() => {});
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 28px 64px" }}>

        {/* Hero */}
        <div style={{ marginBottom: 28 }}>
          <div className="t-eyebrow" style={{ marginBottom: 10 }}>
            AUSTIN HOUSING INTELLIGENCE · EXPLAINABLE AVM · AUSTIN TX
          </div>
          <h1 className="t-display" style={{ fontSize: 44, color: "var(--ink)", margin: "0 0 12px", lineHeight: 0.95 }}>
            Austin Housing<br />
            <span style={{ color: "var(--gold)" }}>Intelligence</span>
          </h1>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--mute)", margin: "0 0 28px", maxWidth: 520 }}>
            Estimate one property, browse modeled market opportunities, or score your own listings.
          </p>

          {/* Mode tabs */}
          <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
                  letterSpacing: "0.14em", textTransform: "uppercase",
                  padding: "10px 22px",
                  background: mode === m.id ? "var(--gold)" : "var(--bg-2)",
                  color: mode === m.id ? "#fff" : "var(--mute)",
                  border: `1.5px solid ${mode === m.id ? "var(--gold)" : "var(--line-2)"}`,
                  cursor: "pointer", transition: "all .12s",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results canvas */}
        <div className="panel" style={{ marginBottom: 32 }}>
          {mode === "value"  && <ValueCanvas />}
          {mode === "browse" && <BrowseCanvas />}
          {mode === "upload" && <UploadCanvas />}
        </div>

        {/* Trust strip */}
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap", paddingTop: 18, borderTop: "1px solid var(--line)" }}>
          {[
            { label: "MEDAPE",    value: stats.medape, gold: true },
            { label: "TEST SET",  value: stats.nTest },
            { label: "ZIPS",      value: "38 Austin ZIPs" },
            { label: "MODEL",     value: "XGB + LGB Ensemble" },
            { label: "DATA MODE", value: "Historical Backtest" },
          ].map(({ label, value, gold }) => (
            <div key={label}>
              <div className="t-eyebrow" style={{ marginBottom: 3 }}>{label}</div>
              <div className="t-mono" style={{ fontSize: 13, color: gold ? "var(--gold)" : "var(--ink-2)", fontWeight: 600 }}>
                {value}
              </div>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}
