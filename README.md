# QReview — APQR Software for Pharma API Manufacturing

Annual Product Quality Review software for pharmaceutical API manufacturers. Replaces Excel-based APQR with automated Cpk/Ppk analysis, I-MR control charts, Nelson's Rules detection, and a structured data workflow.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000 → Click "Load Demo Data" to seed 2 API products with 37 batches, deviations, CAPAs, change controls, and complaints.

## Features (V1)

- **Product setup** with CQA/CPP parameter definitions and specification limits
- **Excel/CSV batch data upload** with auto-validation against specs
- **Auto-calculated statistics**: Mean, SD, RSD, Cp, Cpk, Pp, Ppk, UCL/LCL
- **I-MR Control Charts** with 1σ/2σ/3σ zone shading, spec limit lines, Nelson's Rule violation markers
- **Cpk Scorecard** — color-coded grid (Green ≥1.33, Amber 1.0-1.33, Red <1.0)
- **Nelson's Rules** 1, 2, 3, 5 — auto-detection of process anomalies
- **One-sided specs** — handles USL-only (impurities) and LSL-only parameters
- **Yield trending** with standard yield reference
- **Qualitative data entry** — Deviations, CAPAs, Change Controls, Complaints with status tracking
- **Batch summary** — Released/Rejected/Reprocessed donut chart

## Regulatory Alignment

Built per **ICH Q7 Section 2.5** and **21 CFR 211.180(e)** requirements.

## Tech Stack

Next.js 14 · TypeScript · Tailwind CSS · Recharts · SQLite (better-sqlite3) · SheetJS

## Statistical Engine — 28 unit tests passing

```bash
node src/lib/stats.test.js
```

## Project Structure

```
src/app/api/products/[id]/stats  → Statistical calculations endpoint
src/app/api/products/[id]/upload → Excel/CSV upload handler
src/app/products/[id]/page.tsx   → Product analysis dashboard
src/lib/stats.ts                 → Cpk, Ppk, Nelson's Rules engine
src/lib/db.ts                    → SQLite schema + helpers
src/components/charts/           → ControlChart, YieldChart, CpkScorecard, StatsTable
```

KJR Labs · Proprietary
