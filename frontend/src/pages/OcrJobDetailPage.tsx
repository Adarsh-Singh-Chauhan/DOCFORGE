import { useState, useEffect } from 'react'
import {
  ArrowLeft, Download, Copy, Check, MessageSquare, RotateCw, AlertTriangle
} from 'lucide-react'
import type { OcrHistoryRecord } from '../types'
import { fetchOcrJobDetail, retryOcrJob } from '../services/historyApi'

interface Props {
  jobId: string
  onBack: () => void
  onOpenRagChatbot?: (doc?: { id: string; title: string; content: string }) => void
}

/** Markdown renderer */
function renderMd(md: string): string {
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/```[\s\S]*?```/g, m => {
      const inner = m.slice(3, -3).replace(/^\w*\n/, '')
      return `<pre><code>${inner}</code></pre>`
    })
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^[*-] (.+)$/gm, '<li>$1</li>')
    .replace(/\n{2,}/g, '</p><p>')
  return `<p>${html}</p>`
}

export default function OcrJobDetailPage({ jobId, onBack, onOpenRagChatbot }: Props) {
  const [job, setJob] = useState<OcrHistoryRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'preview' | 'raw'>('preview')
  const [copied, setCopied] = useState(false)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetchOcrJobDetail(jobId).then(data => {
      if (mounted) {
        setJob(data)
        setLoading(false)
      }
    })
    return () => { mounted = false }
  }, [jobId])

  const copyMarkdown = () => {
    if (!job?.markdown) return
    navigator.clipboard.writeText(job.markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadMarkdown = () => {
    if (!job?.markdown) return
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

  const handleRetry = async () => {
    if (!job) return
    setRetrying(true)
    try {
      await retryOcrJob(job.id)
      onBack()
    } finally {
      setRetrying(false)
    }
  }

  const formatDuration = (ms: number) => {
    if (!ms) return '0s'
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
  }

  if (loading) {
    return (
      <main style={{ padding: '3rem 0' }}>
        <div className="app-container" style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          <span className="aarambh-spinner" style={{ marginRight: '8px' }} />
          LOADING JOB DETAILS #{jobId}...
        </div>
      </main>
    )
  }

  if (!job) {
    return (
      <main style={{ padding: '3rem 0' }}>
        <div className="app-container" style={{ textAlign: 'center' }}>
          <AlertTriangle size={32} color="var(--accent)" style={{ margin: '0 auto 12px' }} />
          <h2>Job Record Not Found</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            The requested OCR conversion record does not exist or has been removed.
          </p>
          <button onClick={onBack} className="btn-aarambh-outline">
            ← BACK TO HISTORY
          </button>
        </div>
      </main>
    )
  }

  const isLocal = job.engine_type === 'local'

  return (
    <main style={{ padding: '2rem 0 4rem' }}>
      <div className="app-container">
        {/* Breadcrumb Header */}
        <div style={{ marginBottom: '1.75rem' }}>
          <button
            onClick={onBack}
            className="btn-aarambh-outline"
            style={{ fontSize: '11px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}
          >
            <ArrowLeft size={13} /> BACK TO HISTORY
          </button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div className="mono-tag-accent" style={{ marginBottom: '4px' }}>
                JOB ID: {job.id} · {new Date(job.created_at * 1000).toLocaleString()}
              </div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>
                {job.file_name}
              </h1>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {job.markdown && (
                <>
                  <button
                    onClick={copyMarkdown}
                    className="btn-aarambh-outline"
                    style={{ fontSize: '11px', padding: '8px 14px' }}
                  >
                    {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                    {copied ? 'COPIED' : 'COPY MARKDOWN'}
                  </button>

                  <button
                    onClick={downloadMarkdown}
                    className="btn-aarambh-outline"
                    style={{ fontSize: '11px', padding: '8px 14px' }}
                  >
                    <Download size={13} /> DOWNLOAD .MD
                  </button>

                  {onOpenRagChatbot && (
                    <button
                      onClick={() => onOpenRagChatbot({ id: job.id, title: job.file_name, content: job.markdown || '' })}
                      className="btn-aarambh-primary"
                      style={{ fontSize: '11px', padding: '8px 16px' }}
                    >
                      <MessageSquare size={13} /> CHAT IN RAG STUDIO
                    </button>
                  )}
                </>
              )}

              {job.status === 'failed' && (
                <button
                  onClick={handleRetry}
                  disabled={retrying}
                  className="btn-aarambh-primary"
                  style={{ fontSize: '11px', padding: '8px 16px' }}
                >
                  <RotateCw size={13} className={retrying ? 'aarambh-spinner' : ''} /> RETRY JOB
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── 1. Telemetry Overview HUD ─────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="browser-frame" style={{ margin: 0, padding: '1.25rem' }}>
            <span className="mono-tag">SELECTED ENGINE</span>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, marginTop: '6px', color: 'var(--text-primary)' }}>
              {job.engine_name}
            </div>
            <div style={{ marginTop: '6px' }}>
              <span
                className="mono-tag"
                style={{
                  color: isLocal ? '#10b981' : 'var(--accent)',
                  borderColor: isLocal ? '#10b981' : 'var(--accent)',
                  fontSize: '10px',
                }}
              >
                {isLocal ? '100% AIR-GAPPED' : 'EXTERNAL CLOUD'}
              </span>
            </div>
          </div>

          <div className="browser-frame" style={{ margin: 0, padding: '1.25rem' }}>
            <span className="mono-tag">PROCESSING DURATION</span>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 900, marginTop: '6px', color: 'var(--text-primary)' }}>
              {formatDuration(job.duration_ms)}
            </div>
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '4px' }}>
              {job.page_count || 1} pages · {((job.duration_ms / (job.page_count || 1))).toFixed(0)}ms/page
            </div>
          </div>

          <div className="browser-frame" style={{ margin: 0, padding: '1.25rem' }}>
            <span className="mono-tag">TOKEN EFFICIENCY</span>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 900, marginTop: '6px', color: 'var(--accent)' }}>
              +{job.reduction_percent || 0}%
            </div>
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '4px' }}>
              {job.tokens_saved || 0} tokens saved
            </div>
          </div>

          <div className="browser-frame" style={{ margin: 0, padding: '1.25rem' }}>
            <span className="mono-tag">STRUCTURED ASSETS</span>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, marginTop: '6px', color: 'var(--text-primary)' }}>
              {job.tables_detected || 0} TBL · {job.equations_detected || 0} EQ
            </div>
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '4px' }}>
              {job.markdown_words || 0} words extracted
            </div>
          </div>
        </div>

        {/* ── 2. Processing Pipeline Stages ─────────────────────────── */}
        <div className="browser-frame" style={{ marginBottom: '2rem' }}>
          <div className="browser-frame__header">
            <div className="browser-frame__dots">
              <span className="browser-frame__dot" />
              <span className="browser-frame__dot" />
              <span className="browser-frame__dot" />
            </div>
            <div className="browser-frame__address">pipeline.telemetry / execution-trace</div>
            <div style={{ marginLeft: 'auto' }}>
              <span className="mono-tag" style={{ color: job.status === 'completed' ? '#10b981' : 'var(--accent)' }}>
                {job.status === 'completed' ? 'STAGE 6/6 VERIFIED' : 'STAGE HALTED'}
              </span>
            </div>
          </div>

          <div style={{ padding: '1.5rem', background: 'var(--bg-card)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div style={{ borderLeft: '2px solid #10b981', paddingLeft: '12px' }}>
                <div className="mono-tag" style={{ color: '#10b981' }}>01 / INGESTION</div>
                <div style={{ fontWeight: 800, fontSize: '13px', marginTop: '4px' }}>File Validation</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  {(job.original_size / 1024).toFixed(1)} KB PDF checked
                </div>
              </div>

              <div style={{ borderLeft: '2px solid #10b981', paddingLeft: '12px' }}>
                <div className="mono-tag" style={{ color: '#10b981' }}>02 / TEXT INSPECTION</div>
                <div style={{ fontWeight: 800, fontSize: '13px', marginTop: '4px' }}>Selectable Text</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  Baseline glyph & font audit
                </div>
              </div>

              <div style={{ borderLeft: `2px solid ${job.status === 'completed' ? '#10b981' : 'var(--accent)'}`, paddingLeft: '12px' }}>
                <div className="mono-tag" style={{ color: job.status === 'completed' ? '#10b981' : 'var(--accent)' }}>03 / OCR & LAYOUT</div>
                <div style={{ fontWeight: 800, fontSize: '13px', marginTop: '4px' }}>{job.engine.toUpperCase()} Engine</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  {job.status === 'completed' ? `${job.page_count || 1} pages parsed` : 'Processing error'}
                </div>
              </div>

              <div style={{ borderLeft: `2px solid ${job.status === 'completed' ? '#10b981' : 'var(--border)'}`, paddingLeft: '12px' }}>
                <div className="mono-tag" style={{ color: job.status === 'completed' ? '#10b981' : 'var(--text-muted)' }}>04 / SYNTHESIS</div>
                <div style={{ fontWeight: 800, fontSize: '13px', marginTop: '4px' }}>LaTeX & Tables</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  {job.equations_detected || 0} formulas detected
                </div>
              </div>

              <div style={{ borderLeft: `2px solid ${job.status === 'completed' ? '#10b981' : 'var(--border)'}`, paddingLeft: '12px' }}>
                <div className="mono-tag" style={{ color: job.status === 'completed' ? '#10b981' : 'var(--text-muted)' }}>05 / NORMALIZATION</div>
                <div style={{ fontWeight: 800, fontSize: '13px', marginTop: '4px' }}>Clean Markdown</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  {job.markdown_chars || 0} characters
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. Error Trace (if failed) ────────────────────────────── */}
        {job.status === 'failed' && job.error && (
          <div className="browser-frame" style={{ marginBottom: '2rem', borderColor: 'var(--accent)' }}>
            <div className="browser-frame__header" style={{ background: 'rgba(224, 79, 22, 0.15)' }}>
              <div className="browser-frame__dots">
                <span className="browser-frame__dot" style={{ background: 'var(--accent)' }} />
                <span className="browser-frame__dot" />
                <span className="browser-frame__dot" />
              </div>
              <div className="browser-frame__address">diagnostic.log / error-trace</div>
            </div>
            <div style={{ padding: '1.25rem', background: '#0d0d10', color: '#f87171', fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.6 }}>
              {job.error}
            </div>
          </div>
        )}

        {/* ── 4. Extracted Markdown Output Inspector ────────────────── */}
        {job.markdown && (
          <div className="browser-frame">
            <div className="browser-frame__header">
              <div className="browser-frame__dots">
                <span className="browser-frame__dot" />
                <span className="browser-frame__dot" />
                <span className="browser-frame__dot" />
              </div>
              <div className="browser-frame__address">docforge.output/{job.file_name.replace(/\.[^/.]+$/, '')}.md</div>
              <div style={{ marginLeft: 'auto' }}>
                <span className="mono-tag" style={{ color: 'var(--accent)' }}>
                  {job.markdown_words} WORDS · {job.markdown_chars} CHARS
                </span>
              </div>
            </div>

            {/* Tab switch */}
            <div className="aarambh-tab-group">
              <button
                className={`aarambh-tab ${tab === 'preview' ? 'aarambh-tab--active' : ''}`}
                onClick={() => setTab('preview')}
              >
                [RENDERED PREVIEW]
              </button>
              <button
                className={`aarambh-tab ${tab === 'raw' ? 'aarambh-tab--active' : ''}`}
                onClick={() => setTab('raw')}
              >
                [RAW MARKDOWN CODE]
              </button>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '1.5rem', minHeight: '340px' }}>
              {tab === 'preview' ? (
                <div
                  className="aarambh-preview-content"
                  dangerouslySetInnerHTML={{ __html: renderMd(job.markdown) }}
                />
              ) : (
                <pre
                  style={{
                    margin: 0,
                    padding: '1rem',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    lineHeight: 1.6,
                    color: 'var(--text-primary)',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {job.markdown}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
