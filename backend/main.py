# Section - 1: Imports and App Initialization
from fastapi import HTTPException, FastAPI
from pydantic import BaseModel
from typing import Optional
import joblib
import json
import numpy as np
import math
import time
import os
import pandas as pd
import random

app = FastAPI(
    title = "Fraud Detection API",
    description = 'Real-time Credit Card Fraud Detection System',
    version = '1.0.0'
)

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins = ["http://localhost:5173", "http://localhost:3000"],
    allow_credentials = True,
    allow_methods = ['*'],
    allow_headers = ['*'],
)

# Section - 2: Loading Artifacts on Startup
# Build path to models directory relativve to this file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, '..', 'models')

# Load all artifacts once when server starts
model = joblib.load(os.path.join(MODELS_DIR, 'xgb_fraud_model.pkl'))
scaler = joblib.load(os.path.join(MODELS_DIR, 'robust_scaler.pkl'))

with open(os.path.join(MODELS_DIR, 'config.json'), 'r') as f:
    config = json.load(f)

with open(os.path.join(MODELS_DIR, 'feature_columns.json'), 'r') as f:
    feature_columns = json.load(f)

THRESHOLD = config['optimal_threshold']

print(f'Model loaded successfully')
print(f'Optimal threshold: {THRESHOLD}')
print(f'Feature count: {len(feature_columns)}')

# Section - 3: Pydantic Input Model
class Transaction(BaseModel):
    transaction_id: Optional[str] = None
    V1: float
    V2: float
    V3: float
    V4: float
    V5: float
    V6: float
    V7: float
    V8: float
    V9: float
    V10: float
    V11: float
    V12: float
    V13: float
    V14: float
    V15: float
    V16: float
    V17: float
    V18: float
    V19: float
    V20: float
    V21: float
    V22: float
    V23: float
    V24: float
    V25: float
    V26: float
    V27: float
    V28: float
    Amount: float
    Hour: int

# Section - 4: Response Model
class PredictionResponse(BaseModel):
    transaction_id: Optional[str]
    fraud_probability: float
    decision: str
    threshold_used: float
    latency_ms: float

# Section - 5: Health Endpoint
@app.get("/health")
def health_check():
    return{
        'status': 'ok',
        'model_loaded': model is not None,
        'threshold': THRESHOLD
    }

# Section - 6: The predict endpoint
@app.post("/predict", response_model=PredictionResponse)
def predict(transaction: Transaction):
    start_time = time.time()

    try:
        # --- Feature Engineering (mirrors the notebook exactly) ---

        # 1. Log transform on Amount
        amount_log = np.log1p(transaction.Amount)

        # 2. Scale Amount_log using the fitted scaler
        # Scaler expects a 2D array: [[value]]
        amount_scaled = scaler.transform(
            pd.DataFrame([[amount_log]], columns=['Amount_log'])
        )[0][0]

        # 3. Cyclical encoding of Hour
        hour_sin = math.sin(2 * math.pi * transaction.Hour / 24)
        hour_cos = math.cos(2 * math.pi * transaction.Hour / 24)

        # --- Assemble Feature Vector in Training Column Order ---
        # feature_columns = ["V1", ..., "V28", "Amount_log", "Hour_Sin", "Hour_Cos"]

        feature_map = {
            'V1': transaction.V1, 'V2': transaction.V2, 'V3': transaction.V3,
            'V4': transaction.V4, 'V5': transaction.V5, 'V6': transaction.V6,
            'V7': transaction.V7, 'V8': transaction.V8, 'V9': transaction.V9,
            'V10': transaction.V10, 'V11': transaction.V11, 'V12': transaction.V12,
            'V13': transaction.V13, 'V14': transaction.V14, 'V15': transaction.V15,
            'V16': transaction.V16, 'V17': transaction.V17, 'V18': transaction.V18,
            'V19': transaction.V19, 'V20': transaction.V20, 'V21': transaction.V21,
            'V22': transaction.V22, 'V23': transaction.V23, 'V24': transaction.V24,
            'V25': transaction.V25, 'V26': transaction.V26, 'V27': transaction.V27,
            'V28': transaction.V28,
            'Amount_log': amount_scaled,
            'Hour_Sin': hour_sin,
            'Hour_Cos': hour_cos
        }

        # Build array in exact training order using feature_columns list
        input_array = np.array([[feature_map[col] for col in feature_columns]])

        # --- Model Inference ---
        fraud_probability = float(model.predict_proba(input_array)[0][1])

        # --- Decision Logic ---
        if fraud_probability >= THRESHOLD:
            decision = "BLOCK"
        elif fraud_probability >= 0.01:
            decision = "FLAG"
        else:
            decision = "APPROVE"

        # --- Latency ---
        latency_ms = (time.time() - start_time) * 1000

        return PredictionResponse(
            transaction_id=transaction.transaction_id,
            fraud_probability=round(fraud_probability, 6),
            decision=decision,
            threshold_used=THRESHOLD,
            latency_ms=round(latency_ms, 3)
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")
    
SAMPLES_PATH = os.path.join(MODELS_DIR, 'sample_transactions.json')
with open(SAMPLES_PATH, 'r') as f:
    sample_transactions = json.load(f)

@app.get('/simulate')
def simulate():
    raw = random.choice(sample_transactions)
    transaction = Transaction(**raw)
    return predict(transaction)

DRIFT_REPORT_PATH = os.path.join(MODELS_DIR, 'drift_report.json')

@app.get("/drift-report")
def get_drift_report():
    if not os.path.exists(DRIFT_REPORT_PATH):
        raise HTTPException(
            status_code=404,
            detail="Drift report not found. Run drift_monitor.py first."
        )
    
    with open(DRIFT_REPORT_PATH, 'r') as f:
        report = json.load(f)
    
    return report