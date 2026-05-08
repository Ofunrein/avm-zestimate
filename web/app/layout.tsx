import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Austin AVM — Hyperlocal Home Valuation",
  description: "Production-grade automated valuation model for Austin TX. XGBoost + LightGBM ensemble with temporal CV, SHAP explanations, and prediction intervals.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col" style={{ background: "var(--canvas)", color: "var(--text-primary)" }}>
        <header className="sticky top-0 z-50 border-b" style={{ borderColor: "var(--border)", background: "rgba(9,9,11,0.85)", backdropFilter: "blur(12px)" }}>
          <div className="max-w-6xl mx-auto px-5 h-12 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
              <span className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold" style={{ background: "var(--accent)", color: "#000" }}>A</span>
              Austin AVM
            </Link>
            <nav className="flex items-center gap-1">
              {[
                { href: "/", label: "Valuate" },
                { href: "/benchmark", label: "Benchmark" },
                { href: "/scanner", label: "Scanner" },
                { href: "/model-card", label: "Model Card" },
              ].map(({ href, label }) => (
                <Link key={href} href={href} className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors hover:bg-white/5" style={{ color: "var(--text-muted)" }}>
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <p className="text-xs" style={{ color: "var(--text-subtle)" }}>Austin AVM — XGBoost + LightGBM · Temporal CV · SHAP</p>
            <a href="https://github.com/Ofunrein/avm-zestimate" target="_blank" rel="noopener" className="text-xs hover:underline" style={{ color: "var(--text-subtle)" }}>GitHub</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
