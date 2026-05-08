import { DealItem } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function DealCard({ deal }: { deal: DealItem }) {
  const gap = deal.value_gap_pct;
  const isHot = gap >= 20;
  const filled = Math.round((deal.confidence_score / 100) * 14);

  return (
    <div className="panel tick-corners scanlines" style={{ overflow: 'hidden' }}>
      {deal.photo_url && (
        <div style={{ height: 140, overflow: 'hidden', position: 'relative' }}>
          <img
            src={deal.photo_url}
            alt={deal.address || "Listing"}
            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.7) saturate(0.6)' }}
          />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: 40,
            background: 'linear-gradient(to top, var(--bg-1), transparent)',
          }} />
        </div>
      )}
      <div className="panel-head">
        <div className="panel-dot" style={isHot ? { background: 'var(--gold)', boxShadow: '0 0 10px var(--gold)' } : {}} />
        <span className="panel-label" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {(deal.address || 'ADDR UNKNOWN').toUpperCase()}
        </span>
        <span style={{
          marginLeft: 'auto',
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
          color: '#1a1408', background: isHot ? 'var(--gold)' : 'var(--mute)',
          padding: '2px 8px', letterSpacing: '0.08em', flexShrink: 0
        }}>
          +{gap.toFixed(1)}%
        </span>
      </div>
      <div style={{ padding: '14px 14px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <div className="t-eyebrow" style={{ marginBottom: 4 }}>LIST PRICE</div>
            <div className="t-mono" style={{ fontSize: 15, color: 'var(--ink-2)' }}>
              {deal.list_price ? fmt(deal.list_price) : '—'}
            </div>
          </div>
          <div>
            <div className="t-eyebrow" style={{ marginBottom: 4 }}>AVM ESTIMATE</div>
            <div className="t-mono" style={{ fontSize: 15, color: 'var(--gold)', fontWeight: 500 }}>
              {fmt(deal.predicted_price)}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          {deal.zip_code && <span className="t-eyebrow">{deal.zip_code}</span>}
          {deal.beds != null && <span className="t-eyebrow">{deal.beds}BD</span>}
          {deal.baths_full != null && <span className="t-eyebrow">{deal.baths_full}BA</span>}
          {deal.sqft_living != null && <span className="t-eyebrow">{deal.sqft_living.toLocaleString()}SF</span>}
        </div>
        {deal.condition_note && (
          <p className="t-mono" style={{ fontSize: 11, color: 'var(--mute)', margin: '0 0 12px', lineHeight: 1.5, borderLeft: '2px solid var(--line-2)', paddingLeft: 8 }}>
            &quot;{deal.condition_note}&quot;
          </p>
        )}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span className="t-eyebrow">CONFIDENCE</span>
            <span className="t-mono" style={{ fontSize: 10, color: 'var(--gold)' }}>{deal.confidence_score}%</span>
          </div>
          <div className="conf-segments">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className={`conf-seg${i < filled ? ' on' : ''}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
