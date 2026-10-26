import { useState, useEffect } from 'react'
import {
  FileText, CheckCircle2, AlertTriangle, MessageSquare, Clock,
  Cpu, ArrowUpRight, ArrowRight, RefreshCw, ChevronRight, Layers
} from 'lucide-react'
import type { DashboardStats } from '../types'
import { fetchDashboardStats } from '../services/historyApi'

interface Props {
  onNavigate: (tab: string, param?: string) => void
  onOpenSettings?: () => void
}

export default function DashboardPage({ onNavigate, onOpenSettings }: Props) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'all' | 'custom'>('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      let startTs: number | undefined
      let endTs: number | undefined
      if (dateRange === 'custom') {
        if (customStart) startTs = new Date(customStart).getTime() / 1000
        if (customEnd) endTs = new Date(customEnd).getTime() / 1000 + 86400
      }
      const data = await fetchDashboardStats(dateRange, startTs, endTs)
      setStats(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [dateRange, customStart, customEnd])

  const s = stats?.summary || {
    total_jobs: 0,
    jobs_today: 0,
    successful_jobs: 0,
    failed_jobs: 0,
    overall_success_rate: 100,
    total_pages: 0,
    total_tokens_saved: 0,
    avg_ocr_duration_ms: 0,
    total_conversations: 0,
    total_chat_messages: 0,
    chats_today: 0,
    avg_chat_response_ms: 0,
    total_cost_estimated: 0,
  }

  const formatDuration = (ms: number) => {
    if (!ms) return '0s'
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
  }

  const formatTimeAgo = (ts: number) => {
    const diff = Math.floor(Date.now() / 1000 - ts)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <main className="dashboard-page" style={{ padding: '2rem 0 4rem' }}>
      <div className="app-container">
        {/* Top Header & Range Filters */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '2rem' }}>
          <div>
            <div className="mono-tag-accent" style={{ marginBottom: '6px' }}>/ 00 SYSTEM TELEMETRY</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', margin: 0 }}>
              Mission Control & Telemetry
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>
              Database-backed intelligence on OCR throughput, RAG queries, and multi-engine performance.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Date Range Chips */}
            <div className="aarambh-mode-chips" style={{ background: 'var(--bg-elevated)', padding: '4px', border: '1px solid var(--border)' }}>
              {(['today', '7d', '30d', 'all', 'custom'] as const).map(rangeKey => (
                <button
                  key={rangeKey}
                  type="button"
                  className={`aarambh-mode-chip ${dateRange === rangeKey ? 'aarambh-mode-chip--active' : ''}`}
                  onClick={() => setDateRange(rangeKey)}
                  style={{ fontSize: '11px', padding: '5px 12px' }}
                >
                  {rangeKey === 'today' && 'TODAY'}
                  {rangeKey === '7d' && '7 DAYS'}
                  {rangeKey === '30d' && '30 DAYS'}
                  {rangeKey === 'all' && 'ALL TIME'}
                  {rangeKey === 'custom' && 'CUSTOM'}
                </button>
              ))}
            </div>

            <button
              onClick={loadData}
              className="btn-aarambh-outline"
              style={{ padding: '8px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Refresh telemetry metrics"
            >
              <RefreshCw size={13} className={loading ? 'aarambh-spinner' : ''} />
              SYNC
            </button>
          </div>
        </div>

        {/* Custom Date Inputs if 'custom' selected */}
        {dateRange === 'custom' && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '1.5rem', background: 'var(--bg-card)', padding: '12px 18px', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <span className="mono-tag" style={{ color: 'var(--text-primary)' }}>START DATE:</span>
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
            />
            <span className="mono-tag" style={{ color: 'var(--text-primary)' }}>END DATE:</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
            />
          </div>
        )}

        {/* ── 1. Top High-Impact KPI Metrics Cards ────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
          {/* Card 1: Total OCR Jobs */}
          <div className="browser-frame" style={{ margin: 0 }}>
            <div style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="mono-tag">TOTAL OCR JOBS</span>
                <span style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <FileText size={16} />
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                {s.total_jobs}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                <span>TODAY: <strong style={{ color: 'var(--text-primary)' }}>+{s.jobs_today}</strong></span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>{s.overall_success_rate}% SOTA</span>
              </div>
            </div>
          </div>

          {/* Card 2: Pages & Token Efficiency */}
          <div className="browser-frame" style={{ margin: 0 }}>
            <div style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="mono-tag">PAGES PROCESSED</span>
                <span style={{ color: '#38bdf8' }}>
                  <Layers size={16} />
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                {s.total_pages}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                <span>TOKENS SAVED: <strong style={{ color: 'var(--accent)' }}>{(s.total_tokens_saved / 1000).toFixed(1)}k</strong></span>
                <span>~72% REDUCTION</span>
              </div>
            </div>
          </div>

          {/* Card 3: Chatbot Inquiries */}
          <div className="browser-frame" style={{ margin: 0 }}>
            <div style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="mono-tag">RAG CONVERSATIONS</span>
                <span style={{ color: '#a855f7' }}>
                  <MessageSquare size={16} />
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                {s.total_conversations}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                <span>{s.total_chat_messages} MESSAGES</span>
                <span>TODAY: <strong style={{ color: 'var(--text-primary)' }}>+{s.chats_today}</strong></span>
              </div>
            </div>
          </div>

          {/* Card 4: Avg Speed & Cloud Cost */}
          <div className="browser-frame" style={{ margin: 0 }}>
            <div style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="mono-tag">OCR VELOCITY</span>
                <span style={{ color: '#10b981' }}>
                  <Clock size={16} />
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                {formatDuration(s.avg_ocr_duration_ms)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                <span>RAG LATENCY: <strong style={{ color: 'var(--text-primary)' }}>{formatDuration(s.avg_chat_response_ms)}</strong></span>
                <span style={{ color: 'var(--text-muted)' }}>COST: ${s.total_cost_estimated.toFixed(3)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. Interactive SVG Charts (Activity & Latency) ─────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          {/* Chart 1: Activity Throughput Trend */}
          <div className="browser-frame" style={{ margin: 0 }}>
            <div className="browser-frame__header">
              <div className="browser-frame__dots">
                <span className="browser-frame__dot" />
                <span className="browser-frame__dot" />
                <span className="browser-frame__dot" />
              </div>
              <div className="browser-frame__address">telemetry.chart / throughput-timeline</div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="mono-tag" style={{ color: 'var(--accent)' }}>DAILY JOBS</span>
              </div>
            </div>

            <div style={{ padding: '1.5rem', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>
                  OCR & Document Ingestion Activity
                </h3>
                <span className="mono-tag" style={{ color: '#10b981' }}>{s.successful_jobs} SUCCESSFUL</span>
              </div>

              {/* Responsive SVG Chart */}
              <div style={{ width: '100%', height: '180px', position: 'relative' }}>
                <svg width="100%" height="100%" viewBox="0 0 500 180" preserveAspectRatio="none">
                  {/* Grid Lines */}
                  <line x1="0" y1="45" x2="500" y2="45" stroke="var(--border)" strokeDasharray="3 3" opacity="0.6" />
                  <line x1="0" y1="90" x2="500" y2="90" stroke="var(--border)" strokeDasharray="3 3" opacity="0.6" />
                  <line x1="0" y1="135" x2="500" y2="135" stroke="var(--border)" strokeDasharray="3 3" opacity="0.6" />

                  {/* Activity Bars */}
                  {stats?.timeline && stats.timeline.length > 0 ? (
                    stats.timeline.map((item, idx) => {
                      const totalBars = stats.timeline.length
                      const barWidth = Math.max(16, 400 / totalBars - 12)
                      const x = 30 + idx * (440 / totalBars)
                      const maxJobs = Math.max(4, ...stats.timeline.map(t => t.jobs))
                      const barHeight = (item.jobs / maxJobs) * 120
                      const y = 150 - barHeight

                      return (
                        <g key={item.date} className="chart-bar-group">
                          <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            fill="var(--accent)"
                            rx="2"
                            style={{ transition: 'all 0.3s ease' }}
                          />
                          <text
                            x={x + barWidth / 2}
                            y="170"
                            textAnchor="middle"
                            fill="var(--text-muted)"
                            fontSize="10"
                            fontFamily="var(--font-mono)"
                          >
                            {item.date.slice(5)}
                          </text>
                          <text
                            x={x + barWidth / 2}
                            y={y - 6}
                            textAnchor="middle"
                            fill="var(--text-primary)"
                            fontSize="10"
                            fontWeight="bold"
                            fontFamily="var(--font-mono)"
                          >
                            {item.jobs}
                          </text>
                        </g>
                      )
                    })
                  ) : (
                    <text x="250" y="90" textAnchor="middle" fill="var(--text-muted)" fontSize="12" fontFamily="var(--font-mono)">
                      No recorded jobs in this timeframe.
                    </text>
                  )}
                </svg>
              </div>
            </div>
          </div>

          {/* Chart 2: Processing Duration by Engine */}
          <div className="browser-frame" style={{ margin: 0 }}>
            <div className="browser-frame__header">
              <div className="browser-frame__dots">
                <span className="browser-frame__dot" />
                <span className="browser-frame__dot" />
                <span className="browser-frame__dot" />
              </div>
              <div className="browser-frame__address">telemetry.chart / engine-latency</div>
              <div style={{ marginLeft: 'auto' }}>
                <span className="mono-tag" style={{ color: '#10b981' }}>BENCHMARK</span>
              </div>
            </div>

            <div style={{ padding: '1.5rem', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>
                  Average Latency Across Configured Engines
                </h3>
                <span className="mono-tag">LOWER IS FASTER</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '4px' }}>
                {stats?.providers && stats.providers.length > 0 ? (
                  stats.providers.map(p => {
                    const maxMs = 5000
                    const pct = Math.min(100, Math.max(12, (p.avg_duration_ms / maxMs) * 100))
                    const isLocal = p.type === 'local'

                    return (
                      <div key={p.provider}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'var(--font-mono)', marginBottom: '5px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: isLocal ? '#10b981' : 'var(--accent)' }}>
                              {isLocal ? '●' : '☁'}
                            </span>
                            {p.name}
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {formatDuration(p.avg_duration_ms)} · {p.total_requests} reqs ({p.success_rate}%)
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'var(--bg-elevated)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: isLocal ? '#10b981' : 'var(--accent)',
                              transition: 'width 0.4s ease',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-mono)', padding: '2rem 0', textAlign: 'center' }}>
                    No engine execution data recorded yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. Multi-Engine Breakdown Table ────────────────────────── */}
        <div className="browser-frame" style={{ marginBottom: '2.5rem' }}>
          <div className="browser-frame__header">
            <div className="browser-frame__dots">
              <span className="browser-frame__dot" />
              <span className="browser-frame__dot" />
              <span className="browser-frame__dot" />
            </div>
            <div className="browser-frame__address">docforge.local/api-engine-usage</div>
            <div style={{ marginLeft: 'auto' }}>
              <button
                onClick={() => onNavigate('analytics')}
                className="btn-aarambh-outline"
                style={{ fontSize: '10px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                DETAILED ANALYTICS <ArrowUpRight size={11} />
              </button>
            </div>
          </div>

          <div style={{ padding: '1.25rem', background: 'var(--bg-card)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px' }}>ENGINE PROVIDER</th>
                  <th style={{ padding: '10px' }}>EXECUTION MODE</th>
                  <th style={{ padding: '10px' }}>REQUESTS</th>
                  <th style={{ padding: '10px' }}>SUCCESS RATE</th>
                  <th style={{ padding: '10px' }}>AVG DURATION</th>
                  <th style={{ padding: '10px' }}>PAGES</th>
                  <th style={{ padding: '10px' }}>EST. COST</th>
                </tr>
              </thead>
              <tbody>
                {stats?.providers && stats.providers.length > 0 ? (
                  stats.providers.map(p => (
                    <tr key={p.provider} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 10px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {p.name}
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <span
                          className="mono-tag"
                          style={{
                            color: p.type === 'local' ? '#10b981' : 'var(--accent)',
                            borderColor: p.type === 'local' ? '#10b981' : 'var(--accent)',
                          }}
                        >
                          {p.type === 'local' ? '100% AIR-GAPPED' : 'EXTERNAL CLOUD'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px', color: 'var(--text-primary)' }}>
                        {p.total_requests} ({p.successful_requests} ok)
                      </td>
                      <td style={{ padding: '12px 10px', color: p.success_rate >= 90 ? '#10b981' : 'var(--accent)', fontWeight: 700 }}>
                        {p.success_rate}%
                      </td>
                      <td style={{ padding: '12px 10px', color: 'var(--text-primary)' }}>
                        {formatDuration(p.avg_duration_ms)}
                      </td>
                      <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>
                        {p.total_pages}
                      </td>
                      <td style={{ padding: '12px 10px', color: p.total_cost === 0 ? '#10b981' : 'var(--text-primary)' }}>
                        {p.total_cost === 0 ? '$0.00 (Free)' : `$${p.total_cost.toFixed(3)}`}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No provider data found in selected date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── 4. Split Stream: Recent OCR Activity vs Recent Chats ───── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
          {/* Recent OCR Jobs */}
          <div className="browser-frame" style={{ margin: 0 }}>
            <div className="browser-frame__header">
              <div className="browser-frame__dots">
                <span className="browser-frame__dot" />
                <span className="browser-frame__dot" />
                <span className="browser-frame__dot" />
              </div>
              <div className="browser-frame__address">docforge.local/recent-ocr-jobs</div>
              <button
                onClick={() => onNavigate('ocr-history')}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                VIEW ALL ({stats?.summary.total_jobs || 0}) <ArrowRight size={12} />
              </button>
            </div>

            <div style={{ padding: '1rem', background: 'var(--bg-card)' }}>
              {stats?.recent_jobs && stats.recent_jobs.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {stats.recent_jobs.map(job => (
                    <div
                      key={job.id}
                      onClick={() => onNavigate('ocr-detail', job.id)}
                      style={{
                        padding: '10px 14px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s ease',
                      }}
                      className="hover-border-accent"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <div style={{ color: job.status === 'completed' ? '#10b981' : 'var(--accent)' }}>
                          {job.status === 'completed' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {job.file_name}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                            {job.engine_name} · {job.page_count || 1} pgs · {formatDuration(job.duration_ms)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                          {formatTimeAgo(job.created_at)}
                        </span>
                        <ChevronRight size={14} color="var(--text-muted)" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                  No OCR jobs completed yet.
                </div>
              )}
            </div>
          </div>

          {/* Recent Chat Inquiries */}
          <div className="browser-frame" style={{ margin: 0 }}>
            <div className="browser-frame__header">
              <div className="browser-frame__dots">
                <span className="browser-frame__dot" />
                <span className="browser-frame__dot" />
                <span className="browser-frame__dot" />
              </div>
              <div className="browser-frame__address">docforge.local/recent-rag-chats</div>
              <button
                onClick={() => onNavigate('chat-history')}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                VIEW ALL ({stats?.summary.total_conversations || 0}) <ArrowRight size={12} />
              </button>
            </div>

            <div style={{ padding: '1rem', background: 'var(--bg-card)' }}>
              {stats?.recent_chats && stats.recent_chats.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {stats.recent_chats.map(chat => (
                    <div
                      key={chat.id}
                      onClick={() => onNavigate('chatbot', chat.id)}
                      style={{
                        padding: '10px 14px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s ease',
                      }}
                      className="hover-border-accent"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <div style={{ color: '#a855f7' }}>
                          <MessageSquare size={16} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {chat.title}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                            {chat.message_count} messages · Model: {chat.model}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                          {formatTimeAgo(chat.updated_at)}
                        </span>
                        <ChevronRight size={14} color="var(--text-muted)" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                  No RAG conversations conducted yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 5. Quick Launch Control Strip ──────────────────────────── */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => onNavigate('converter')}
            className="btn-aarambh-primary"
            style={{ padding: '12px 24px', fontSize: '12px' }}
          >
            LAUNCH BATCH OCR CONVERTER <ArrowRight size={14} />
          </button>
          <button
            onClick={() => onNavigate('chatbot')}
            className="btn-aarambh-outline"
            style={{ padding: '12px 24px', fontSize: '12px' }}
          >
            START RAG CHAT QUERY <MessageSquare size={14} />
          </button>
          <button
            onClick={() => onNavigate('ocr-history')}
            className="btn-aarambh-outline"
            style={{ padding: '12px 24px', fontSize: '12px' }}
          >
            INSPECT OCR HISTORY <FileText size={14} />
          </button>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="btn-aarambh-outline"
              style={{ padding: '12px 24px', fontSize: '12px' }}
            >
              CONFIGURE API ENGINES <Cpu size={14} />
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
