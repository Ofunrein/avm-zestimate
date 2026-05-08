"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ShapFeature } from "@/lib/api";

const LABELS: Record<string, string> = {
  sqft_living: "Living area",
  dist_downtown_miles: "Distance downtown",
  median_zip_price_90d: "ZIP median (90d)",
  age: "Property age",
  beds: "Bedrooms",
  baths_full: "Bathrooms",
  zip_encoded: "ZIP code",
  lot_sqft: "Lot size",
  garage_spaces: "Garage",
  has_pool: "Pool",
  year_built: "Year built",
};

export function ShapWaterfall({ features }: { features: ShapFeature[] }) {
  const data = features.map(f => ({
    name: LABELS[f.feature] ?? f.feature,
    value: f.shap_value,
    direction: f.direction,
  }));

  return (
    <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>What drives this estimate</p>
        <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-subtle)" }}>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: "var(--accent)" }} />increases</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: "var(--red)" }} />decreases</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8 }}>
          <XAxis
            type="number"
            tickFormatter={v => `$${Math.abs(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 10, fill: "#71717a" }}
            axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fontSize: 11, fill: "#a1a1aa" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12, color: "#fafafa" }}
            formatter={(v) => [`$${Math.abs((typeof v === "number" ? v : 0) / 1000).toFixed(1)}k impact`, ""]}
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
          />
          <Bar dataKey="value" radius={[0, 3, 3, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.direction === "increases" ? "#10b981" : "#ef4444"} opacity={0.9} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
