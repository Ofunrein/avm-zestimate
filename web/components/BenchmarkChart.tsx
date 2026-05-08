"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";

interface BenchmarkBar { name: string; medape: number; color: string }

export function BenchmarkChart({ data }: { data: BenchmarkBar[] }) {
  return (
    <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between mb-1">
        <p className="text-xs uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>MedAPE Comparison</p>
        <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
          Zillow ref ~4.5%
        </span>
      </div>
      <p className="text-xs mb-5" style={{ color: "var(--text-subtle)" }}>Lower is better</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ bottom: 4 }}>
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} domain={[0, "auto"]} />
          <Tooltip
            contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12, color: "#fafafa" }}
            formatter={(v) => [`${typeof v === "number" ? v.toFixed(2) : v}%`, "MedAPE"]}
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
          />
          <ReferenceLine y={4.5} stroke="#f59e0b" strokeDasharray="4 2" strokeOpacity={0.6} />
          <Bar dataKey="medape" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} opacity={0.9} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
