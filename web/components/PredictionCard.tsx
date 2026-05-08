"use client";
import { PredictionResponse } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function PredictionCard({ result }: { result: PredictionResponse }) {
  const segs = 20;
  const filled = Math.round((result.confidence_score / 100) * segs);

  return (
    <div className="panel tick-corners scanlines" style={{ background: 'var(--bg-1)' }}>
      <div className="panel-head">
        <div className="panel-dot" />
        <span className="panel-label">ESTIMATED VALUE</span>
        <span className="panel-meta">MODEL v{result.model_version} · 90% CI</span>
      </div>
      <div style={{ padding: '24px 20px 20px', textAlign: 'center' }}>
        <div className="t-eyebrow" style={{ marginBottom: 10 }}>AVM ESTIMATE · AUSTIN TX</div>
        <div className="t-mono glitch-in" style={{
          fontSize: 48, color: 'var(--gold)', letterSpacing: '-0.02em',
          lineHeight: 1, fontWeight: 500,
        }}>
          {fmt(result.predicted_price)}
        </div>
        <div className="t-mono" style={{
          fontSize: 13, color: 'var(--ink-2)', marginTop: 8, letterSpacing: '0.04em'
        }}>
          {fmt(result.lower_bound)} <span style={{ color: 'var(--mute)' }}>→</span> {fmt(result.upper_bound)}
        </div>
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span className="t-eyebrow">CONFIDENCE</span>
          <span className="t-mono" style={{ fontSize: 11, color: 'var(--gold)' }}>
            {result.confidence_score}/100
          </span>
        </div>
        <div className="conf-segments">
          {Array.from({ length: segs }).map((_, i) => (
            <div key={i} className={`conf-seg${i < filled ? ' on' : ''}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
