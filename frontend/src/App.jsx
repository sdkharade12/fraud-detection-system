import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

const API = 'http://127.0.0.1:8000'

// --- Small reusable components ---

function DecisionBadge({ decision }) {
  const styles = {
    APPROVE: { background: '#d4edda', color: '#155724', border: '1px solid #c3e6cb' },
    FLAG:    { background: '#fff3cd', color: '#856404', border: '1px solid #ffeeba' },
    BLOCK:   { background: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb' },
  }
  const style = styles[decision] || styles.APPROVE
  return (
    <span style={{
      ...style,
      padding: '3px 10px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '600'
    }}>
      {decision}
    </span>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '20px 24px',
      boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
      borderTop: `3px solid ${color}`,
      minWidth: '140px',
      flex: 1
    }}>
      <div style={{ fontSize: '12px', color: '#8492a6', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>{label}</div>
      <div style={{ fontSize: '32px', fontWeight: '800', color }}>{value}</div>
    </div>
  )
}

// --- Main App ---

export default function App() {
  const [serverStatus, setServerStatus] = useState('checking...')
  const [transactions, setTransactions] = useState([])
  const [latencyData, setLatencyData] = useState([])
  const [driftReport, setDriftReport] = useState(null)
  const [loading, setLoading] = useState(false)

  // Check server health on load
  useEffect(() => {
    axios.get(`${API}/health`)
      .then(() => setServerStatus('online'))
      .catch(() => setServerStatus('offline'))

    axios.get(`${API}/drift-report`)
      .then(res => setDriftReport(res.data))
      .catch(() => setDriftReport(null))
  }, [])

  // Simulate a transaction
  const simulate = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${API}/simulate`)
      const tx = res.data

      setTransactions(prev => [tx, ...prev])
      setLatencyData(prev => [
        ...prev,
        { index: prev.length + 1, latency: tx.latency_ms }
      ])
    } catch (err) {
      alert('API error — is FastAPI running?')
    }
    setLoading(false)
  }

  // Compute stats
  const total = transactions.length
  const fraudCount = transactions.filter(t => t.decision !== 'APPROVE').length
  const approveCount = transactions.filter(t => t.decision === 'APPROVE').length
  const flagCount = transactions.filter(t => t.decision === 'FLAG').length
  const blockCount = transactions.filter(t => t.decision === 'BLOCK').length

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa' }}>

      {/* Header */}
      <div style={{
        background: 'white',
        borderBottom: '2px solid #e8ecf0',
        padding: '18px 36px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: '#ebf3fd',
            padding: '8px',
            borderRadius: '8px',
            fontSize: '20px'
          }}>🛡️</div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#1a1a2e', letterSpacing: '-0.3px' }}>
              Fraud Detection System
            </h1>
            <p style={{ fontSize: '12px', color: '#8492a6', marginTop: '1px' }}>
              Real-time transaction monitoring • XGBoost Model • Threshold: {transactions.length > 0 ? transactions[0].threshold_used : '0.1'}
            </p>
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          fontSize: '13px',
          fontWeight: '500',
          color: serverStatus === 'online' ? '#27ae60' : '#e74c3c',
          background: serverStatus === 'online' ? '#f0faf4' : '#fdf0f0',
          padding: '8px 16px',
          borderRadius: '20px',
          border: `1px solid ${serverStatus === 'online' ? '#b7e4c7' : '#f5c6cb'}`
        }}>
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: serverStatus === 'online' ? '#27ae60' : '#e74c3c',
            display: 'inline-block',
            boxShadow: serverStatus === 'online' ? '0 0 0 2px #b7e4c7' : '0 0 0 2px #f5c6cb'
          }} />
          API {serverStatus}
        </div>
      </div>

      <div style={{ padding: '28px 32px' }}>

        {/* Stats Row */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
          <StatCard label="Total Simulated" value={total}        color="#3498db" />
          <StatCard label="Approved"         value={approveCount} color="#27ae60" />
          <StatCard label="Flagged"          value={flagCount}    color="#f39c12" />
          <StatCard label="Blocked"          value={blockCount}   color="#e74c3c" />
          <StatCard label="Fraud Detected"   value={fraudCount}   color="#8e44ad" />
        </div>

        {/* Simulate Button */}
        <div style={{ marginBottom: '24px' }}>
          <button
            onClick={simulate}
            disabled={loading}
            style={{
              background: loading ? '#b2bec3' : '#3498db',
              color: 'white',
              border: 'none',
              padding: '12px 28px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s'
            }}
          >
            {loading ? 'Simulating...' : '⚡ Simulate Transaction'}
          </button>
        </div>

        {/* Two column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>

          {/* Latency Chart */}
          <div style={{ background: 'white', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: '#2d3436' }}>
              API Latency (ms)
            </h2>
            {latencyData.length === 0 ? (
              <p style={{ color: '#b2bec3', fontSize: '13px', textAlign: 'center', paddingTop: '40px' }}>
                Simulate transactions to see latency
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={latencyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="index" tick={{ fontSize: 11 }} label={{ value: 'Request #', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} label={{ value: 'ms', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                  <Tooltip formatter={(val) => [`${val} ms`, 'Latency']} />
                  <Line type="monotone" dataKey="latency" stroke="#3498db" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Drift Report */}
          <div style={{ background: 'white', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: '#2d3436' }}>
              Drift Monitoring
            </h2>
            {!driftReport ? (
              <p style={{ color: '#b2bec3', fontSize: '13px' }}>No drift report available</p>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', color: '#636e72' }}>Overall Status:</span>
                  <span style={{
                    padding: '3px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    background: driftReport.overall_status === 'HEALTHY' ? '#d4edda' :
                                driftReport.overall_status === 'WARNING' ? '#fff3cd' : '#f8d7da',
                    color: driftReport.overall_status === 'HEALTHY' ? '#155724' :
                           driftReport.overall_status === 'WARNING' ? '#856404' : '#721c24'
                  }}>
                    {driftReport.overall_status}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#636e72', marginBottom: '8px' }}>
                  Features drifted: <strong>{driftReport.drift_count} / {driftReport.total_features}</strong>
                </div>
                <div style={{ fontSize: '13px', color: '#636e72', marginBottom: '8px' }}>
                  PSI (Amount): <strong>{driftReport.psi_amount.status}</strong>
                </div>
                <div style={{ fontSize: '13px', color: '#636e72', marginBottom: '6px' }}>
                  Report generated: {new Date(driftReport.generated_at).toLocaleString()}
                </div>
                {driftReport.drifted_features.length > 0 && (
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ fontSize: '12px', color: '#636e72', marginBottom: '6px' }}>Drifted features:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {driftReport.drifted_features.map(f => (
                        <span key={f} style={{
                          background: '#fff3cd', color: '#856404',
                          border: '1px solid #ffeeba',
                          padding: '2px 8px', borderRadius: '10px', fontSize: '11px'
                        }}>{f}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Transaction Log */}
        <div style={{ background: 'white', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: '#2d3436' }}>
            Transaction Log
          </h2>
          {transactions.length === 0 ? (
            <p style={{ color: '#b2bec3', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>
              No transactions yet — click Simulate to begin
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                  {['Transaction ID', 'Fraud Probability', 'Decision', 'Threshold', 'Latency (ms)'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#636e72', fontWeight: '600' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{tx.transaction_id}</td>
                    <td style={{ padding: '10px 12px' }}>{(tx.fraud_probability * 100).toFixed(4)}%</td>
                    <td style={{ padding: '10px 12px' }}><DecisionBadge decision={tx.decision} /></td>
                    <td style={{ padding: '10px 12px' }}>{tx.threshold_used}</td>
                    <td style={{ padding: '10px 12px' }}>{tx.latency_ms} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}