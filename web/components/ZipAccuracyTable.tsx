"use client";
interface ZipRow { zip_code: string; medape: number; n_sales: number; mae: number }

export function ZipAccuracyTable({ rows }: { rows: ZipRow[] }) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="panel tick-corners" style={{ marginTop: 18 }}>
      <div className="panel-head">
        <div className="panel-dot" />
        <span className="panel-label">ACCURACY BY ZIP CODE</span>
        <span className="panel-meta">{rows.length} ZIPCODES</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="term">
          <thead>
            <tr>
              <th>ZIP</th>
              <th className="num">MEDAPE</th>
              <th className="num">MAE</th>
              <th className="num">N SALES</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.zip_code}>
                <td style={{ color: 'var(--ink)', letterSpacing: '0.06em' }}>{r.zip_code}</td>
                <td className="num">
                  <span style={{ color: r.medape < 4 ? 'var(--gold)' : r.medape < 6 ? '#e8a838' : 'var(--red)' }}>
                    {r.medape.toFixed(2)}%
                  </span>
                </td>
                <td className="num">{fmt(r.mae)}</td>
                <td className="num">{r.n_sales.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
