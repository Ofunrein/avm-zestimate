"use client";
import { useState } from "react";
import { predict, getComps, PredictionResponse, CompProperty } from "@/lib/api";
import { PredictionCard } from "@/components/PredictionCard";
import { ShapWaterfall } from "@/components/ShapWaterfall";
import { CompsTable } from "@/components/CompsTable";
import { ExplanationCard } from "@/components/ExplanationCard";

const DEFAULT_FORM = {
  sqft_living: 1800, beds: 3, baths_full: 2, baths_half: 0,
  year_built: 2005, zip_code: "78701", lat: 30.27, lng: -97.74,
  lot_sqft: 5000, garage_spaces: 1, has_pool: 0, assessed_value: 0,
};

const FIELDS: Array<[keyof typeof DEFAULT_FORM, string, string]> = [
  ["sqft_living", "LIVING SQFT", "number"],
  ["lot_sqft",    "LOT SQFT",    "number"],
  ["beds",        "BEDS",        "number"],
  ["baths_full",  "FULL BATHS",  "number"],
  ["year_built",  "YEAR BUILT",  "number"],
  ["zip_code",    "ZIP CODE",    "text"],
  ["lat",         "LATITUDE",    "number"],
  ["lng",         "LONGITUDE",   "number"],
];

export function ValueCanvas() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [showManual, setShowManual] = useState(false);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [comps, setComps] = useState<CompProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const [pred, compsData] = await Promise.all([
        predict(form),
        getComps(form.lat, form.lng, form.sqft_living, form.beds, form.baths_full, form.year_built),
      ]);
      setResult(pred);
      setComps(compsData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Prediction failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="panel-head">
        <div className="panel-dot" />
        <span className="panel-label">VALUE A PROPERTY</span>
        <span className="panel-meta" style={{ marginLeft: "auto" }}>AUSTIN TX · XGB + LGB ENSEMBLE</span>
      </div>
      <div style={{ padding: "20px 20px 24px" }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setShowManual(v => !v)}
              className="btn-ghost"
              style={{ fontSize: 11 }}
            >
              {showManual ? "▾ HIDE PROPERTY DETAILS" : "▸ ENTER PROPERTY DETAILS MANUALLY"}
            </button>
          </div>

          {showManual && (
            <div className="form-grid" style={{ marginBottom: 16 }}>
              {FIELDS.map(([key, label, type]) => (
                <div key={key}>
                  <div className="term-label">{label}</div>
                  <input
                    className="term-input"
                    type={type}
                    step={type === "number" ? "any" : undefined}
                    value={form[key]}
                    onChange={e => setForm(f => ({
                      ...f,
                      [key]: type === "number" ? parseFloat(e.target.value) || 0 : e.target.value,
                    }))}
                    required
                  />
                </div>
              ))}
            </div>
          )}

          <button type="submit" className="btn-gold" disabled={loading} style={{ maxWidth: 320 }}>
            {loading ? "ESTIMATING…" : "ESTIMATE VALUE"}
          </button>
        </form>

        {error && (
          <div className="t-mono" style={{ fontSize: 12, color: "var(--red)", marginTop: 12 }}>
            ERR · {error.toUpperCase()}
          </div>
        )}

        {result && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
              <PredictionCard result={result} />
              <ExplanationCard
                prediction={result}
                zipCode={form.zip_code}
                sqft={form.sqft_living}
                beds={form.beds}
                baths={form.baths_full}
                yearBuilt={form.year_built}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <ShapWaterfall features={result.shap_top5} />
            </div>
            {comps.length > 0 && <CompsTable comps={comps} />}
          </div>
        )}
      </div>
    </div>
  );
}
