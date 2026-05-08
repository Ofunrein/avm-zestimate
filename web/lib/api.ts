const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";

export interface PropertyInput {
  sqft_living: number;
  beds: number;
  baths_full: number;
  baths_half?: number;
  year_built: number;
  zip_code: string;
  lat: number;
  lng: number;
  lot_sqft?: number;
  garage_spaces?: number;
  has_pool?: number;
  assessed_value?: number;
}

export interface ShapFeature {
  feature: string;
  feature_value: number;
  shap_value: number;
  direction: "increases" | "decreases";
}

export interface PredictionResponse {
  predicted_price: number;
  lower_bound: number;
  upper_bound: number;
  confidence_score: number;
  shap_top5: ShapFeature[];
  model_version: string;
}

export interface CompProperty {
  address?: string;
  sale_price: number;
  sale_date?: string;
  sqft_living: number;
  beds?: number;
  bath_total?: number;
  distance_miles?: number;
  similarity_score: number;
}

export interface ZipRow {
  zip_code: string;
  medape: number;
  n_sales: number;
  mae: number;
}

export interface BenchmarkResponse {
  model_version: string;
  test_medape: number;
  test_mae: number;
  test_rmse: number;
  test_within_5pct: number;
  test_within_10pct: number;
  n_test: number;
  baseline_zip_median_medape: number;
  baseline_ppsf_medape: number;
  zillow_published_medape_reference: number;
  by_zip: Array<{ zip_code: string; medape: number; n_sales: number; mae: number }>;
}

export interface PropertyScanResult {
  index: number;
  list_price: number;
  predicted_price: number;
  value_gap_pct: number;
  is_undervalued: boolean;
  shap_top_driver: string | null;
}

export async function predict(input: PropertyInput): Promise<PredictionResponse> {
  const res = await fetch(`${API_BASE}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getComps(
  lat: number, lng: number, sqft: number,
  beds: number, bathTotal: number, yearBuilt: number
): Promise<CompProperty[]> {
  const params = new URLSearchParams({
    lat: String(lat), lng: String(lng), sqft: String(sqft),
    beds: String(beds), bath_total: String(bathTotal), year_built: String(yearBuilt),
  });
  const res = await fetch(`${API_BASE}/comps?${params}`);
  if (!res.ok) return [];
  return res.json();
}

export async function getBenchmark(): Promise<BenchmarkResponse> {
  const res = await fetch(`${API_BASE}/benchmark`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function scanProperties(
  properties: Array<PropertyInput & { list_price: number }>
): Promise<PropertyScanResult[]> {
  const res = await fetch(`${API_BASE}/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ properties }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
