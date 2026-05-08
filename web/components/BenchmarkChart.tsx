"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";

interface BenchmarkBar { name: string; medape: number; color: string; }

export function BenchmarkChart({ data }: { data: BenchmarkBar[] }) {
  return (
    <div className="panel tick-corners scanlines">
      <div className="panel-head">
        <div className="panel-dot" />
        <span className="panel-label">MEDAPE COMPARISON</span>
        <span className="panel-meta">LOWER IS BETTER · ZILLOW ~4.5% REFERENCE</span>
      </div>
      <div style={{ padding: '16px 16px 12px' }}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ bottom: 8 }}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: 'var(--mute)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}
              axisLine={{ stroke: 'var(--line)' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--mute)' }}
              axisLine={false}
              tickLine={false}
              domain={[0, "auto"]}
            />
            <Tooltip
              contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 0, fontFamily: 'var(--font-mono)', fontSize: 11 }}
              formatter={(v) => [typeof v === "number" ? `${v.toFixed(2)}%` : v, "MEDAPE"]}
            />
            <ReferenceLine
              y={4.5}
              stroke="#e8a838"
              strokeDasharray="4 2"
              label={{ value: "ZILLOW ~4.5%", position: "right", fontSize: 9.5, fill: "#e8a838", fontFamily: 'var(--font-mono)' }}
            />
            <Bar dataKey="medape" radius={0} barSize={40}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
