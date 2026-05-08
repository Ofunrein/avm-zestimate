"use client";
import { CompProperty } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function CompsTable({ comps }: { comps: CompProperty[] }) {
  if (!comps.length) return null;
  return (
    <div className="panel tick-corners">
      <div className="panel-head">
        <div className="panel-dot" />
        <span className="panel-label">COMPARABLE SALES</span>
        <span className="panel-meta">{comps.length} COMPS · HAVERSINE + COSINE SIMILARITY</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="term">
          <thead>
            <tr>
              <th>ADDRESS</th>
              <th className="num">SALE PRICE</th>
              <th className="num">SQFT</th>
              <th className="num">BD/BA</th>
              <th className="num">DIST · MI</th>
              <th className="num">MATCH %</th>
            </tr>
          </thead>
          <tbody>
            {comps.map((c, i) => (
              <tr key={i}>
                <td style={{ color: 'var(--ink)' }}>{c.address ?? '—'}</td>
                <td className="num" style={{ color: 'var(--gold)' }}>{fmt(c.sale_price)}</td>
                <td className="num">{c.sqft_living?.toLocaleString()}</td>
                <td className="num">{c.beds ?? '—'} / {c.bath_total ?? '—'}</td>
                <td className="num">{c.distance_miles?.toFixed(2) ?? '—'}</td>
                <td className="num">
                  <span style={{
                    color: c.similarity_score > 0.9 ? 'var(--gold)' : 'var(--ink-2)',
                    fontWeight: c.similarity_score > 0.9 ? 600 : 400,
                  }}>
                    {(c.similarity_score * 100).toFixed(0)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
