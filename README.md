# 🛡️ Real-Time Credit Card Fraud Detection System

An end-to-end, production-grade fraud detection system built to demonstrate the complete ML engineering lifecycle — from research and model training to real-time API serving, drift monitoring, and an interactive dashboard.

---

## 🏗️ System Architecture

> 🔄 **Transaction Flow:**
> `React Dashboard` ➔ `FastAPI Backend` ➔ `XGBoost Model` ➔ `Decision (APPROVE / FLAG / BLOCK)`

> 📊 **Monitoring Flow:**
> `drift_monitor.py` ➔ `KS Test + PSI` ➔ `drift_report.json` ➔ `FastAPI /drift-report` ➔ `React Dashboard`
---

## 📁 Project Structure

| Path | Description |
|---|---|
| `notebook/fraud_detection_system.ipynb` | Phase 1: ML research, training, evaluation |
| `backend/main.py` | Phase 2: FastAPI server with all endpoints |
| `monitoring/drift_monitor.py` | Phase 3: KS test and PSI drift detection |
| `frontend/src/App.jsx` | Phase 4: React dashboard |
| `models/xgb_fraud_model.pkl` | Trained XGBoost model |
| `models/robust_scaler.pkl` | Fitted RobustScaler |
| `models/config.json` | Optimal decision threshold |
| `models/feature_columns.json` | Training column order |
| `models/reference_stats.json` | Training distributions for drift reference |
| `models/sample_transactions.json` | Synthetic test transactions |
| `models/drift_report.json` | Latest generated drift report |
---

## 🔬 Phase 1 — ML Research Notebook

**Dataset:** ULB Credit Card Fraud Dataset — 284,807 transactions, 492 fraud (0.17%)

**Key Engineering Decisions:**

| Decision | Reasoning |
|---|---|
| `RobustScaler` over `StandardScaler` | Fraud data has extreme outliers — IQR-based scaling prevents distortion |
| Cyclical encoding for Hour | Hour 23 and Hour 0 are 1 hour apart, not 23 — sin/cos preserves circular continuity |
| `log1p` on Amount | Heavy right skew compressed to symmetric distribution |
| PR-AUC over Accuracy | 99.83% accuracy achievable by predicting all legitimate — meaningless metric |
| `scale_pos_weight` over SMOTE | SMOTE infeasible on 284k rows (O(n²)); algorithmic weighting achieves comparable PR-AUC |
| 5-fold Stratified CV | Validates model stability — low std confirms generalisation across splits |

**Results:**

| Model | PR-AUC |
|---|---|
| Logistic Regression | baseline |
| Random Forest | better |
| XGBoost Base | better |
| XGBoost + scale_pos_weight | **best** |

**Selected Threshold:** 0.1 → Precision: 0.794, Recall: 0.867, F1: 0.829

---

## ⚙️ Phase 2 — FastAPI Backend

**Endpoints:**

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Server and model status |
| POST | `/predict` | Accepts transaction JSON, returns fraud decision |
| GET | `/simulate` | Fires random synthetic transaction through predict |
| GET | `/drift-report` | Returns latest drift monitoring report |

**Prediction Pipeline:**
1. Receive transaction JSON → Pydantic validates all 31 fields
2. Apply `log1p` on Amount → scale with fitted `RobustScaler`
3. Compute `Hour_Sin` / `Hour_Cos` cyclical encoding
4. Assemble feature vector in exact training column order
5. `model.predict_proba()` → compare against threshold
6. Return APPROVE / FLAG / BLOCK with probability and latency

**Latency:** ~4–6ms per request after warmup (well under 50ms production constraint)

---

## 📊 Phase 3 — Drift Monitoring

Detects when incoming transaction distributions diverge from training data — a signal that model performance may be degrading.

**Methods:**
- **KS Test** (all 31 features) — p-value < 0.05 flags drift
- **PSI on Amount_log** — industry standard: < 0.10 stable, 0.10–0.20 monitor, > 0.20 retrain
- **Sample size guard** — PSI skipped if current data < 500 rows (unreliable on small samples)

**Status Tiers:**

| Status | Condition |
|---|---|
| HEALTHY | < 10% features drifted, PSI stable |
| WARNING | 10–30% features drifted, or PSI moderate |
| CRITICAL | > 30% features drifted, or PSI > 0.20 |

---

## 🖥️ Phase 4 — React Dashboard

Built with React + Vite. Communicates with FastAPI via axios.

**Panels:**
- **Stats bar** — live counts of APPROVE / FLAG / BLOCK / total simulated
- **Simulate button** — fires `/simulate` endpoint, updates all panels in real time
- **API Latency chart** — Recharts line chart of response times per request
- **Drift monitoring panel** — overall status, drifted feature tags, PSI status
- **Transaction log** — full table of all simulated transactions with decision badges

---

## 🚀 Running Locally

**Prerequisites:** Python 3.9+, Node.js 18+

**1. Clone and set up Python environment:**
```bash
git clone https://github.com/sdkharade12/fraud-detection-system.git
cd fraud-detection-system
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

**2. Generate model artifacts:**

Open and run all cells in `notebook/fraud_detection_system.ipynb`

**3. Start FastAPI backend:**
```bash
cd backend
uvicorn main:app --reload
```

**4. Run drift monitoring:**
```bash
cd monitoring
python drift_monitor.py
```

**5. Start React dashboard:**
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| ML Model | XGBoost, scikit-learn, imbalanced-learn |
| Data Processing | Pandas, NumPy |
| Backend | FastAPI, Uvicorn, Pydantic |
| Drift Monitoring | SciPy (KS Test), PSI |
| Frontend | React, Vite, Recharts, Axios |
| Serialization | Joblib |