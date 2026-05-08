export default function ModelCardPage() {
  const sections = [
    {
      title: "Model Details",
      content: `Primary model: XGBoost + LightGBM ensemble with Optuna hyperparameter tuning.
Prediction intervals: XGBoost quantile regression at α=0.05 and α=0.95 (90% CI).
Explanations: SHAP TreeExplainer, top 5 features per prediction.
Version: 1.0.0`,
    },
    {
      title: "Training Data",
      content: `Sources: Kaggle Austin Housing Prices (ericpierce/austinhousingprices) + Travis County CAD bulk export + Compass Austin listings.
Date range: January 2018 – December 2023 (training), January 2024 – December 2024 (test).
Records after cleaning: ~40,000–47,000 Austin TX sales.
Geographic scope: Travis County, TX (ZIP codes 786xx–787xx).
COVID period (2020-Q2 to 2021-Q2) flagged as feature, not excluded.`,
    },
    {
      title: "Validation",
      content: `Walk-forward temporal cross-validation: 5 folds, each fold trains on all data before its validation window (6-month windows). No random shuffle — prevents future data leakage.
Final test set: held-out 2024 sales (not seen during training or tuning).`,
    },
    {
      title: "Intended Use",
      content: `Portfolio demonstration of production ML engineering practices. Suitable for: rough valuation reference, undervalued property screening, educational AVM benchmarking.
Not suitable for: mortgage underwriting, tax assessment disputes, legal valuation.`,
    },
    {
      title: "Known Limitations",
      content: `Luxury homes (>$2M): underrepresented in training data, higher error expected.
New construction (<2 years old): often lacks comparable sales, may undervalue.
Interior quality: model cannot see renovation quality, condition upgrades, or custom finishes.
Market shifts: model trained on 2018–2023 data; rapid 2024+ market changes may degrade accuracy.
Geographic scope: Travis County only. Not valid for suburbs outside ZIP 786xx–787xx.`,
    },
    {
      title: "Bias Analysis",
      content: `MedAPE reported by ZIP code. ZIPs in lowest median income quartile are flagged if error exceeds 2x the overall MedAPE — see Benchmark Dashboard for current values.`,
    },
    {
      title: "Benchmark Reference",
      content: `Zillow's published Zestimate MedAPE for Austin TX is approximately 4.5% (as of their public accuracy report). This is an external contextual reference — not a property-level comparison against Zillow predictions.
Internal baselines: ZIP median and price-per-square-foot baselines measured on the same held-out test set.`,
    },
  ];

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        <div>
          <a href="/" className="text-sm text-emerald-600 hover:underline">← Back</a>
          <h1 className="text-3xl font-bold text-zinc-900 mt-2">Model Card</h1>
        </div>

        {sections.map(({ title, content }) => (
          <div key={title} className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-800 mb-3">{title}</h2>
            <p className="text-sm text-zinc-600 whitespace-pre-line leading-relaxed">{content}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
