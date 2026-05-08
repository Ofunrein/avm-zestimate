"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ShapFeature } from "@/lib/api";

const FEATURE_LABELS: Record<string, string> = {
  sqft_living: "Living Area (sqft)",
  dist_downtown_miles: "Distance to Downtown",
  median_zip_price_90d: "ZIP Median Price (90d)",
  age: "Property Age",
  beds: "Bedrooms",
  baths_full: "Bathrooms",
  zip_encoded: "ZIP Code",
  lot_sqft: "Lot Size",
  garage_spaces: "Garage",
  has_pool: "Pool",
};

export function ShapWaterfall({ features }: { features: ShapFeature[] }) {
  const data = features.map((f) => ({
    name: FEATURE_LABELS[f.feature] ?? f.feature,
    value: f.shap_value,
    direction: f.direction,
  }));

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-zinc-700 mb-4">What drives this estimate</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ left: 16 }}>
          <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} fontSize={11} />
          <YAxis type="category" dataKey="name" width={160} fontSize={12} tick={{ fill: "#52525b" }} />
          <Tooltip formatter={(v) => typeof v === "number" ? [`$${Math.abs(v / 1000).toFixed(1)}k impact`, ""] : [String(v), ""]} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.direction === "increases" ? "#10b981" : "#ef4444"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-zinc-400 mt-2">Green = increases value · Red = decreases value</p>
    </div>
  );
}
