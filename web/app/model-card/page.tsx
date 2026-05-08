export default function ModelCardPage() {
  const sections = [
    { title: "Model Details", content: `Primary model: XGBoost + LightGBM ensemble with Optuna hyperparameter tuning.\nPrediction intervals: XGBoost quantile regression at α=0.05 and α=0.95 (90% CI).\nExplanations: SHAP TreeExplainer, top 5 features per prediction.\nVersion: 1.0.0` },
    { title: "Training Data", content: `Sources: Kaggle Austin Housing Prices (ericpierce/austinhousingprices) + Travis County CAD + Compass Austin listings.\nDate range: 2018–2020 training, 2020-07 to 2021-01 test.\nClean records: ~15,000 Austin TX sales.\nGeographic scope: Travis County, TX (ZIP codes 786xx–787xx).\nCOVID period flagged as feature, not excluded.` },
    { title: "Validation", content: `Walk-forward temporal cross-validation: 5 folds, each fold trains on all data before its validation window. No random shuffle — prevents future data leakage.\nFinal test set: held-out July 2020–January 2021 sales.` },
    { title: "Intended Use", content: `Portfolio demonstration of production ML engineering. Suitable for: rough valuation reference, undervalued property screening, educational AVM benchmarking.\nNot suitable for: mortgage underwriting, tax disputes, legal valuation.` },
    { title: "Known Limitations", content: `Luxury homes (>$2M): underrepresented in training data.\nNew construction: may undervalue due to lack of comps.\nInterior quality: model cannot see renovation or custom finishes.\nMarket shifts: trained on 2018–2020 data; post-2021 market changes may degrade accuracy.` },
    { title: "Benchmark Reference", content: `Zillow's published Zestimate MedAPE for Austin TX is approximately 4.5% (external reference only — not a property-level comparison). Internal baselines: ZIP median (19.1%) and PPSF (15.3%) measured on same test set.` },
  ];

  return (
    <div className="max-w-3xl mx-auto px-5 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>Model Card</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Training data, evaluation metrics, limitations, and responsible use guidelines.</p>
      </div>
      {sections.map(({ title, content }) => (
        <div key={title} className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--text-subtle)" }}>{title}</p>
          <p className="text-sm whitespace-pre-line leading-relaxed" style={{ color: "var(--text-muted)" }}>{content}</p>
        </div>
      ))}
    </div>
  );
}
