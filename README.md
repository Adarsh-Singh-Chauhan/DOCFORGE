<p align="center">
  <br/>
  <code>// ENTERPRISE DOCUMENT INTELLIGENCE & TELEMETRY PLATFORM</code>
  <br/>
  <h1 align="center" style="font-weight: 900; letter-spacing: -0.04em;">
    DOCFORGE <span style="color: #e04f16;">STUDIO</span>
  </h1>
  <p align="center">
    <strong>Convert any document (PDFs, Scanned Manuscripts, SEC 10-K Reports, Academic Papers) into clean, token-efficient Markdown — powered by 5 selectable AI engines, local vector RAG, complete audit history, and live telemetry analytics.</strong>
  </p>
</p>

<p align="center">
  <a href="#live-deployment"><img src="https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge&logo=vercel" alt="Vercel Deploy" /></a>
  <a href="#multi-engine-architecture"><img src="https://img.shields.io/badge/Engines-Docling%20%7C%20Surya%20%7C%20Mistral%20%7C%20Mathpix%20%7C%20LlamaParse-e04f16?style=for-the-badge" alt="Engines" /></a>
  <a href="#privacy--security"><img src="https://img.shields.io/badge/Privacy-100%25%20Air--Gapped%20Capable-10b981?style=for-the-badge&logo=shield" alt="Air-Gapped" /></a>
  <a href="#quickstart"><img src="https://img.shields.io/badge/Stack-React%2019%20%2B%20FastAPI%20%2B%20SQLite-38bdf8?style=for-the-badge" alt="Tech Stack" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue?style=for-the-badge" alt="License" /></a>
</p>

---

## ⚡ Key Workspaces & Capabilities

| Workspace | Route | Description |
| :--- | :--- | :--- |
| **Mission Control Dashboard** | `#/dashboard` | Database-backed KPI metrics, daily job throughput histograms, engine latency comparisons, and recent activity streams. |
| **Batch OCR Converter** | `#/converter` | Multi-file parallel processing, 6-engine smart selector, cloud consent authorization, and live Markdown inspector. |
| **OCR Document History** | `#/ocr-history` | Persistent audit registry with search, status/engine filters, sorting, pagination, retry on failure, and CSV/JSON export. |
| **OCR Job Detail Inspector** | `#/ocr-history/:id` | 5-stage pipeline trace (Ingestion → Inspection → OCR → Synthesis → Normalization), metadata HUD, LaTeX math rendering, and `.md` downloads. |
| **RAG Intelligence Studio** | `#/chatbot` | Local semantic search and dialogue with verifiable source citations grounded in your converted documents. |
| **Chat History Archives** | `#/chat-history` | Full dialogue preservation, in-place conversation renaming, deletion, Markdown export, and one-click chat continuation. |
| **API & Engine Analytics** | `#/analytics` | Local air-gapped vs external cloud provider comparison, privacy ratio metrics, latency per page, and estimated costs. |

---

## 🏛️ Multi-Engine Architecture

DOCFORGE unifies the five most powerful document parsing and OCR engines under a single modular interface:

```mermaid
graph TD
    A[📄 Input Document: PDF / Scan / Arxiv / Report] --> B[🔍 Document Ingestion & Text Inspection]
    B --> C{Engine Selector / Auto Route}
    
    C -->|Local Air-Gapped| D[IBM Docling: Layout unwarping & hierarchy]
    C -->|Local Air-Gapped| E[Surya VLM: Deep OCR on GPU/CPU for degraded print]
    C -->|Cloud Consent| F[Mistral OCR API: Multimodal scanned documents]
    C -->|Cloud Consent| G[Mathpix OCR API: Scientific LaTeX & equations]
    C -->|Cloud Consent| H[LlamaParse API: Complex financial tables & reports]
    
    D --> I[📐 Normalized GitHub Markdown + LaTeX Math]
    E --> I
    F --> I
    G --> I
    H --> I
    
    I --> J[💾 SQLite Database: Persistent History & Telemetry]
    I --> K[⚡ Vector Knowledge Store: Grounded RAG Chatbot]
```

---

## 🌐 Live Deployment (How to make it Live)

### Option A: Deploy Frontend on Vercel (Recommended & 100% Free)

1. Go to [https://vercel.com/new](https://vercel.com/new).
2. Connect your GitHub account and import **`Adarsh-Singh-Chauhan/DOCFORGE`**.
3. Configure the Project Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./` (or `frontend`)
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Output Directory**: `frontend/dist`
4. Click **Deploy**. Your DOCFORGE website will be live at `https://docforge-*.vercel.app` in under 60 seconds!

### Option B: Deploy Backend API on Render or Railway

1. Go to [https://render.com](https://render.com) or [https://railway.app](https://railway.app).
2. Connect your repo `Adarsh-Singh-Chauhan/DOCFORGE`.
3. Set Start Command:
   ```bash
   uvicorn pdqa_api.main:app --host 0.0.0.0 --port $PORT
   ```
4. Optional Cloud API Keys (Environment Variables):
   - `MISTRAL_API_KEY`
   - `MATHPIX_APP_ID` & `MATHPIX_APP_KEY`
   - `LLAMA_CLOUD_API_KEY`
   - `VITE_GEMINI_API_KEY`

---

## 💻 Running Locally

### 1. Prerequisites
- Python 3.10+
- Node.js 18+

### 2. Launch Local Backend Server
```bash
# Clone the repository
git clone https://github.com/Adarsh-Singh-Chauhan/DOCFORGE.git
cd DOCFORGE

# Create virtual environment and install dependencies
python -m venv venv
.\venv\Scripts\activate   # Windows (or source venv/bin/activate on Mac/Linux)
pip install -r requirements.txt

# Start FastAPI server
uvicorn pdqa_api.main:app --port 8000 --reload
```

### 3. Launch Frontend Web Application
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔒 Privacy & Security

- **Air-Gapped Default**: IBM Docling and Surya VLM run completely offline on your local machine with zero data transmission.
- **Explicit Cloud Consent**: Documents are only transmitted to external cloud providers (Mistral, Mathpix, LlamaParse) when explicitly authorized by the user.
- **Zero Secret Exposure**: API keys are stored exclusively in backend environment variables and `.env`. Credentials are never exposed to the frontend, browser localStorage, or Git commits.

---

## 📜 License
Distributed under the Apache 2.0 License. See [LICENSE](LICENSE) for details.
