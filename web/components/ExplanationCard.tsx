"use client";
import { useEffect, useState } from "react";
import { PredictionResponse, ExplainRequest, explainPrediction } from "@/lib/api";

interface Props {
  prediction: PredictionResponse;
  zipCode: string;
  sqft: number;
  beds: number;
  baths: number;
  yearBuilt: number;
}

export function ExplanationCard({ prediction, zipCode, sqft, beds, baths, yearBuilt }: Props) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setExplanation(null);
    const req: ExplainRequest = {
      predicted_price: prediction.predicted_price,
      lower_bound: prediction.lower_bound,
      upper_bound: prediction.upper_bound,
      confidence_score: prediction.confidence_score,
      shap_top5: prediction.shap_top5,
      zip_code: zipCode,
      sqft_living: sqft,
      beds,
      baths_full: baths,
      year_built: yearBuilt,
    };
    explainPrediction(req)
      .then(setExplanation)
      .catch(() => setExplanation(null))
      .finally(() => setLoading(false));
  }, [prediction.predicted_price, prediction.lower_bound, prediction.upper_bound, prediction.confidence_score, zipCode, sqft, beds, baths, yearBuilt]);

  if (!loading && !explanation) return null;

  return (
    <div className="panel tick-corners scanlines">
      <div className="panel-head">
        <div className="panel-dot" />
        <span className="panel-label">AI · ANALYSIS</span>
        <span className="panel-meta">CLAUDE HAIKU · SHAP-GROUNDED</span>
      </div>
      <div style={{ padding: '16px 18px 18px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 0.85, 0.7].map((w, i) => (
              <div key={i} style={{
                height: 12, borderRadius: 0,
                background: 'var(--bg-3)',
                width: `${w * 100}%`,
                animation: `pulse 1.5s ease-in-out ${i * 0.15}s infinite`,
              }} />
            ))}
          </div>
        ) : (
          <p className="t-mono" style={{
            fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.7,
            margin: 0, letterSpacing: '0.01em'
          }}>
            {explanation}
          </p>
        )}
      </div>
    </div>
  );
}
