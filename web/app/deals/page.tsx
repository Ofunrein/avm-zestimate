import { getDeals } from "@/lib/api";
import { DealCard } from "@/components/DealCard";

export const revalidate = 3600;

export default async function DealsPage() {
  let deals;
  try {
    deals = await getDeals();
  } catch {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--bg)', padding: '32px 28px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <a href="/" className="btn-ghost" style={{ display: 'inline-block', marginBottom: 24 }}>← BACK</a>
          <p className="t-mono" style={{ color: 'var(--red)', fontSize: 12 }}>ERR · COULD NOT LOAD DEALS · CHECK API CONNECTION</p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', padding: '32px 28px 64px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <a href="/" className="btn-ghost" style={{ display: 'inline-block', marginBottom: 24 }}>← BACK</a>
        <div style={{ marginBottom: 28 }}>
          <div className="t-eyebrow" style={{ marginBottom: 8 }}>DEAL MONITOR · WEEKLY SCAN</div>
          <h1 className="t-display" style={{ fontSize: 36, margin: '0 0 8px', color: 'var(--ink)' }}>
            This Week&apos;s <span style={{ color: 'var(--gold)' }}>Undervalued</span> Properties
          </h1>
          <div className="t-mono" style={{ fontSize: 12, color: 'var(--mute)' }}>
            {deals.length} PROPERTIES · AVM PREDICTS &gt;10% ABOVE LIST PRICE · AUSTIN TX
          </div>
        </div>

        {deals.length === 0 ? (
          <div className="panel" style={{ padding: '48px 32px', textAlign: 'center' }}>
            <div className="t-eyebrow" style={{ marginBottom: 12 }}>NO DEALS FOUND THIS CYCLE</div>
            <p className="t-mono" style={{ fontSize: 12, color: 'var(--mute)' }}>
              DEAL MONITOR RUNS WEEKLY · GITHUB ACTIONS · MONDAY 08:00 UTC
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
            {deals.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
