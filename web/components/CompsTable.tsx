"use client";
import { CompProperty } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function CompsTable({ comps }: { comps: CompProperty[] }) {
  if (!comps.length) return null;
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100">
        <h3 className="text-sm font-semibold text-zinc-700">Comparable Sales</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Address</th>
              <th className="px-4 py-3 text-right">Sale Price</th>
              <th className="px-4 py-3 text-right">Sqft</th>
              <th className="px-4 py-3 text-right">Beds/Bath</th>
              <th className="px-4 py-3 text-right">Distance</th>
              <th className="px-4 py-3 text-right">Match</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {comps.map((c, i) => (
              <tr key={i} className="hover:bg-zinc-50">
                <td className="px-4 py-3 text-zinc-700">{c.address ?? "—"}</td>
                <td className="px-4 py-3 text-right font-medium">{fmt(c.sale_price)}</td>
                <td className="px-4 py-3 text-right">{c.sqft_living?.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{c.beds ?? "—"} / {c.bath_total ?? "—"}</td>
                <td className="px-4 py-3 text-right">{c.distance_miles?.toFixed(2) ?? "—"} mi</td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
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
