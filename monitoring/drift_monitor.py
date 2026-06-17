import pandas as pd
import numpy as np
import json
import os
from scipy import stats
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, '..', 'models')

REFERENCE_SAMPLE_PATH = os.path.join(MODELS_DIR, 'reference_sample.csv')
REFERENCE_STATS_PATH = os.path.join(MODELS_DIR, 'reference_stats.json')
CURRENT_DATA_PATH = os.path.join(MODELS_DIR, 'sample_transactions.json')
DRIFT_REPORT_PATH = os.path.join(MODELS_DIR, 'drift_report.json')

def load_data():
    # Load reference (training) sample
    reference_df = pd.read_csv(REFERENCE_SAMPLE_PATH)
    
    # Load reference stats
    with open(REFERENCE_STATS_PATH, 'r') as f:
        reference_stats = json.load(f)
    
    # Load current (live simulation) transactions
    with open(CURRENT_DATA_PATH, 'r') as f:
        current_raw = json.load(f)
    
    # Convert current transactions to DataFrame
    # Apply same feature engineering as training
    current_df = pd.DataFrame(current_raw)
    current_df['Amount_log'] = np.log1p(current_df['Amount'])
    current_df['Hour_Sin'] = np.sin(2 * np.pi * current_df['Hour'] / 24)
    current_df['Hour_Cos'] = np.cos(2 * np.pi * current_df['Hour'] / 24)
    
    # Keep only model features
    feature_cols = reference_df.columns.tolist()
    current_df = current_df[feature_cols]
    
    return reference_df, reference_stats, current_df

def run_ks_test(reference_df, current_df):
    results = {}
    drifted_features = []
    
    for col in reference_df.columns:
        ref_values = reference_df[col].dropna().values
        cur_values = current_df[col].dropna().values
        
        ks_stat, p_value = stats.ks_2samp(ref_values, cur_values)
        
        is_drift = bool(p_value < 0.05)
        
        results[col] = {
            'ks_statistic': round(float(ks_stat), 6),
            'p_value': round(float(p_value), 6),
            'drift_detected': is_drift
        }
        
        if is_drift:
            drifted_features.append(col)
    
    return results, drifted_features

def compute_psi(reference_series, current_series, bins=10):
    # PSI is unreliable with small samples
    if len(current_series) < 500:
        return None, "INSUFFICIENT_DATA"
    # Create bins based on reference distribution percentiles
    breakpoints = np.percentile(reference_series, 
                                np.linspace(0, 100, bins + 1))
    breakpoints = np.unique(breakpoints)  # remove duplicates
    
    # Count proportions in each bin
    ref_counts = np.histogram(reference_series, bins=breakpoints)[0]
    cur_counts = np.histogram(current_series, bins=breakpoints)[0]
    
    # Convert to proportions, avoid division by zero
    ref_props = ref_counts / len(reference_series)
    cur_props = cur_counts / len(current_series)
    
    # Clip to avoid log(0)
    ref_props = np.clip(ref_props, 1e-10, None)
    cur_props = np.clip(cur_props, 1e-10, None)
    
    # PSI formula
    psi = np.sum((cur_props - ref_props) * np.log(cur_props / ref_props))
    psi_value = round(float(psi), 6)
    
    return psi_value, interpret_psi(psi_value)


def interpret_psi(psi_value):
    if psi_value is None:
        return "INSUFFICIENT_DATA"
    if psi_value < 0.10:
        return "STABLE"
    elif psi_value < 0.20:
        return "MONITOR"
    else:
        return "RETRAIN"
    
def get_overall_status(drifted_features, psi_value):
    drift_ratio = len(drifted_features) / 31
    
    psi_critical = psi_value is not None and psi_value > 0.20
    psi_warning = psi_value is not None and psi_value > 0.10
    
    if drift_ratio > 0.3 or psi_critical:
        return "CRITICAL"
    elif drift_ratio > 0.1 or psi_warning:
        return "WARNING"
    else:
        return "HEALTHY"
    
def run_drift_monitoring():
    print("Loading data...")
    reference_df, reference_stats, current_df = load_data()
    
    print(f"Reference data: {len(reference_df)} rows")
    print(f"Current data: {len(current_df)} rows")
    
    # Run KS test
    print("\nRunning KS tests...")
    ks_results, drifted_features = run_ks_test(reference_df, current_df)
    
    # Compute PSI on Amount_log (most business-relevant feature)
    print("Computing PSI...")
    psi_value, psi_status = compute_psi(
        reference_df['Amount_log'].values,
        current_df['Amount_log'].values
    )
    
    # Overall status
    overall_status = get_overall_status(drifted_features, psi_value)
    
    # Build report
    report = {
        'generated_at': datetime.now().isoformat(),
        'reference_size': len(reference_df),
        'current_size': len(current_df),
        'overall_status': overall_status,
        'drifted_features': drifted_features,
        'drift_count': len(drifted_features),
        'total_features': len(reference_df.columns),
        'psi_amount': {
            'value': psi_value,
            'status': psi_status
        },
        'ks_results': ks_results
    }
    
    # Save report
    with open(DRIFT_REPORT_PATH, 'w') as f:
        json.dump(report, f, indent=2)
    
    # Print summary
    print("\n" + "="*45)
    print("DRIFT MONITORING REPORT")
    print("="*45)
    print(f"Generated at : {report['generated_at']}")
    print(f"Reference    : {report['reference_size']} rows")
    print(f"Current      : {report['current_size']} rows")
    print(f"Drifted      : {len(drifted_features)}/{len(reference_df.columns)} features")
    print(f"PSI (Amount) : {psi_value} → {psi_status}")
    print(f"Overall      : {overall_status}")
    
    if drifted_features:
        print(f"\nDrifted features: {drifted_features}")
    
    print("="*45)
    print(f"Report saved → {DRIFT_REPORT_PATH}")
    
    return report


if __name__ == "__main__":
    run_drift_monitoring()

