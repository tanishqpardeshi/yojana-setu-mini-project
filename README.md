# YojanaSetu (योजनासेतु) - Indore District Civic Discovery Platform

> **Real-Time, Centralized Government Scheme Discovery & Verification Engine for the Citizens of Indore District, Madhya Pradesh.**

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![SQLite WAL](https://img.shields.io/badge/Database-SQLite_WAL-003B57?logo=sqlite)](https://www.sqlite.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-CSS_v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)

---

## 🏛️ Executive Overview

**YojanaSetu** is a production-grade civic-tech platform purpose-built for the administration and 3.5+ million residents of **Indore District, Madhya Pradesh**. Designed across **6 hierarchical tiers of governance**, it bridges the gap between complex government gazette rules and grassroots citizens using a deterministic JSON eligibility engine, vernacular Malwi/Hindi RAG AI assistance, Samagra profile integration, and live district administration dashboards.

---

## 🌟 Key Pillars & Features

### 1. 6 Levels of Governance Coverage (51+ Exhaustive Schemes)
- **Level 1: International & Multilateral Partnerships** (ADB Green Urban Metro Corridor, World Bank Solar Cities, UNICEF Poshan).
- **Level 2: National / Central Government Schemes** (PM-KISAN, PMAY-U & PMAY-G, Ayushman Bharat PM-JAY, PM SVANidhi, PM Vishwakarma, PM Surya Ghar Muft Bijli, PMFBY, MGNREGA, PM-KUSUM, DAY-NRLM).
- **Level 3: Madhya Pradesh State Government Schemes** (Ladli Behna ₹1,250/mo, Ladli Laxmi 2.0, CM Kisan Kalyan ₹6,000, Sambal 2.0, Seekho Kamao, Kanya Vivah/Nikah ₹55,000, Medhavi Vidyarthi Medhavi Chhatra, Udyam Kranti 3% subsidy, Krishak Mitra Solar Pump, Teerth Darshan, Gaon Ki Beti, Pratibha Kiran, Post-Matric Scholarship, Kalyani & Vridha Pension).
- **Level 4: Indore Collectorate District Administration** (Ahilya Divyang Swavalamban Kosh, Red Cross Arogya Nidhi, Jal-Hath Farm Pond Water Conservation, District Skill Hub Pithampur Corridor).
- **Level 5: Indore Municipal Corporation (IMC Wards 1 to 85)** (Swachhata Mitr Kalyan Kosh, IMC Rooftop Solar Property Tax 10% Rebate, Pink Street Vendor Hawking Zones, Zero-Waste Biogas Subsidy).
- **Level 6: Rural Janpad Panchayats (Indore, Mhow, Sanwer, Depalpur)** (Malwi Desi Gau Samvardhan Protsahan, Sanwer Mandi Cold Storage Subsidy, Depalpur Organic Soybean Mission, Mhow Tribal Bamboo Craft & Forest Honey SHG Grant).

### 2. Multi-Dialect Smart Search (Malwi, Hindi & English)
- Integrated linguistic synonym expansion dictionary converting local Malwi terms (*टापरो* ➔ PMAY Housing, *हलवा / खेड़ूत* ➔ PM-KISAN, *दवा / गोली* ➔ Ayushman Bharat, *ठेला / रेहड़ी* ➔ PM SVANidhi).
- Instant filtering by governance level, target beneficiary (Women, Farmers, Youth, Divyang, Vendors, BPL), and benefits type (Direct DBT, Subsidies, Insurance, Loans).

### 3. Deterministic Eligibility Rules Engine
- Evaluates citizen age, gender, occupation, annual family income, rural/urban residence, landholding in acres, caste category, disability percentage, and Samagra enrollment.
- Delivers unambiguous **Eligible**, **Likely Eligible**, or **Not Eligible** verdicts with exact pass/fail requirement checklists and transparent justification.

### 4. Yojana Mitra: Hybrid RAG AI Assistant
- Server-side semantic retrieval pipeline (`/api/gemini/chat` & `/api/rag/search`) combining BM25 keyword matching, synonym expansion, and contextual re-ranking.
- Provides grounded, hallucination-free answers citing official government nodal offices in Indore, exact financial entitlements, and required forms.
- **Audio Read-Aloud**: Integrated Web Speech synthesis in authentic Hindi (`hi-IN`) for accessible citizen support.

### 5. Official Citizen Entitlement Certificate
- Generates a downloadable, print-optimized **Citizen Entitlement Card** featuring:
  - Total cumulative cash DBT potential (e.g. ₹27,000/yr).
  - Capital asset & health coverage entitlement (e.g. ₹5,00,000+).
  - Unique Digital Certificate ID with dynamic verification QR code.
  - Official Indore District Administration watermark and seal.

### 6. Side-by-Side Scheme Comparison Matrix
- Compare up to 3 schemes simultaneously across financial limits, eligibility thresholds, required documents, disbursal timelines, and local nodal grievance offices.

### 7. Interactive Indore Spatial Heatmap (Wards 1–85 & Zones 1–19)
- Real-time GIS choropleth visualization for Indore Municipal Corporation across 4 metric modes:
  - **Saturation %** (Scheme coverage against eligible target).
  - **Live Applications** submitted.
  - **DBT Disbursed (₹ Cr)**.
  - **Poverty Vulnerability Index** (High, Medium, Low).

### 8. DigiLocker Document Vault & Tracker
- 12 standard MP documents (Samagra Member ID, Samagra Family ID, Aadhaar, MP Domicile, Digital Income Certificate, Khasra B-1, SC/ST/OBC Digital Caste, Bank DBT, UDID, Sambal Card, etc.) with real-time verification status check.

### 9. CSC Operator & Field Camp Mode
- Bulk application processing interface for Village Level Entrepreneurs (VLEs) and Lok Seva Kendra operators.
- Offline-ready draft queuing, instant Samagra auto-fill, and token generation.

### 10. Live Admin Stream & SQLite WAL Persistence
- Real-time Server-Sent Events (SSE) stream (`/api/admin/live-stream`) broadcasting applications across wards.
- SQLite database (`./data/yojanasetu.db`) in Write-Ahead-Logging (WAL) mode for resilient, multi-process persistence.
- One-click CSV export of district applications for MIS reporting.

---

## 🛠️ Tech Stack & Architecture

```
yojana-setu/
├── server.ts                       # Express full-stack entry point + Vite middleware
├── server/
│   └── db.ts                       # SQLite WAL database (better-sqlite3) & schema seeds
├── src/
│   ├── components/
│   │   ├── AdminDashboard.tsx      # District MIS, CSV export & live SSE feed
│   │   ├── ApplicationTrackerView.tsx # ARN status tracker with printable receipt
│   │   ├── CitizenEntitlementCardModal.tsx # Printable entitlement certificate with QR
│   │   ├── CscOperatorMode.tsx     # Operator high-throughput assisted intake
│   │   ├── EligibilityCalculator.tsx # Dynamic rules engine & citizen profiler
│   │   ├── GovernanceLevelsView.tsx # Tier-wise 6-level interactive directory
│   │   ├── IndoreSpatialHeatmap.tsx # 19 Zones & 85 Wards interactive GIS heatmap
│   │   ├── SchemeComparisonModal.tsx# Side-by-side scheme comparison matrix
│   │   └── YojanaMitraChatbot.tsx  # Vernacular RAG AI chat with speech synthesis
│   ├── data/
│   │   ├── indoreGovernance.ts     # Authentic 85 IMC Wards & 4 Janpad Panchayats
│   │   └── schemesData.ts          # 51+ exhaustive multi-tier scheme rules & benefits
│   └── utils/
│       ├── eligibilityEngine.ts    # Deterministic citizen qualification logic
│       ├── ragEngine.ts            # BM25 + synonym retrieval & citation generator
│       ├── malwiSynonyms.ts        # Malwi, Nimadi & Hindi dialect lexicon
│       └── *.test.ts               # Automated Node.js unit test suite
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v20 or v22 LTS recommended)
- npm or bun

### 1. Clone the Repository
```bash
git clone https://github.com/tanishqpardeshi/yojana-setu-mini-project.git
cd yojana-setu-mini-project
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(Optional: Provide `GEMINI_API_KEY` for live Gemini generative responses; the built-in Hybrid RAG engine provides full fallback answers with citations out-of-the-box).*

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Run Automated Tests
```bash
npx tsx --test src/utils/*.test.ts
```

### 6. Build for Production
```bash
npm run build
npm start
```

---

## 📡 REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/schemes` | Fetch all 51+ schemes with optional `?level=`, `?search=`, `?category=` |
| `GET` | `/api/stats` | District-wide application totals, DBT figures, and ward saturation stats |
| `POST` | `/api/applications` | Submit a citizen scheme application (generates `YS-IND-YYYY-XXXXX` ARN) |
| `GET` | `/api/applications/:arn` | Real-time ARN query with tracking stages and verification notes |
| `GET` | `/api/samagra/:id` | Instant lookup of 8-digit family or 9-digit member Samagra records |
| `POST` | `/api/gemini/chat` | Yojana Mitra RAG query returning verified chunks and grounded answers |
| `GET` | `/api/admin/live-stream` | Real-time Server-Sent Events (SSE) feed of incoming applications |
| `GET` | `/api/admin/export-csv` | Export entire applications database as RFC-compliant CSV |

---

## 🏛️ Administrative Boundaries Reference

- **Collectorate Headquarters**: Moti Tabela, Indore - 452007
- **Indore Municipal Corporation (IMC)**: 19 Zones, 85 Wards
- **Rural Janpad Panchayats**:
  - Indore Janpad (64 Panchayats)
  - Mhow / Dr. Ambedkar Nagar (78 Panchayats)
  - Sanwer (92 Panchayats)
  - Depalpur (86 Panchayats)

---

## 📜 License
Developed under the **Apache-2.0 License**. Free for civic, educational, and public administrative utilization.
