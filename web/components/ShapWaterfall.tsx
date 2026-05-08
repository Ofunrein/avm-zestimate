"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ShapFeature } from "@/lib/api";

const LABELS: Record<string, string> = {
  sqft_living: "LIVING AREA",
  dist_downtown_miles: "DIST · DOWNTOWN",
  median_zip_price_90d: "ZIP MED · 90D",
  age: "PROPERTY AGE",
  beds: "BEDROOMS",
  baths_full: "BATHROOMS",
  zip_encoded: "ZIP · ENCODED",
  lot_sqft: "LOT SIZE",
  garage_spaces: "GARAGE",
  has_pool: "POOL",
};

export function ShapWaterfall({ features }: { features: ShapFeature[] }) {
  const data = features.map((f) => ({
    name: LABELS[f.feature] ?? f.feature.toUpperCase(),
    value: f.shap_value,
    direction: f.direction,
  }));

  return (
    <div className="panel tick-corners scanlines">
      <div className="panel-head">
        <div className="panel-dot" />
        <span className="panel-label">SHAP · VALUE DRIVERS</span>
        <span className="panel-meta">XGB + LGB ENSEMBLE</span>
      </div>
      <div style={{ padding: '16px 16px 12px' }}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} layout="vertical" margin={{ left: 0 }}>
            <XAxis
              type="number"
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 10, fill: 'var(--mute)', fontFamily: 'var(--font-mono)' }}
              axisLine={{ stroke: 'var(--line)' }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={112}
              tick={{ fontSize: 9.5, fill: 'var(--mute)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 0, fontFamily: 'var(--font-mono)', fontSize: 11 }}
              labelStyle={{ color: 'var(--ink-2)' }}
              formatter={(v) => typeof v === "number" ? [`$${Math.abs(v / 1000).toFixed(1)}k`, ""] : [String(v), ""]}
            />
            <Bar dataKey="value" radius={0} barSize={12}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.direction === "increases" ? 'var(--gold)' : 'var(--red)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, background: 'var(--gold)' }} />
            <span className="t-eyebrow">INCREASES VALUE</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, background: 'var(--red)' }} />
            <span className="t-eyebrow">DECREASES VALUE</span>
          </div>
        </div>
      </div>
    </div>
  );
}
