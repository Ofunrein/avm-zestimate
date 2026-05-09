"use client";
import { useState } from "react";
import { searchProperties, SearchResult } from "@/lib/api";
import { SearchBar } from "@/components/SearchBar";
import { SearchResults } from "@/components/SearchResults";

export function BrowseCanvas() {
  const [query, setQuery] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (q: string) => {
    setLoading(true);
    try {
      const resp = await searchProperties(q);
      setResults(resp.results);
      setTotal(resp.total);
      setQuery(q);
    } catch {
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery(null);
    setResults([]);
    setTotal(0);
  };

  return (
    <div>
      <div className="panel-head">
        <div className="panel-dot" />
        <span className="panel-label">BROWSE MARKET OPPORTUNITIES</span>
        <span className="panel-meta" style={{ marginLeft: "auto" }}>HISTORICAL · AUSTIN TX</span>
      </div>
      <div style={{ padding: "20px 20px 24px" }}>
        <SearchBar onSearch={handleSearch} loading={loading} />
        {query ? (
          <SearchResults results={results} total={total} query={query} onClear={handleClear} />
        ) : (
          <div style={{ marginTop: 16 }}>
            <p className="t-mono" style={{ fontSize: 12, color: "var(--mute)", marginBottom: 12 }}>
              Natural language search across Austin properties. Try:
            </p>
            {[
              "3BR under $500k in 78744",
              "undervalued homes in 78750",
              "pool homes built after 2010",
            ].map(s => (
              <button
                key={s}
                onClick={() => handleSearch(s)}
                className="btn-ghost"
                style={{ display: "block", marginBottom: 8, fontSize: 11, textAlign: "left" }}
              >
                {s}
              </button>
            ))}
            <div style={{ marginTop: 16 }}>
              <a href="/opportunities" className="btn-ghost" style={{ display: "inline-block", fontSize: 11 }}>
                VIEW FULL OPPORTUNITY BOARD →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
