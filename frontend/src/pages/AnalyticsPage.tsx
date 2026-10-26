import { useState, useEffect } from 'react'
import {
  Cpu, ShieldCheck, DollarSign, RefreshCw, Settings
} from 'lucide-react'
import type { EngineAnalytics, DocumentEngine } from '../types'
import { fetchEngineAnalytics } from '../services/historyApi'

interface Props {
  onOpenSettings: () => void
  onNavigate: (tab: string) => void
}

export default function AnalyticsPage({ onOpenSettings, onNavigate }: Props) {
  const [data, setData] = useState<EngineAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [enginesConfig, setEnginesConfig] = useState<DocumentEngine[]>([])

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const [res, engRes] = await Promise.all([
        fetchEngineAnalytics(),
        fetch('/api/engines').then(r => r.json()).catch(() => ({ engines: [] })),
      ])
      setData(res)
      if (engRes?.engines) {
        setEnginesConfig(engRes.engines)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnalytics()
  }, [])

  const formatDuration = (ms: number) => {
    if (!ms) return '0s'
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
  }

  const getEngineConfigStatus = (providerId: string) => {
    const match = enginesConfig.find(e => e.id === providerId)
    if (providerId === 'docling' || providerId === 'surya') {
      return { configured: true, label: 'AIR-GAPPED (READY)', color: '#10b981' }
    }
    if (match?.configured) {
      return { configured: true, label: 'CONNECTED & ACTIVE', color: '#10b981' }
    }
    return { configured: false, label: 'KEY REQUIRED', color: 'var(--accent)' }
  }

  const totalReqs = (data?.local_requests || 0) + (data?.cloud_requests || 0)
  const airGappedRatio = totalReqs > 0 ? Math.round(((data?.local_requests || 0) / totalReqs) * 100) : 100

  return (
    <main className="analytics-page" style={{ padding: '2rem 0 4rem' }}>
      <div className="app-container">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '2rem' }}>
          <div>
            <div className="mono-tag-accent" style={{ marginBottom: '6px' }}>/ 04 ENGINE PERFORMANCE & INFRASTRUCTURE</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', margin: 0 }}>
              API & Engine Performance
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>
              Comparative execution speed, error rates, token reduction, and real expenditure across local and cloud providers.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={onOpenSettings}
              className="btn-aarambh-primary"
              style={{ fontSize: '11px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Settings size={13} /> CONFIGURE API KEYS
            </button>
            <button
              onClick={loadAnalytics}
              className="btn-aarambh-outline"
              style={{ fontSize: '11px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={13} className={loading ? 'aarambh-spinner' : ''} /> REFRESH
            </button>
          </div>
        </div>

        {/* ── 1. Top Summary Strip ──────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="browser-frame" style={{ margin: 0, padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span className="mono-tag">AIR-GAPPED PRIVACY RATIO</span>
              <ShieldCheck size={16} color="#10b981" />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900, color: '#10b981' }}>
              {airGappedRatio}%
            </div>
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '4px' }}>
              {data?.local_requests || 0} local requests · {data?.cloud_requests || 0} cloud calls
            </div>
          </div>

          <div className="browser-frame" style={{ margin: 0, padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span className="mono-tag">TOTAL INFERENCE REQUESTS</span>
              <Cpu size={16} color="var(--accent)" />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)' }}>
              {totalReqs}
            </div>
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '4px' }}>
              Across all 5 document intelligence engines
            </div>
          </div>

          <div className="browser-frame" style={{ margin: 0, padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span className="mono-tag">TOTAL ESTIMATED CLOUD EXPENSE</span>
              <DollarSign size={16} color="#f59e0b" />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)' }}>
              ${(data?.engines.reduce((acc, e) => acc + e.total_cost, 0) || 0).toFixed(3)}
            </div>
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '4px' }}>
              Zero fees for Docling & Surya local runs
            </div>
          </div>
        </div>

        {/* ── 2. Local Air-Gapped Engines vs Cloud APIs ─────────────── */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div className="mono-tag-accent" style={{ marginBottom: '8px' }}>
            SECTION 01 · LOCAL AIR-GAPPED ENGINES (100% PRIVATE)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.25rem' }}>
            {/* IBM Docling */}
            {data?.engines.filter(e => e.provider === 'docling').map(eng => {
              const status = getEngineConfigStatus('docling')
              return (
                <div key={eng.provider} className="browser-frame" style={{ margin: 0 }}>
                  <div className="browser-frame__header">
                    <div className="browser-frame__dots">
                      <span className="browser-frame__dot" />
                      <span className="browser-frame__dot" />
                      <span className="browser-frame__dot" />
                    </div>
                    <div className="browser-frame__address">engine://ibm-docling.local</div>
                    <div style={{ marginLeft: 'auto' }}>
                      <span className="mono-tag" style={{ color: status.color, borderColor: status.color }}>
                        {status.label}
                      </span>
                    </div>
                  </div>

                  <div style={{ padding: '1.5rem', background: 'var(--bg-card)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 900, margin: '0 0 4px 0' }}>
                          IBM Docling
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                          Native document unwarping, bounding boxes, and hierarchical layout parsing.
                        </p>
                      </div>
                      <span className="mono-tag" style={{ color: '#10b981' }}>AIR-GAPPED</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>REQUESTS</div>
                        <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)' }}>{eng.request_count} ({eng.success_rate}%)</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>AVG LATENCY</div>
                        <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)' }}>{formatDuration(eng.avg_duration_ms)}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>PACE / PAGE</div>
                        <div style={{ fontWeight: 800, fontSize: '14px', color: '#10b981' }}>{eng.avg_duration_per_page_ms}ms/pg</div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Surya VLM */}
            {data?.engines.filter(e => e.provider === 'surya').map(eng => {
              const status = getEngineConfigStatus('surya')
              return (
                <div key={eng.provider} className="browser-frame" style={{ margin: 0 }}>
                  <div className="browser-frame__header">
                    <div className="browser-frame__dots">
                      <span className="browser-frame__dot" />
                      <span className="browser-frame__dot" />
                      <span className="browser-frame__dot" />
                    </div>
                    <div className="browser-frame__address">engine://surya-vlm.local</div>
                    <div style={{ marginLeft: 'auto' }}>
                      <span className="mono-tag" style={{ color: status.color, borderColor: status.color }}>
                        {status.label}
                      </span>
                    </div>
                  </div>

                  <div style={{ padding: '1.5rem', background: 'var(--bg-card)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 900, margin: '0 0 4px 0' }}>
                          Surya Vision-Language Model
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                          Deep learning OCR model on GPU/CPU for damaged print, books, and multi-column papers.
                        </p>
                      </div>
                      <span className="mono-tag" style={{ color: '#10b981' }}>AIR-GAPPED</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>REQUESTS</div>
                        <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)' }}>{eng.request_count} ({eng.success_rate}%)</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>AVG LATENCY</div>
                        <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)' }}>{formatDuration(eng.avg_duration_ms)}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>PACE / PAGE</div>
                        <div style={{ fontWeight: 800, fontSize: '14px', color: '#10b981' }}>{eng.avg_duration_per_page_ms}ms/pg</div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── 3. Cloud Provider APIs ─────────────────────────────────── */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div className="mono-tag-accent" style={{ marginBottom: '8px' }}>
            SECTION 02 · CLOUD PROVIDER INTEGRATIONS (CONSENT REQUIRED)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
            {/* Mistral OCR */}
            {data?.engines.filter(e => e.provider === 'mistral').map(eng => {
              const status = getEngineConfigStatus('mistral')
              return (
                <div key={eng.provider} className="browser-frame" style={{ margin: 0 }}>
                  <div className="browser-frame__header">
                    <div className="browser-frame__dots">
                      <span className="browser-frame__dot" />
                      <span className="browser-frame__dot" />
                      <span className="browser-frame__dot" />
                    </div>
                    <div className="browser-frame__address">api.mistral.ai/v1/ocr</div>
                    <div style={{ marginLeft: 'auto' }}>
                      <span className="mono-tag" style={{ color: status.color, borderColor: status.color }}>
                        {status.label}
                      </span>
                    </div>
                  </div>

                  <div style={{ padding: '1.25rem', background: 'var(--bg-card)' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 900, margin: '0 0 4px 0' }}>
                      Mistral OCR API
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '0 0 14px 0' }}>
                      Multimodal vision architecture for scanned forms and complex graphics.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '10px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>CALLS:</span>
                        <span style={{ fontWeight: 700 }}>{eng.request_count} reqs ({eng.success_rate}%)</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>AVG SPEED:</span>
                        <span style={{ fontWeight: 700 }}>{formatDuration(eng.avg_duration_ms)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>EST. USAGE COST:</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>${eng.total_cost.toFixed(3)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Mathpix OCR */}
            {data?.engines.filter(e => e.provider === 'mathpix').map(eng => {
              const status = getEngineConfigStatus('mathpix')
              return (
                <div key={eng.provider} className="browser-frame" style={{ margin: 0 }}>
                  <div className="browser-frame__header">
                    <div className="browser-frame__dots">
                      <span className="browser-frame__dot" />
                      <span className="browser-frame__dot" />
                      <span className="browser-frame__dot" />
                    </div>
                    <div className="browser-frame__address">api.mathpix.com/v3/pdf</div>
                    <div style={{ marginLeft: 'auto' }}>
                      <span className="mono-tag" style={{ color: status.color, borderColor: status.color }}>
                        {status.label}
                      </span>
                    </div>
                  </div>

                  <div style={{ padding: '1.25rem', background: 'var(--bg-card)' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 900, margin: '0 0 4px 0' }}>
                      Mathpix OCR API
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '0 0 14px 0' }}>
                      Gold standard for academic research papers, equations, and LaTeX synthesis.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '10px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>CALLS:</span>
                        <span style={{ fontWeight: 700 }}>{eng.request_count} reqs ({eng.success_rate}%)</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>AVG SPEED:</span>
                        <span style={{ fontWeight: 700 }}>{formatDuration(eng.avg_duration_ms)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>EST. USAGE COST:</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>${eng.total_cost.toFixed(3)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* LlamaParse */}
            {data?.engines.filter(e => e.provider === 'llamaparse').map(eng => {
              const status = getEngineConfigStatus('llamaparse')
              return (
                <div key={eng.provider} className="browser-frame" style={{ margin: 0 }}>
                  <div className="browser-frame__header">
                    <div className="browser-frame__dots">
                      <span className="browser-frame__dot" />
                      <span className="browser-frame__dot" />
                      <span className="browser-frame__dot" />
                    </div>
                    <div className="browser-frame__address">api.cloud.llamaindex.ai</div>
                    <div style={{ marginLeft: 'auto' }}>
                      <span className="mono-tag" style={{ color: status.color, borderColor: status.color }}>
                        {status.label}
                      </span>
                    </div>
                  </div>

                  <div style={{ padding: '1.25rem', background: 'var(--bg-card)' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 900, margin: '0 0 4px 0' }}>
                      LlamaParse API
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '0 0 14px 0' }}>
                      GenAI document parser specialized in multi-column tables and SEC financial statements.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '10px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>CALLS:</span>
                        <span style={{ fontWeight: 700 }}>{eng.request_count} reqs ({eng.success_rate}%)</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>AVG SPEED:</span>
                        <span style={{ fontWeight: 700 }}>{formatDuration(eng.avg_duration_ms)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>EST. USAGE COST:</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>${eng.total_cost.toFixed(3)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── 4. Control Buttons ────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={() => onNavigate('dashboard')}
            className="btn-aarambh-outline"
            style={{ padding: '12px 24px', fontSize: '12px' }}
          >
            ← BACK TO DASHBOARD
          </button>
          <button
            onClick={onOpenSettings}
            className="btn-aarambh-primary"
            style={{ padding: '12px 24px', fontSize: '12px' }}
          >
            MANAGE ENGINE CREDENTIALS
          </button>
        </div>
      </div>
    </main>
  )
}
