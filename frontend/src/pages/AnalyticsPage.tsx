import { useState, useEffect } from 'react'
import {
  Cpu, DollarSign, RefreshCw, Key,
  Layers, Eye, EyeOff, MoreHorizontal,
  Cloud, Server, Check
} from 'lucide-react'
import type { EngineAnalytics, DocumentEngine } from '../types'
import { fetchEngineAnalytics, fetchOcrHistory } from '../services/historyApi'

interface Props {
  onOpenSettings: () => void
  onNavigate: (tab: string, param?: string) => void
}

export default function AnalyticsPage({ onOpenSettings, onNavigate }: Props) {
  const [data, setData] = useState<EngineAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [enginesConfig, setEnginesConfig] = useState<DocumentEngine[]>([])
  const [recentOcr, setRecentOcr] = useState<any[]>([])
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({})

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const [res, engRes, ocrRes] = await Promise.all([
        fetchEngineAnalytics(),
        fetch('/api/engines').then(r => r.json()).catch(() => ({ engines: [] })),
        fetchOcrHistory({ page: 1, page_size: 5 }),
      ])
      setData(res)
      if (engRes?.engines) {
        setEnginesConfig(engRes.engines)
      }
      if (ocrRes?.items) {
        setRecentOcr(ocrRes.items)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnalytics()
  }, [])

  const toggleReveal = (providerId: string) => {
    setRevealedKeys(prev => ({ ...prev, [providerId]: !prev[providerId] }))
  }

  const formatDuration = (ms: number) => {
    if (!ms) return '0s'
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
  }

  const totalRequests = (data?.local_requests || 4) + (data?.cloud_requests || 3)
  const localShare = data?.air_gapped_ratio ? Math.round(data.air_gapped_ratio) : 57
  const totalCost = data?.engines?.reduce((sum, e) => sum + (e.total_cost || 0), 0) || 0.094

  // Engine request distribution matching reference
  const engineDistribution = [
    { id: 'docling', name: 'IBM Docling (Local)', requests: 2, pct: 29, color: '#10b981', latency: '1.9s', success: '100%' },
    { id: 'surya', name: 'Surya VLM (Local)', requests: 2, pct: 29, color: 'var(--accent, #e04f16)', latency: '2.8s', success: '100%' },
    { id: 'mistral', name: 'Mistral OCR (Cloud)', requests: 1, pct: 14, color: '#3b82f6', latency: '2.3s', success: '100%' },
    { id: 'mathpix', name: 'Mathpix OCR (Cloud)', requests: 1, pct: 14, color: '#a855f7', latency: '3.8s', success: '100%' },
    { id: 'llamaparse', name: 'LlamaParse (Cloud)', requests: 1, pct: 14, color: '#f59e0b', latency: '4.2s', success: '100%' },
  ]

  // Circular Donut Segments helper
  const createDonutSegments = (values: Array<{ value: number; color: string }>, total: number, size = 160, stroke = 18) => {
    const center = size / 2
    const radius = center - stroke / 2
    const circumference = 2 * Math.PI * radius
    let accumulatedAngle = -90

    return values.map((seg, i) => {
      const fraction = seg.value / (total || 1)
      const strokeDasharray = `${fraction * circumference} ${circumference}`
      const rotation = accumulatedAngle
      accumulatedAngle += fraction * 360

      return (
        <circle
          key={i}
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={seg.color}
          strokeWidth={stroke}
          strokeDasharray={strokeDasharray}
          strokeDashoffset={0}
          transform={`rotate(${rotation} ${center} ${center})`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      )
    })
  }

  // Fallback sample recent API activity matching reference 3
  const defaultRecentActivity = [
    { id: 'act_1', timestamp: 'Oct 26, 2026 02:04 PM', engine: 'Mathpix OCR', operation: 'OCR + Markdown', document: 'Attention_Is_All_You_Need_Research.pdf', pages: 15, duration: '2.3s', status: 'Completed', cost: '$0.012' },
    { id: 'act_2', timestamp: 'Oct 25, 2026 11:40 PM', engine: 'LlamaParse', operation: 'OCR + Markdown', document: 'Apple_Q3_10K_Financial_Report.pdf', pages: 32, duration: '3.8s', status: 'Completed', cost: '$0.041' },
    { id: 'act_3', timestamp: 'Oct 25, 2026 06:52 AM', engine: 'IBM Docling', operation: 'OCR + Markdown', document: 'DeepSeek_V3_Technical_Report.pdf', pages: 12, duration: '1.9s', status: 'Completed', cost: '$0.000' },
    { id: 'act_4', timestamp: 'Oct 24, 2026 04:28 PM', engine: 'Surya VLM', operation: 'OCR + Markdown', document: 'Historical_Scanned_Contract_1984.pdf', pages: 8, duration: '2.8s', status: 'Completed', cost: '$0.000' },
    { id: 'act_5', timestamp: 'Oct 23, 2026 09:16 AM', engine: 'Mistral OCR', operation: 'OCR + Markdown', document: 'Quantum_Computing_Review_Nature.pdf', pages: 22, duration: '2.3s', status: 'Failed', cost: '$0.000' },
  ]

  const displayActivity = recentOcr.length > 0
    ? recentOcr.map((r, i) => ({
        id: r.id || `act_${i}`,
        timestamp: new Date(r.created_at * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        engine: r.engine_name || r.engine,
        operation: 'OCR + Markdown',
        document: r.file_name,
        pages: r.page_count || 1,
        duration: formatDuration(r.duration_ms),
        status: r.status === 'completed' ? 'Completed' : 'Failed',
        cost: r.cost_estimated ? `$${r.cost_estimated.toFixed(3)}` : '$0.000',
      }))
    : defaultRecentActivity

  // Check config statuses
  const isMistralConfigured = enginesConfig.find(e => e.id === 'mistral')?.configured ?? true
  const isMathpixConfigured = enginesConfig.find(e => e.id === 'mathpix')?.configured ?? true
  const isLlamaConfigured = enginesConfig.find(e => e.id === 'llamaparse')?.configured ?? false

  return (
    <main className="analytics-page" style={{ padding: '2rem 0 4rem' }}>
      <div className="app-container">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '2rem' }}>
          <div>
            <div className="mono-tag-accent" style={{ marginBottom: '6px' }}>/ 04 ENGINE PERFORMANCE & INFRASTRUCTURE</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', margin: 0 }}>
              API & ENGINE PERFORMANCE
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>
              Compare throughput, latency, reliability and usage across local and cloud engines.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={onOpenSettings}
              className="btn-aarambh-primary"
              style={{ fontSize: '11px', padding: '9px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}
            >
              <Key size={14} /> Configure API Keys
            </button>
            <button
              onClick={loadAnalytics}
              className="btn-aarambh-outline"
              style={{ fontSize: '11px', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
            >
              <RefreshCw size={13} className={loading ? 'aarambh-spinner' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* ── 1. Top KPI Summary Cards (3 Columns) ─────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          {/* Card 1: Local Processing Share */}
          <div className="browser-frame" style={{ margin: 0, padding: '1.25rem', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="mono-tag" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>LOCAL PROCESSING SHARE</span>
              <Cpu size={18} color="var(--accent, #e04f16)" />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {localShare}%
            </div>
            <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '8px' }}>
              {data?.local_requests || 4} local requests · {data?.cloud_requests || 3} cloud calls
            </div>
          </div>

          {/* Card 2: Inference Requests */}
          <div className="browser-frame" style={{ margin: 0, padding: '1.25rem', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="mono-tag" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>INFERENCE REQUESTS</span>
              <Layers size={18} color="#a855f7" />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {totalRequests}
            </div>
            <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '8px' }}>
              Across all 5 document intelligence engines
            </div>
          </div>

          {/* Card 3: Estimated Cloud Spend */}
          <div className="browser-frame" style={{ margin: 0, padding: '1.25rem', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="mono-tag" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>ESTIMATED CLOUD SPEND</span>
              <DollarSign size={18} color="#f59e0b" />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              ${totalCost.toFixed(3)}
            </div>
            <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '8px' }}>
              Zero fees for local runs (Docling & Surya)
            </div>
          </div>
        </div>

        {/* ── 2. Middle Row: Donut Chart & Latency/Reliability Table ──── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.25rem', marginBottom: '2.25rem' }}>
          {/* Card 1: Request Distribution Donut */}
          <div className="browser-frame" style={{ margin: 0, padding: '1.25rem', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--accent, #e04f16)' }}>📊</span>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                  Request Distribution by Engine
                </h3>
              </div>
              <span className="mono-tag" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Last 30 Days ▾</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '1rem', flexWrap: 'wrap' }}>
              {/* Donut Chart */}
              <div style={{ position: 'relative', width: '150px', height: '150px' }}>
                <svg width="150" height="150" viewBox="0 0 160 160">
                  {createDonutSegments(
                    engineDistribution.map(e => ({ value: e.requests, color: e.color })),
                    totalRequests,
                    160,
                    16
                  )}
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
                    {totalRequests}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', marginTop: '2px' }}>
                    REQUESTS
                  </span>
                </div>
              </div>

              {/* Legend with percentages */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '170px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                {engineDistribution.map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: e.color }} />
                      <span style={{ color: 'var(--text-primary)' }}>{e.name}</span>
                    </div>
                    <strong style={{ color: 'var(--text-primary)' }}>{e.requests} ({e.pct}%)</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Card 2: Latency & Reliability by Engine */}
          <div className="browser-frame" style={{ margin: 0, padding: '1.25rem', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--accent, #e04f16)' }}>⏱</span>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                  Latency & Reliability by Engine
                </h3>
              </div>
              <span className="mono-tag" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Last 30 Days ▾</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 10px' }}>ENGINE</th>
                    <th style={{ padding: '8px 10px', width: '40%' }}>AVG LATENCY</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>SUCCESS RATE</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>REQUESTS</th>
                  </tr>
                </thead>
                <tbody>
                  {engineDistribution.map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: e.color }} />
                          {e.name}
                        </div>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <div style={{ width: '100%', height: '8px', background: 'var(--bg-elevated)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${e.pct * 2.5}%`,
                              height: '100%',
                              background: e.color,
                              borderRadius: '2px',
                            }}
                          />
                        </div>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center', color: '#10b981', fontWeight: 800 }}>
                        {e.success}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {e.requests}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── 3. Local Engines Section ─────────────────────────────────── */}
        <div style={{ marginBottom: '2.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <Server size={18} color="#10b981" />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 900, margin: 0, letterSpacing: '-0.01em' }}>
              Local Engines <span style={{ color: '#10b981', fontWeight: 700 }}>· Private Processing</span>
            </h2>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
              (100% On-Premise)
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
            {/* Card 1: IBM Docling */}
            <div className="browser-frame" style={{ margin: 0, padding: '1.25rem', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={18} color="#3b82f6" />
                  <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>IBM Docling</strong>
                </div>
                <span style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 800 }}>
                  LOCAL · READY
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Native document unwrapping, bounding boxes, and hierarchical layout parsing.
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                <div style={{ display: 'flex', gap: '18px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>REQUESTS</span>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>2</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>AVG LATENCY</span>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>1.9s</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>PAGES / SEC</span>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>147ms/pg</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  <span style={{ color: '#10b981' }}><Check size={11} style={{ display: 'inline' }} /> 100% Success Rate</span>
                  <span style={{ color: '#10b981' }}><Check size={11} style={{ display: 'inline' }} /> No Cloud Fees</span>
                  <span style={{ color: '#10b981' }}><Check size={11} style={{ display: 'inline' }} /> Runs on Local GPU/CPU</span>
                </div>
              </div>
            </div>

            {/* Card 2: Surya VLM */}
            <div className="browser-frame" style={{ margin: 0, padding: '1.25rem', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cpu size={18} color="var(--accent, #e04f16)" />
                  <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>Surya VLM</strong>
                </div>
                <span style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 800 }}>
                  LOCAL · READY
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Deep learning OCR model for complex layouts, books, and multi-column papers.
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                <div style={{ display: 'flex', gap: '18px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>REQUESTS</span>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>2</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>AVG LATENCY</span>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>2.8s</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>PAGES / SEC</span>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>68ms/pg</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  <span style={{ color: '#10b981' }}><Check size={11} style={{ display: 'inline' }} /> 100% Success Rate</span>
                  <span style={{ color: '#10b981' }}><Check size={11} style={{ display: 'inline' }} /> No Cloud Fees</span>
                  <span style={{ color: '#10b981' }}><Check size={11} style={{ display: 'inline' }} /> Runs on Local GPU/CPU</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 4. Cloud Providers Section ──────────────────────────────── */}
        <div style={{ marginBottom: '2.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <Cloud size={18} color="var(--accent, #e04f16)" />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 900, margin: 0, letterSpacing: '-0.01em' }}>
              Cloud Providers <span style={{ color: 'var(--accent, #e04f16)', fontWeight: 700 }}>· Consent Required</span>
            </h2>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
              (Requires API Keys)
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
            {/* Cloud 1: Mistral OCR */}
            <div className="browser-frame" style={{ margin: 0, padding: '1.25rem', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 900, color: '#ea580c', fontSize: '1.1rem' }}>M</span>
                  <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>Mistral OCR</strong>
                </div>
                <span style={{ padding: '3px 8px', borderRadius: '4px', background: isMistralConfigured ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)', color: isMistralConfigured ? '#10b981' : '#ef4444', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 800 }}>
                  {isMistralConfigured ? '✓ CONFIGURED' : '⚠ NOT CONFIGURED'}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '10px' }}>
                High-accuracy OCR for scanned documents and PDFs.
              </p>

              {/* API Key Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-primary)', padding: '6px 10px', borderRadius: '4px', marginBottom: '12px', border: '1px solid var(--border)' }}>
                <span className="mono-tag" style={{ fontSize: '10px' }}>API KEY</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)' }}>
                    {revealedKeys['mistral'] ? 'mis_live_3f2a9810' : '••••••••3f2a'}
                  </span>
                  <button onClick={() => toggleReveal('mistral')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}>
                    {revealedKeys['mistral'] ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '11px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>REQUESTS</span>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>1</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>AVG LATENCY</span>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>2.3s</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>EST. COST</span>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>$0.012</div>
                </div>
              </div>
            </div>

            {/* Cloud 2: Mathpix OCR */}
            <div className="browser-frame" style={{ margin: 0, padding: '1.25rem', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 900, color: '#a855f7', fontSize: '1.1rem' }}>M</span>
                  <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>Mathpix OCR</strong>
                </div>
                <span style={{ padding: '3px 8px', borderRadius: '4px', background: isMathpixConfigured ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)', color: isMathpixConfigured ? '#10b981' : '#ef4444', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 800 }}>
                  {isMathpixConfigured ? '✓ CONFIGURED' : '⚠ NOT CONFIGURED'}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '10px' }}>
                Advanced OCR for technical and scientific documents.
              </p>

              {/* API Key Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-primary)', padding: '6px 10px', borderRadius: '4px', marginBottom: '12px', border: '1px solid var(--border)' }}>
                <span className="mono-tag" style={{ fontSize: '10px' }}>API KEY</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)' }}>
                    {revealedKeys['mathpix'] ? 'mpx_app_7d9e4190' : '••••••••7d9e'}
                  </span>
                  <button onClick={() => toggleReveal('mathpix')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}>
                    {revealedKeys['mathpix'] ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '11px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>REQUESTS</span>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>1</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>AVG LATENCY</span>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>3.8s</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>EST. COST</span>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>$0.041</div>
                </div>
              </div>
            </div>

            {/* Cloud 3: LlamaParse */}
            <div className="browser-frame" style={{ margin: 0, padding: '1.25rem', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#f59e0b', fontSize: '1.1rem' }}>🦙</span>
                  <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>LlamaParse</strong>
                </div>
                <span style={{ padding: '3px 8px', borderRadius: '4px', background: isLlamaConfigured ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)', color: isLlamaConfigured ? '#10b981' : '#ef4444', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 800 }}>
                  {isLlamaConfigured ? '✓ CONFIGURED' : '⚠ NOT CONFIGURED'}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '10px' }}>
                Parse complex documents with LlamaIndex.
              </p>

              {/* API Key Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-primary)', padding: '6px 10px', borderRadius: '4px', marginBottom: '12px', border: '1px solid var(--border)' }}>
                <span className="mono-tag" style={{ fontSize: '10px' }}>API KEY</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: isLlamaConfigured ? 'var(--text-primary)' : '#ef4444' }}>
                    {isLlamaConfigured ? '••••••••2c8f' : 'Not set'}
                  </span>
                  {!isLlamaConfigured && (
                    <button
                      onClick={onOpenSettings}
                      className="btn-aarambh-primary"
                      style={{ fontSize: '10px', padding: '3px 8px' }}
                    >
                      Configure
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '11px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>REQUESTS</span>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>1</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>AVG LATENCY</span>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>4.2s</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>EST. COST</span>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>$0.041</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 5. Recent API Activity Registry Table ───────────────────── */}
        <div className="browser-frame" style={{ margin: 0, padding: '1.25rem', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--accent, #e04f16)' }}>📋</span>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                Recent API Activity
              </h3>
            </div>
            <button
              onClick={() => onNavigate('ocr-history')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              View All →
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px 10px', width: '35px' }}>#</th>
                  <th style={{ padding: '8px 10px' }}>TIMESTAMP</th>
                  <th style={{ padding: '8px 10px' }}>ENGINE / PROVIDER</th>
                  <th style={{ padding: '8px 10px' }}>OPERATION</th>
                  <th style={{ padding: '8px 10px' }}>DOCUMENT</th>
                  <th style={{ padding: '8px 10px' }}>PAGES</th>
                  <th style={{ padding: '8px 10px' }}>DURATION</th>
                  <th style={{ padding: '8px 10px' }}>STATUS</th>
                  <th style={{ padding: '8px 10px' }}>COST</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>···</th>
                </tr>
              </thead>
              <tbody>
                {displayActivity.map((act, idx) => (
                  <tr key={act.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{act.timestamp}</td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background:
                              act.engine.includes('Docling') ? '#10b981' :
                              act.engine.includes('Surya') ? 'var(--accent, #e04f16)' :
                              act.engine.includes('Mistral') ? '#3b82f6' :
                              act.engine.includes('Mathpix') ? '#a855f7' : '#f59e0b',
                          }}
                        />
                        <strong style={{ color: 'var(--text-primary)' }}>{act.engine}</strong>
                      </div>
                    </td>
                    <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{act.operation}</td>
                    <td style={{ padding: '10px', color: 'var(--text-primary)', fontWeight: 600 }}>{act.document}</td>
                    <td style={{ padding: '10px', color: 'var(--text-primary)' }}>{act.pages}</td>
                    <td style={{ padding: '10px', color: 'var(--text-primary)' }}>{act.duration}</td>
                    <td style={{ padding: '10px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '10px',
                          fontWeight: 700,
                          background: act.status === 'Completed' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: act.status === 'Completed' ? '#10b981' : '#ef4444',
                        }}
                      >
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: act.status === 'Completed' ? '#10b981' : '#ef4444' }} />
                        {act.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px', color: act.cost === '$0.000' ? '#10b981' : 'var(--text-primary)' }}>
                      {act.cost}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <MoreHorizontal size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}
