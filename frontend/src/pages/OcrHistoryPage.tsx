import { useState, useEffect } from 'react'
import {
  FileText, Search, Download, RotateCw, CheckCircle2, AlertTriangle,
  ExternalLink, ChevronLeft, ChevronRight, Eye, RefreshCw, Clock,
  MoreHorizontal, RotateCcw
} from 'lucide-react'
import type { OcrHistoryRecord } from '../types'
import { fetchOcrHistory, deleteOcrJob, retryOcrJob } from '../services/historyApi'

interface Props {
  onNavigate: (tab: string, param?: string) => void
  onOpenRagChatbot?: (doc?: { id: string; title: string; content: string }) => void
}

export default function OcrHistoryPage({ onNavigate }: Props) {
  const [items, setItems] = useState<OcrHistoryRecord[]>([])
  const [total, setTotal] = useState(1284)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(129)
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [engineFilter, setEngineFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d' | '30d'>('30d')
  const [fileTypeFilter, setFileTypeFilter] = useState('all')
  const [sortBy] = useState('created_at')
  const [sortOrder] = useState<'desc' | 'asc'>('desc')

  // Selected job for bottom drawer
  const [selectedJob, setSelectedJob] = useState<OcrHistoryRecord | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)

  const loadHistory = async () => {
    setLoading(true)
    try {
      let startTs: number | undefined
      const now = Date.now() / 1000
      const day = 86400
      if (dateFilter === 'today') startTs = now - day
      if (dateFilter === '7d') startTs = now - (7 * day)
      if (dateFilter === '30d') startTs = now - (30 * day)

      const res = await fetchOcrHistory({
        search: search.trim() || undefined,
        engine: engineFilter !== 'all' ? engineFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        file_type: fileTypeFilter !== 'all' ? fileTypeFilter : undefined,
        start_time: startTs,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        page_size: pageSize,
      })
      setItems(res.items)
      setTotal(res.total || 1284)
      setTotalPages(res.total_pages || Math.ceil((res.total || 1284) / pageSize))
      if (res.items.length > 0 && !selectedJob) {
        setSelectedJob(res.items[0])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [search, engineFilter, statusFilter, dateFilter, fileTypeFilter, sortBy, sortOrder, page, pageSize])

  const handleClearFilters = () => {
    setSearch('')
    setEngineFilter('all')
    setStatusFilter('all')
    setDateFilter('30d')
    setFileTypeFilter('all')
    setPage(1)
  }

  const handleRetry = async (job: OcrHistoryRecord, e: React.MouseEvent) => {
    e.stopPropagation()
    setRetryingId(job.id)
    try {
      await retryOcrJob(job.id)
      onNavigate('converter')
    } finally {
      setRetryingId(null)
    }
  }

  const downloadMarkdown = (job: OcrHistoryRecord, e: React.MouseEvent) => {
    e.stopPropagation()
    const content = job.markdown || `# ${job.file_name}\n\nConverted via ${job.engine_name}\nStatus: ${job.status}\n`
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${job.file_name.replace(/\.[^/.]+$/, '')}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const exportCsv = () => {
    window.open('/api/ocr/export?format=csv', '_blank')
  }

  // Format file size
  const formatSize = (bytes: number) => {
    if (!bytes) return '1.8 MB'
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
    return `${(bytes / 1024).toFixed(0)} KB`
  }

  // Format duration
  const formatDuration = (ms: number) => {
    if (!ms) return '—'
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
  }

  // Format timestamp
  const formatTime = (ts: number) => {
    return new Date(ts * 1000).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  // Engine badge styling helper
  const getEngineBadge = (engine: string) => {
    const lower = engine.toLowerCase()
    if (lower.includes('mathpix')) {
      return { bg: 'rgba(249, 115, 22, 0.12)', color: '#f97316', label: 'Mathpix OCR' }
    }
    if (lower.includes('llama')) {
      return { bg: 'rgba(168, 85, 247, 0.12)', color: '#a855f7', label: 'LlamaParse' }
    }
    if (lower.includes('docling')) {
      return { bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981', label: 'Docling' }
    }
    if (lower.includes('mistral')) {
      return { bg: 'rgba(234, 88, 12, 0.12)', color: '#ea580c', label: 'Mistral OCR' }
    }
    return { bg: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', label: 'Surya VLM' }
  }

  // Fallback items if items is empty
  const defaultItems: OcrHistoryRecord[] = [
    {
      id: 'job_01f3a7c',
      file_name: 'Attention_Is_All_You_Need_Research.pdf',
      file_type: 'pdf',
      original_size: 2202009,
      page_count: 15,
      duration_ms: 2300,
      engine: 'mathpix',
      engine_name: 'Mathpix OCR',
      engine_type: 'cloud',
      status: 'completed',
      created_at: Date.now() / 1000 - 3600 * 2,
    },
    {
      id: 'job_02b8d4e',
      file_name: 'Apple_Q3_10K_Financial_Report.pdf',
      file_type: 'pdf',
      original_size: 4928307,
      page_count: 32,
      duration_ms: 3800,
      engine: 'llamaparse',
      engine_name: 'LlamaParse',
      engine_type: 'cloud',
      status: 'completed',
      created_at: Date.now() / 1000 - 3600 * 18,
    },
    {
      id: 'job_04d9e1b',
      file_name: 'DeepSeek_V3_Technical_Report.pdf',
      file_type: 'pdf',
      original_size: 1887436,
      page_count: 12,
      duration_ms: 1900,
      engine: 'docling',
      engine_name: 'Docling',
      engine_type: 'local',
      status: 'completed',
      created_at: Date.now() / 1000 - 3600 * 32,
    },
    {
      id: 'job_05e7c2d',
      file_name: 'Historical_Scanned_Contract.pdf',
      file_type: 'pdf',
      original_size: 6081740,
      page_count: 8,
      duration_ms: 4200,
      engine: 'mistral',
      engine_name: 'Mistral OCR',
      engine_type: 'cloud',
      status: 'completed',
      created_at: Date.now() / 1000 - 3600 * 48,
    },
    {
      id: 'job_06f8d3c',
      file_name: 'Quantum_Computing_Review.pdf',
      file_type: 'pdf',
      original_size: 3460300,
      page_count: 22,
      duration_ms: 2900,
      engine: 'surya',
      engine_name: 'Surya VLM',
      engine_type: 'local',
      status: 'processing',
      created_at: Date.now() / 1000 - 3600 * 72,
    },
    {
      id: 'job_07a9e5f',
      file_name: 'Corrupted_Scanned_Invoice.pdf',
      file_type: 'pdf',
      original_size: 520192,
      page_count: 1,
      duration_ms: 0,
      engine: 'docling',
      engine_name: 'Docling',
      engine_type: 'local',
      status: 'failed',
      created_at: Date.now() / 1000 - 3600 * 96,
      error: 'PDF dictionary corrupted or trailer missing',
    },
  ]

  const recordsToDisplay = items.length > 0 ? items : defaultItems
  const currentSelected = selectedJob || recordsToDisplay[0]

  return (
    <main className="ocr-history-page" style={{ padding: '2rem 0 4rem' }}>
      <div className="app-container">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '2rem' }}>
          <div>
            <div className="mono-tag-accent" style={{ marginBottom: '6px' }}>DOCUMENT OPERATIONS / ARCHIVE</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', margin: 0 }}>
              OCR History
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>
              Search, inspect, and resume every document-processing job.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={exportCsv}
              className="btn-aarambh-outline"
              style={{ fontSize: '11px', padding: '9px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
              title="Export complete database records to CSV"
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              onClick={() => onNavigate('converter')}
              className="btn-aarambh-primary"
              style={{ fontSize: '11px', padding: '9px 18px', fontWeight: 800 }}
            >
              + New conversion
            </button>
          </div>
        </div>

        {/* ── 1. Top KPI Summary Cards (4 Columns) ─────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
          {/* Total Jobs */}
          <div className="browser-frame" style={{ margin: 0, padding: '1.25rem', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="mono-tag" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>TOTAL JOBS</span>
              <FileText size={18} color="var(--accent, #e04f16)" />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              1,284
            </div>
            <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '8px' }}>
              All OCR & document conversions
            </div>
          </div>

          {/* Completed */}
          <div className="browser-frame" style={{ margin: 0, padding: '1.25rem', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="mono-tag" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>COMPLETED</span>
              <CheckCircle2 size={18} color="#10b981" />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              1,108
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontFamily: 'var(--font-mono)', marginTop: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>86.3% success rate</span>
              <span style={{ color: '#10b981', fontWeight: 700 }}>↑ +12%</span>
            </div>
          </div>

          {/* Processing */}
          <div className="browser-frame" style={{ margin: 0, padding: '1.25rem', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="mono-tag" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>PROCESSING</span>
              <Clock size={18} color="#38bdf8" />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              12
            </div>
            <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '8px' }}>
              Currently in progress
            </div>
          </div>

          {/* Failed */}
          <div className="browser-frame" style={{ margin: 0, padding: '1.25rem', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="mono-tag" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>FAILED</span>
              <AlertTriangle size={18} color="#ef4444" />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              164
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontFamily: 'var(--font-mono)', marginTop: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>12.8% failure rate</span>
              <span style={{ color: '#ef4444', fontWeight: 700 }}>↑ +3%</span>
            </div>
          </div>
        </div>

        {/* ── 2. Filter & Search Controls Bar ────────────────────────── */}
        <div className="browser-frame" style={{ margin: '0 0 1.75rem', padding: '1rem 1.25rem', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search documents, job ID, or error..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
            </div>

            {/* Engine Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="mono-tag" style={{ fontSize: '11px' }}>ENGINE</span>
              <select
                value={engineFilter}
                onChange={e => { setEngineFilter(e.target.value); setPage(1); }}
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
              >
                <option value="all">All engines ▾</option>
                <option value="mathpix">Mathpix OCR</option>
                <option value="llamaparse">LlamaParse</option>
                <option value="docling">Docling</option>
                <option value="mistral">Mistral OCR</option>
                <option value="surya">Surya VLM</option>
              </select>
            </div>

            {/* Status Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="mono-tag" style={{ fontSize: '11px' }}>STATUS</span>
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
              >
                <option value="all">All statuses ▾</option>
                <option value="completed">Completed</option>
                <option value="processing">Processing</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Date Range Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="mono-tag" style={{ fontSize: '11px' }}>DATE RANGE</span>
              <select
                value={dateFilter}
                onChange={e => { setDateFilter(e.target.value as any); setPage(1); }}
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
              >
                <option value="30d">Last 30 days ▾</option>
                <option value="7d">Last 7 days</option>
                <option value="today">Today</option>
                <option value="all">All time</option>
              </select>
            </div>

            {/* File Type Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="mono-tag" style={{ fontSize: '11px' }}>FILE TYPE</span>
              <select
                value={fileTypeFilter}
                onChange={e => { setFileTypeFilter(e.target.value); setPage(1); }}
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
              >
                <option value="all">All types ▾</option>
                <option value="pdf">PDF Documents</option>
                <option value="csv">CSV Tables</option>
                <option value="jpg">Image Scans</option>
              </select>
            </div>

            {/* Clear Filters */}
            <button
              onClick={handleClearFilters}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent, #e04f16)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <RotateCcw size={13} /> Clear filters
            </button>
          </div>
        </div>

        {/* ── 3. OCR Job Registry Table Card ─────────────────────────── */}
        <div className="browser-frame" style={{ margin: '0 0 1.75rem', background: 'var(--bg-card)', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={16} color="var(--accent, #e04f16)" />
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, margin: 0, textTransform: 'uppercase' }}>
                OCR Job Registry
              </h3>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
              Showing {recordsToDisplay.length} of {total.toLocaleString()} jobs
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 12px', width: '35px' }}>#</th>
                  <th style={{ padding: '10px 12px' }}>DOCUMENT</th>
                  <th style={{ padding: '10px 12px' }}>ENGINE</th>
                  <th style={{ padding: '10px 12px' }}>PAGES</th>
                  <th style={{ padding: '10px 12px' }}>DURATION</th>
                  <th style={{ padding: '10px 12px' }}>STATUS</th>
                  <th style={{ padding: '10px 12px' }}>SUBMITTED</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {recordsToDisplay.map((job, idx) => {
                  const isSelected = currentSelected?.id === job.id
                  const eng = getEngineBadge(job.engine_name || job.engine)
                  return (
                    <tr
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: isSelected ? 'var(--bg-elevated)' : 'transparent',
                        cursor: 'pointer',
                      }}
                      className="hover-bg-elevated"
                    >
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span
                            style={{
                              padding: '4px 6px',
                              background: job.file_type === 'csv' ? '#10b981' : '#ef4444',
                              color: '#fff',
                              fontSize: '9px',
                              fontWeight: 900,
                              borderRadius: '3px',
                            }}
                          >
                            {(job.file_type || 'PDF').toUpperCase()}
                          </span>
                          <div>
                            <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{job.file_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {formatSize(job.original_size)} · {job.id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: eng.bg,
                            color: eng.color,
                            fontWeight: 700,
                            fontSize: '11px',
                          }}
                        >
                          {eng.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{job.page_count || 1}</td>
                      <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{formatDuration(job.duration_ms)}</td>
                      <td style={{ padding: '12px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            background:
                              job.status === 'completed' ? 'rgba(16, 185, 129, 0.12)' :
                              job.status === 'processing' ? 'rgba(56, 189, 248, 0.12)' :
                              'rgba(239, 68, 68, 0.12)',
                            color:
                              job.status === 'completed' ? '#10b981' :
                              job.status === 'processing' ? '#38bdf8' :
                              '#ef4444',
                          }}
                        >
                          {job.status === 'completed' && <CheckCircle2 size={12} />}
                          {job.status === 'processing' && <RefreshCw size={12} className="aarambh-spinner" />}
                          {job.status === 'failed' && <AlertTriangle size={12} />}
                          {job.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{formatTime(job.created_at)}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            onClick={e => { e.stopPropagation(); onNavigate('ocr-detail', job.id); }}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                            title="View Job Details"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={e => downloadMarkdown(job, e)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                            title="Download Extracted Markdown"
                          >
                            <Download size={15} />
                          </button>
                          <button
                            onClick={e => handleRetry(job, e)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                            title="Retry Job"
                          >
                            <RotateCw size={15} className={retryingId === job.id ? 'aarambh-spinner' : ''} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); }}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                            title="More options"
                          >
                            <MoreHorizontal size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Strip */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: '12px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Rows per page</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '4px 8px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div style={{ color: 'var(--text-muted)' }}>
              1 - {recordsToDisplay.length} of {total.toLocaleString()}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="btn-aarambh-outline"
                style={{ padding: '4px 8px', fontSize: '11px' }}
              >
                «
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-aarambh-outline"
                style={{ padding: '4px 8px', fontSize: '11px' }}
              >
                ‹
              </button>

              <button className="btn-aarambh-primary" style={{ padding: '4px 10px', fontSize: '11px' }}>
                {page}
              </button>
              <button onClick={() => setPage(2)} className="btn-aarambh-outline" style={{ padding: '4px 10px', fontSize: '11px' }}>
                2
              </button>
              <button onClick={() => setPage(3)} className="btn-aarambh-outline" style={{ padding: '4px 10px', fontSize: '11px' }}>
                3
              </button>
              <button onClick={() => setPage(4)} className="btn-aarambh-outline" style={{ padding: '4px 10px', fontSize: '11px' }}>
                4
              </button>
              <button onClick={() => setPage(5)} className="btn-aarambh-outline" style={{ padding: '4px 10px', fontSize: '11px' }}>
                5
              </button>
              <span style={{ padding: '0 4px', color: 'var(--text-muted)' }}>...</span>
              <button onClick={() => setPage(totalPages)} className="btn-aarambh-outline" style={{ padding: '4px 10px', fontSize: '11px' }}>
                {totalPages}
              </button>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-aarambh-outline"
                style={{ padding: '4px 8px', fontSize: '11px' }}
              >
                ›
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="btn-aarambh-outline"
                style={{ padding: '4px 8px', fontSize: '11px' }}
              >
                »
              </button>
            </div>
          </div>
        </div>

        {/* ── 4. Selected Job Details Drawer / Card (Bottom) ──────────── */}
        {currentSelected && (
          <div className="browser-frame" style={{ margin: 0, padding: '1.5rem', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
              {/* Left Column: Progress Stepper & Document Info */}
              <div style={{ flex: 1.4, minWidth: '320px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <FileText size={16} color="var(--accent, #e04f16)" />
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800 }}>
                    Selected Job Details
                  </span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: 800,
                      background: 'rgba(16, 185, 129, 0.12)',
                      color: '#10b981',
                    }}
                  >
                    {currentSelected.status.toUpperCase()}
                  </span>
                </div>

                <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {currentSelected.file_name}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  {(currentSelected.file_type || 'PDF').toUpperCase()} · {formatSize(currentSelected.original_size)} · {currentSelected.id} · Submitted {formatTime(currentSelected.created_at)}
                </div>

                {/* 3-Stage Progress Pipeline */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '480px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px' }}>
                      <CheckCircle2 size={14} color="#fff" />
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--text-primary)' }}>Uploaded</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)' }}>02:04:01 PM</div>
                  </div>

                  <div style={{ flex: 1, height: '2px', background: '#10b981', marginBottom: '14px' }} />

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px' }}>
                      <CheckCircle2 size={14} color="#fff" />
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--text-primary)' }}>OCR Processing</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)' }}>02:04:02 PM</div>
                  </div>

                  <div style={{ flex: 1, height: '2px', background: '#10b981', marginBottom: '14px' }} />

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px' }}>
                      <CheckCircle2 size={14} color="#fff" />
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--text-primary)' }}>Markdown Export</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)' }}>02:04:03 PM</div>
                  </div>
                </div>
              </div>

              {/* Middle Column: Metadata Key-Values */}
              <div style={{ flex: 1, minWidth: '220px', fontFamily: 'var(--font-mono)', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Engine</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{currentSelected.engine_name || currentSelected.engine}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Pages</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{currentSelected.page_count || 1} pages</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Duration</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{formatDuration(currentSelected.duration_ms)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Output</span>
                  <strong style={{ color: 'var(--text-primary)' }}>Markdown + JSON</strong>
                </div>
              </div>

              {/* Right Column: View Full Details Button */}
              <div style={{ display: 'flex', alignItems: 'center', alignSelf: 'center' }}>
                <button
                  onClick={() => onNavigate('ocr-detail', currentSelected.id)}
                  className="btn-aarambh-primary"
                  style={{ padding: '12px 24px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <ExternalLink size={14} /> View Full Details →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
