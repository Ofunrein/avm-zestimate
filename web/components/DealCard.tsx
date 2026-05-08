import { DealItem } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export function DealCard({ deal }: { deal: DealItem }) {
  const gap = deal.value_gap_pct;
  const gapColor =
    gap >= 20 ? "text-emerald-700 bg-emerald-100" : gap >= 15 ? "text-emerald-600 bg-emerald-50" : "text-zinc-700 bg-zinc-100";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      {deal.photo_url && (
        <div className="h-40 bg-zinc-100 overflow-hidden">
          <img
            src={deal.photo_url}
            alt={deal.address || "Listing photo"}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-zinc-800 leading-tight">
            {deal.address || "Address unavailable"}
          </p>
          <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${gapColor}`}>
            +{gap.toFixed(1)}%
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1 text-sm">
          <div>
            <p className="text-xs text-zinc-400">List Price</p>
            <p className="font-semibold text-zinc-700">
              {deal.list_price ? fmt(deal.list_price) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">AVM Estimate</p>
            <p className="font-semibold text-emerald-600">{fmt(deal.predicted_price)}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
          {deal.zip_code && <span>ZIP {deal.zip_code}</span>}
          {deal.beds != null && <span>{deal.beds} BD</span>}
          {deal.baths_full != null && <span>{deal.baths_full} BA</span>}
          {deal.sqft_living != null && <span>{deal.sqft_living.toLocaleString()} sqft</span>}
        </div>

        {deal.condition_note && (
          <p className="text-xs text-zinc-500 italic border-t border-zinc-100 pt-2">
            &ldquo;{deal.condition_note}&rdquo;
          </p>
        )}

        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${deal.confidence_score}%` }}
            />
          </div>
          <span className="text-xs text-zinc-400">{deal.confidence_score}% conf</span>
        </div>
      </div>
    </div>
  );
}
