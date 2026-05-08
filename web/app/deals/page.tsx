import { getDeals } from "@/lib/api";
import { DealCard } from "@/components/DealCard";

export const revalidate = 3600;

export default async function DealsPage() {
  let deals;
  try {
    deals = await getDeals();
  } catch {
    return (
      <main className="min-h-screen bg-zinc-50">
        <div className="max-w-5xl mx-auto px-4 py-12">
          <a href="/" className="text-sm text-emerald-600 hover:underline">← Back</a>
          <p className="mt-4 text-zinc-400 text-sm">Could not load deals. Check API connection.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
        <div>
          <a href="/" className="text-sm text-emerald-600 hover:underline">← Back</a>
          <h1 className="text-3xl font-bold text-zinc-900 mt-2">This Week&apos;s Deals</h1>
          <p className="text-zinc-500 mt-1">
            {deals.length} undervalued Austin properties · AVM predicts {">"}10% above list price
          </p>
        </div>

        {deals.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center">
            <p className="text-zinc-400 text-sm">No deals found yet.</p>
            <p className="text-zinc-300 text-xs mt-1">
              Run the deal monitor script or wait for the weekly GitHub Actions cron.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {deals.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
