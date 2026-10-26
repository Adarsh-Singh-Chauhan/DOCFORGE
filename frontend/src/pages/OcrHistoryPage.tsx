import { useState, useEffect } from 'react'
import {
  FileText, Search, Download, Trash2, RotateCw, ArrowUpDown,
  CheckCircle2, AlertTriangle, ExternalLink, ChevronLeft, ChevronRight,
  Eye, RefreshCw, MessageSquare
} from 'lucide-react'
import type { OcrHistoryRecord } from '../types'
import { fetchOcrHistory, deleteOcrJob, retryOcrJob } from '../services/historyApi'

interface Props {
  onNavigate: (tab: string, param?: string) => void
  onOpenRagChatbot?: (doc?: { id: string; title: string; content: string }) => void
}

export default function OcrHistoryPage({ onNavigate, onOpenRagChatbot }: Props) {
  const [items, setItems] = useState<OcrHistoryRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [engineFilter, setEngineFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d' | '30d'>('all')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')

  // Retrying status
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

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
        start_time: startTs,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        page_size: pageSize,
      })
      setItems(res.items)
      setTotal(res.total)
      setTotalPages(res.total_pages)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [search, engineFilter, statusFilter, dateFilter, sortBy, sortOrder, page, pageSize])

  const handleDelete = async (id: string) => {
    await deleteOcrJob(id)
    setDeleteConfirmId(null)
    loadHistory()
  }

  const handleRetry = async (job: OcrHistoryRecord) => {
    setRetryingId(job.id)
    try {
      await retryOcrJob(job.id)
      onNavigate('converter')
    } finally {
      setRetryingId(null)
    }
  }

  const downloadMarkdown = (job: OcrHistoryRecord) => {
    if (!job.markdown) return
    const blob = new Blob([job.markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${job.file_name.replace(/\.[^/.]+$/, '')}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const exportData = (format: 'json' | 'csv') => {
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `docforge-ocr-history-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      const headers = ['ID', 'Filename', 'Engine', 'Type', 'Status', 'Pages', 'Duration (ms)', 'Date', 'Cost']
      const rows = items.map(i => [
        i.id,
        `"${i.file_name.replace(/"/g, '""')}"`,
        i.engine_name,
        i.engine_type,
        i.status,
        i.page_count || 1,
        i.duration_ms,
        new Date(i.created_at * 1000).toISOString(),
        i.cost_estimated || 0,
      ])
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `docforge-ocr-history-${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const formatDuration = (ms: number) => {
    if (!ms) return '0s'
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <main className="ocr-history-page" style={{ padding: '2rem 0 4rem' }}>
      <div className="app-container">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '2rem' }}>
          <div>
            <div className="mono-tag-accent" style={{ marginBottom: '6px' }}>/ 02 AUDIT REGISTRY</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', margin: 0 }}>
              OCR Document History
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>
              Persistent records of all converted PDFs, scans, and technical extractions.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={() => exportData('csv')}
              className="btn-aarambh-outline"
              style={{ fontSize: '11px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Export records to CSV"
            >
              <Download size={13} /> EXPORT CSV
            </button>
            <button
              onClick={() => exportData('json')}
              className="btn-aarambh-outline"
              style={{ fontSize: '11px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Export records to JSON"
            >
              <Download size={13} /> EXPORT JSON
            </button>
            <button
              onClick={() => onNavigate('converter')}
              className="btn-aarambh-primary"
              style={{ fontSize: '11px', padding: '8px 16px' }}
            >
              + NEW CONVERSION
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="browser-frame" style={{ marginBottom: '1.75rem' }}>
          <div style={{ padding: '1.25rem', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Search Input Row */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search by file name or error details..."
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
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

              {/* Refresh Button */}
              <button
                onClick={loadHistory}
                className="btn-aarambh-outline"
                style={{ padding: '9px 14px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={13} className={loading ? 'aarambh-spinner' : ''} /> REFRESH
              </button>
            </div>

            {/* Filter Dropdowns and Chips */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Engine Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="mono-tag">ENGINE:</span>
                  <select
                    value={engineFilter}
                    onChange={e => { setEngineFilter(e.target.value); setPage(1); }}
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                  >
                    <option value="all">ALL ENGINES</option>
                    <option value="docling">IBM Docling (Local)</option>
                    <option value="surya">Surya VLM (Local)</option>
                    <option value="mistral">Mistral OCR (Cloud)</option>
                    <option value="mathpix">Mathpix OCR (Cloud)</option>
                    <option value="llamaparse">LlamaParse (Cloud)</option>
                  </select>
                </div>

                {/* Status Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="mono-tag">STATUS:</span>
                  <select
                    value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                  >
                    <option value="all">ALL STATUSES</option>
                    <option value="completed">COMPLETED</option>
                    <option value="failed">FAILED</option>
                    <option value="processing">PROCESSING</option>
                    <option value="queued">QUEUED</option>
                  </select>
                </div>

                {/* Date Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="mono-tag">TIMEFRAME:</span>
                  <select
                    value={dateFilter}
                    onChange={e => { setDateFilter(e.target.value as any); setPage(1); }}
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                  >
                    <option value="all">ALL TIME</option>
                    <option value="today">TODAY</option>
                    <option value="7d">LAST 7 DAYS</option>
                    <option value="30d">LAST 30 DAYS</option>
                  </select>
                </div>
              </div>

              {/* Sorting & Order */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="mono-tag">SORT:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                >
                  <option value="created_at">SUBMISSION DATE</option>
                  <option value="duration_ms">PROCESSING SPEED</option>
                  <option value="page_count">PAGE COUNT</option>
                  <option value="tokens_saved">TOKENS SAVED</option>
                  <option value="file_name">FILE NAME</option>
                </select>
                <button
                  onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                  className="btn-aarambh-outline"
                  style={{ padding: '6px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  title="Toggle ascending / descending"
                >
                  <ArrowUpDown size={12} /> {sortOrder.toUpperCase()}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Results Table ────────────────────────────────────────── */}
        <div className="browser-frame">
          <div className="browser-frame__header">
            <div className="browser-frame__dots">
              <span className="browser-frame__dot" />
              <span className="browser-frame__dot" />
              <span className="browser-frame__dot" />
            </div>
            <div className="browser-frame__address">docforge.local/ocr-records-registry</div>
            <div style={{ marginLeft: 'auto' }}>
              <span className="mono-tag" style={{ color: 'var(--accent)' }}>
                {total} MATCHING JOBS
              </span>
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', overflowX: 'auto' }}>
            {loading ? (
              <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                <span className="aarambh-spinner" style={{ marginRight: '8px' }} />
                QUERYING OCR REGISTRY...
              </div>
            ) : items.length === 0 ? (
              <div style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
                <FileText size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800 }}>No OCR Records Found</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '420px', margin: '4px auto 16px' }}>
                  No conversion jobs match the selected filter criteria. Try adjusting your search term or launch a new batch conversion.
                </p>
                <button
                  onClick={() => onNavigate('converter')}
                  className="btn-aarambh-primary"
                  style={{ fontSize: '11px', padding: '8px 18px' }}
                >
                  LAUNCH CONVERTER
                </button>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '12px 14px' }}>DOCUMENT NAME</th>
                    <th style={{ padding: '12px 14px' }}>ENGINE</th>
                    <th style={{ padding: '12px 14px' }}>PAGES</th>
                    <th style={{ padding: '12px 14px' }}>LATENCY</th>
                    <th style={{ padding: '12px 14px' }}>STATUS</th>
                    <th style={{ padding: '12px 14px' }}>TIMESTAMP</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                      className="hover-bg-elevated"
                    >
                      <td style={{ padding: '12px 14px', maxWidth: '280px' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.file_name}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {(item.original_size / 1024).toFixed(1)} KB · {item.id}
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span
                          className="mono-tag"
                          style={{
                            color: item.engine_type === 'local' ? '#10b981' : 'var(--accent)',
                            borderColor: item.engine_type === 'local' ? '#10b981' : 'var(--accent)',
                            padding: '2px 6px',
                            fontSize: '10px',
                          }}
                        >
                          {item.engine.toUpperCase()}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>
                        {item.page_count || 1} pgs
                      </td>

                      <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>
                        {formatDuration(item.duration_ms)}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        {item.status === 'completed' && (
                          <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                            <CheckCircle2 size={13} /> COMPLETED
                          </span>
                        )}
                        {item.status === 'failed' && (
                          <span style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                            <AlertTriangle size={13} /> FAILED
                          </span>
                        )}
                        {item.status === 'processing' && (
                          <span style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="aarambh-spinner" style={{ width: 10, height: 10 }} /> PROCESSING
                          </span>
                        )}
                        {item.status === 'queued' && (
                          <span style={{ color: 'var(--text-muted)' }}>[QUEUED]</span>
                        )}
                      </td>

                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '11px' }}>
                        {new Date(item.created_at * 1000).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          {/* Inspect Detail */}
                          <button
                            onClick={() => onNavigate('ocr-detail', item.id)}
                            className="btn-aarambh-outline"
                            style={{ padding: '5px 8px', fontSize: '10px' }}
                            title="Open detailed report"
                          >
                            <Eye size={12} />
                          </button>

                          {/* Open in New Tab */}
                          <a
                            href={`#/ocr-history/${item.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-aarambh-outline"
                            style={{ padding: '5px 8px', fontSize: '10px', textDecoration: 'none' }}
                            title="Open in new browser tab"
                          >
                            <ExternalLink size={12} />
                          </a>

                          {/* Download Markdown if available */}
                          {item.markdown && (
                            <button
                              onClick={() => downloadMarkdown(item)}
                              className="btn-aarambh-outline"
                              style={{ padding: '5px 8px', fontSize: '10px' }}
                              title="Download Markdown (.md)"
                            >
                              <Download size={12} />
                            </button>
                          )}

                          {/* RAG Chat with Document */}
                          {item.markdown && onOpenRagChatbot && (
                            <button
                              onClick={() => onOpenRagChatbot({ id: item.id, title: item.file_name, content: item.markdown || '' })}
                              className="btn-aarambh-outline"
                              style={{ padding: '5px 8px', fontSize: '10px', color: 'var(--accent)' }}
                              title="Chat with document in RAG"
                            >
                              <MessageSquare size={12} />
                            </button>
                          )}

                          {/* Retry on failure */}
                          {item.status === 'failed' && (
                            <button
                              onClick={() => handleRetry(item)}
                              disabled={retryingId === item.id}
                              className="btn-aarambh-outline"
                              style={{ padding: '5px 8px', fontSize: '10px', color: 'var(--accent)' }}
                              title="Retry conversion"
                            >
                              <RotateCw size={12} className={retryingId === item.id ? 'aarambh-spinner' : ''} />
                            </button>
                          )}

                          {/* Delete */}
                          {deleteConfirmId === item.id ? (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                onClick={() => handleDelete(item.id)}
                                style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '4px 6px', fontSize: '10px', cursor: 'pointer' }}
                              >
                                YES
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '4px 6px', fontSize: '10px', cursor: 'pointer' }}
                              >
                                NO
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(item.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '5px' }}
                              title="Delete record"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                SHOWING PAGE {page} OF {totalPages} ({total} TOTAL RECORDS)
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="mono-tag" style={{ fontSize: '10px' }}>PER PAGE:</span>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '3px 6px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                >
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="btn-aarambh-outline"
                  style={{ padding: '5px 10px', fontSize: '11px', opacity: page <= 1 ? 0.4 : 1 }}
                >
                  <ChevronLeft size={13} /> PREV
                </button>

                <div style={{ display: 'flex', gap: '4px' }}>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pNum = i + 1
                    return (
                      <button
                        key={pNum}
                        onClick={() => setPage(pNum)}
                        className={`btn-aarambh-outline ${page === pNum ? 'btn-aarambh-primary' : ''}`}
                        style={{ padding: '4px 9px', fontSize: '11px', minWidth: '28px' }}
                      >
                        {pNum}
                      </button>
                    )
                  })}
                </div>

                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="btn-aarambh-outline"
                  style={{ padding: '5px 10px', fontSize: '11px', opacity: page >= totalPages ? 0.4 : 1 }}
                >
                  NEXT <ChevronRight size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
