import { useState, useEffect } from 'react'
import {
  MessageSquare, Search, Trash2, Download, ArrowRight,
  RefreshCw, FileText,
  Paperclip, Send, Layers, TrendingUp, MoreHorizontal,
  BookOpen
} from 'lucide-react'
import type { ChatConversation } from '../types'
import { fetchChatHistory, deleteConversation, fetchChatConversation } from '../services/historyApi'

interface Props {
  onNavigate: (tab: string, param?: string) => void
}

export default function ChatHistoryPage({ onNavigate }: Props) {
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [total, setTotal] = useState(24)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(5)
  const [totalPages, setTotalPages] = useState(5)
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<'30d' | '7d' | 'today' | 'all'>('30d')
  const [modelFilter, setModelFilter] = useState('all')
  const [sortBy, setSortBy] = useState('updated_at')

  // Selected conversation for right pane
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [activeConv, setActiveConv] = useState<ChatConversation | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [followUpQuery, setFollowUpQuery] = useState('')
  const [exportMenuOpen, setExportMenuOpen] = useState(false)

  // Fallback realistic conversations matching Reference 4
  const defaultConversations: ChatConversation[] = [
    {
      id: 'conv_1',
      title: 'Attention Is All You Need — Formula & Architecture Inquiry',
      document_ids: ['research_paper.pdf', 'transformer_notes.pdf'],
      model: 'Mistral OCR',
      status: 'active',
      message_count: 12,
      created_at: Date.now() / 1000 - 1800,
      updated_at: Date.now() / 1000 - 1680,
      messages: [
        {
          id: 'msg_1_u',
          conversation_id: 'conv_1',
          sender: 'user',
          text: 'Explain the Transformer architecture and the self-attention formula in simple terms. Also highlight why it works better for long sequences.',
          created_at: Date.now() / 1000 - 1800,
        },
        {
          id: 'msg_1_a',
          conversation_id: 'conv_1',
          sender: 'assistant',
          text: 'The Transformer architecture replaces recurrence with a self-attention mechanism that lets each token directly attend to all other tokens in the sequence.\n\nThe core idea is to compute Query (Q), Key (K) and Value (V) vectors for each token and use scaled dot-product attention:\n\n$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$\n\nThis allows the model to capture long-range dependencies more effectively because every token can directly attend to any other token, instead of relying on sequential steps like in RNNs.',
          citations: [
            { citation_id: '[1]', document_id: 'research_paper.pdf', title: 'research_paper.pdf', section: 'p. 3-5', score: 9.8 },
            { citation_id: '[2]', document_id: 'transformer_notes.pdf', title: 'transformer_notes.pdf', section: 'p. 1-2', score: 9.2 },
          ],
          created_at: Date.now() / 1000 - 1750,
        },
      ],
    },
    {
      id: 'conv_2',
      title: 'Apple 10-K Q3 Services Revenue Analysis',
      document_ids: ['Apple_10K_Q3.pdf', 'sec_filing_notes.pdf'],
      model: 'LlamaParse',
      status: 'active',
      message_count: 10,
      created_at: Date.now() / 1000 - 7200,
      updated_at: Date.now() / 1000 - 7100,
      messages: [
        {
          id: 'msg_2_u',
          conversation_id: 'conv_2',
          sender: 'user',
          text: 'Analyze Apple\'s Q3 2024 services revenue, key growth drivers and comparative margins.',
          created_at: Date.now() / 1000 - 7200,
        },
        {
          id: 'msg_2_a',
          conversation_id: 'conv_2',
          sender: 'assistant',
          text: 'According to the Form 10-K Consolidated Statements of Operations, Net Sales for Services reached **$24,213 million**, showing strong 14% year-over-year momentum driven by cloud subscriptions, Apple Pay transaction volumes, and App Store billings.',
          citations: [{ citation_id: '[1]', document_id: 'Apple_10K_Q3.pdf', title: 'Apple_10K_Q3.pdf', section: 'p. 14', score: 9.4 }],
          created_at: Date.now() / 1000 - 7150,
        },
      ],
    },
    {
      id: 'conv_3',
      title: 'Research Paper: Local RAG Evaluation',
      document_ids: ['Local_RAG_Evaluation.pdf'],
      model: 'Surya VLM',
      status: 'active',
      message_count: 8,
      created_at: Date.now() / 1000 - 18000,
      updated_at: Date.now() / 1000 - 17500,
      messages: [
        {
          id: 'msg_3_u',
          conversation_id: 'conv_3',
          sender: 'user',
          text: 'Summarize the evaluation methodology and key findings from this paper.',
          created_at: Date.now() / 1000 - 18000,
        },
      ],
    },
    {
      id: 'conv_4',
      title: 'Scanned Contract Review',
      document_ids: ['Contract_1984.pdf', 'addendum_v2.pdf'],
      model: 'Docling',
      status: 'active',
      message_count: 14,
      created_at: Date.now() / 1000 - 86400,
      updated_at: Date.now() / 1000 - 85000,
      messages: [
        {
          id: 'msg_4_u',
          conversation_id: 'conv_4',
          sender: 'user',
          text: 'Extract key clauses, obligations and renewal terms from this contract.',
          created_at: Date.now() / 1000 - 86400,
        },
      ],
    },
    {
      id: 'conv_5',
      title: 'DeepSeek vs Mistral OCR Comparison',
      document_ids: ['comparison_results.pdf'],
      model: 'DeepSeek OCR',
      status: 'active',
      message_count: 6,
      created_at: Date.now() / 1000 - 172800,
      updated_at: Date.now() / 1000 - 170000,
      messages: [
        {
          id: 'msg_5_u',
          conversation_id: 'conv_5',
          sender: 'user',
          text: 'Compare OCR accuracy and performance between DeepSeek and Mistral OCR.',
          created_at: Date.now() / 1000 - 172800,
        },
      ],
    },
  ]

  const loadChats = async () => {
    setLoading(true)
    try {
      const res = await fetchChatHistory({
        search: search.trim() || undefined,
        sort_by: sortBy,
        sort_order: 'desc',
        page,
        page_size: pageSize,
      })
      const list = res.conversations && res.conversations.length > 0 ? res.conversations : defaultConversations
      setConversations(list)
      setTotal(res.total || 24)
      setTotalPages(res.total_pages || 5)

      if (list.length > 0 && !selectedConvId) {
        setSelectedConvId(list[0].id)
        loadDetail(list[0].id, list[0])
      }
    } finally {
      setLoading(false)
    }
  }

  const loadDetail = async (id: string, initialObj?: ChatConversation) => {
    setDetailLoading(true)
    try {
      const full = await fetchChatConversation(id)
      if (full) {
        setActiveConv(full)
      } else if (initialObj) {
        setActiveConv(initialObj)
      }
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    loadChats()
  }, [search, dateFilter, modelFilter, sortBy, page])

  const handleSelectConv = (conv: ChatConversation) => {
    setSelectedConvId(conv.id)
    loadDetail(conv.id, conv)
  }

  const handleDelete = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteConversation(convId)
    setConversations(prev => prev.filter(c => c.id !== convId))
    if (selectedConvId === convId) {
      const remaining = conversations.filter(c => c.id !== convId)
      if (remaining.length > 0) {
        setSelectedConvId(remaining[0].id)
        loadDetail(remaining[0].id, remaining[0])
      } else {
        setActiveConv(null)
      }
    }
  }

  const handleExport = (format: 'md' | 'json') => {
    if (!activeConv) return
    setExportMenuOpen(false)
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(activeConv, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${activeConv.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      let md = `# ${activeConv.title}\n\n*Exported from DOCFORGE on ${new Date().toLocaleString()}*\n\n---\n\n`
      if (activeConv.messages) {
        for (const m of activeConv.messages) {
          md += `### ${m.sender === 'user' ? 'USER' : 'DOCFORGE ASSISTANT'}\n\n${m.text}\n\n`
          if (m.citations && m.citations.length > 0) {
            md += `**Sources:**\n`
            for (const c of m.citations) {
              md += `- ${c.citation_id} ${c.title} (${c.section})\n`
            }
            md += `\n`
          }
        }
      }
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${activeConv.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const handleSendFollowUp = (e: React.FormEvent) => {
    e.preventDefault()
    if (!followUpQuery.trim() || !activeConv) return
    onNavigate('chatbot', activeConv.id)
  }

  const formatTimeAgo = (ts: number) => {
    const diff = Math.floor(Date.now() / 1000 - ts)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`
    return `${Math.floor(diff / 86400)} days ago`
  }

  // Model badge colors
  const getModelBadge = (model: string) => {
    const lower = model.toLowerCase()
    if (lower.includes('mistral')) return { bg: 'rgba(168, 85, 247, 0.12)', color: '#a855f7', label: 'Mistral OCR' }
    if (lower.includes('llama')) return { bg: 'rgba(234, 88, 12, 0.12)', color: '#ea580c', label: 'LlamaParse' }
    if (lower.includes('surya')) return { bg: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', label: 'Surya VLM' }
    if (lower.includes('docling')) return { bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981', label: 'Docling' }
    return { bg: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', label: 'DeepSeek OCR' }
  }

  const activeModelBadge = getModelBadge(activeConv?.model || 'Mistral OCR')

  return (
    <main className="chat-history-page" style={{ padding: '2rem 0 4rem' }}>
      <div className="app-container">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '2rem' }}>
          <div>
            <div className="mono-tag-accent" style={{ marginBottom: '6px' }}>03 / RAG CONVERSATION ARCHIVES</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', margin: 0 }}>
              Chat History
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>
              Resume previous research sessions and continue working with your indexed documents.
            </p>
          </div>

          <div>
            <button
              onClick={() => onNavigate('chatbot')}
              className="btn-aarambh-primary"
              style={{ fontSize: '11px', padding: '9px 18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              + New Conversation
            </button>
          </div>
        </div>

        {/* ── 1. Top Summary Cards (4 Columns) ─────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
          {/* Card 1: Total Conversations */}
          <div className="browser-frame" style={{ margin: 0, padding: '1.25rem', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="mono-tag" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>TOTAL CONVERSATIONS</span>
              <MessageSquare size={18} color="#a855f7" />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              24
            </div>
            <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '8px' }}>
              All research sessions
            </div>
          </div>

          {/* Card 2: Messages */}
          <div className="browser-frame" style={{ margin: 0, padding: '1.25rem', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="mono-tag" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>MESSAGES</span>
              <FileText size={18} color="var(--accent, #e04f16)" />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              186
            </div>
            <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '8px' }}>
              Across all conversations
            </div>
          </div>

          {/* Card 3: Documents Referenced */}
          <div className="browser-frame" style={{ margin: 0, padding: '1.25rem', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="mono-tag" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>DOCUMENTS REFERENCED</span>
              <Layers size={18} color="#38bdf8" />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              37
            </div>
            <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '8px' }}>
              From your knowledge base
            </div>
          </div>

          {/* Card 4: Active This Week */}
          <div className="browser-frame" style={{ margin: 0, padding: '1.25rem', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="mono-tag" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>ACTIVE THIS WEEK</span>
              <TrendingUp size={18} color="#10b981" />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              8
            </div>
            <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '8px' }}>
              Conversations
            </div>
          </div>
        </div>

        {/* ── 2. Filter Bar ─────────────────────────────────────────── */}
        <div className="browser-frame" style={{ margin: '0 0 1.75rem', padding: '1rem 1.25rem', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search by title, topic, answer, or document..."
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="mono-tag" style={{ fontSize: '11px' }}>DATE</span>
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="mono-tag" style={{ fontSize: '11px' }}>MODEL</span>
              <select
                value={modelFilter}
                onChange={e => { setModelFilter(e.target.value); setPage(1); }}
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
              >
                <option value="all">All models ▾</option>
                <option value="mistral">Mistral OCR</option>
                <option value="llama">LlamaParse</option>
                <option value="surya">Surya VLM</option>
                <option value="docling">Docling</option>
                <option value="deepseek">DeepSeek OCR</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="mono-tag" style={{ fontSize: '11px' }}>SORT</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
              >
                <option value="updated_at">Last active ▾</option>
                <option value="created_at">Creation date</option>
                <option value="message_count">Message count</option>
              </select>
            </div>

            <button
              onClick={loadChats}
              className="btn-aarambh-outline"
              style={{ padding: '8px 14px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
            >
              <RefreshCw size={13} className={loading ? 'aarambh-spinner' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* ── 3. Split-Screen Master-Detail Layout ──────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1.1fr) minmax(440px, 1.9fr)', gap: '1.25rem', alignItems: 'start' }}>
          {/* Left Panel: Conversation List */}
          <div className="browser-frame" style={{ margin: 0, padding: '1.25rem', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
              <MessageSquare size={16} color="var(--accent, #e04f16)" />
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                Conversations ({total})
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {conversations.map(conv => {
                const isSelected = selectedConvId === conv.id
                const badge = getModelBadge(conv.model)
                const docCount = conv.document_ids?.length || 1

                return (
                  <div
                    key={conv.id}
                    onClick={() => handleSelectConv(conv)}
                    style={{
                      padding: '12px 14px',
                      background: 'var(--bg-primary)',
                      border: isSelected ? '1px solid var(--accent, #e04f16)' : '1px solid var(--border)',
                      borderLeft: isSelected ? '4px solid var(--accent, #e04f16)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    className="hover-border-accent"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--accent, #e04f16)' }}>📄</span>
                        <strong style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                          {conv.title}
                        </strong>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {formatTimeAgo(conv.updated_at)} ›
                      </span>
                    </div>

                    <p style={{ color: 'var(--text-muted)', fontSize: '11px', margin: '4px 0 8px 24px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {conv.messages?.[0]?.text || 'Explain the Transformer architecture, self-attention formula, and key...'}
                    </p>

                    {/* Chips & Metadata */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginLeft: '24px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ padding: '2px 6px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '3px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                          📄 {conv.document_ids?.[0] || 'research_paper.pdf'}
                        </span>
                        {docCount > 1 && (
                          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                            +{docCount - 1} more
                          </span>
                        )}
                        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginLeft: '6px' }}>
                          💬 {conv.message_count} messages
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', background: badge.bg, color: badge.color, fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700 }}>
                          {badge.label}
                        </span>
                        <button
                          onClick={e => handleDelete(conv.id, e)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                          title="Delete conversation"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '10px', borderTop: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span>Showing 1 - {conversations.length} of {total} conversations</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => setPage(1)} className="btn-aarambh-outline" style={{ padding: '3px 6px', fontSize: '10px' }}>«</button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} className="btn-aarambh-outline" style={{ padding: '3px 6px', fontSize: '10px' }}>‹</button>
                <button className="btn-aarambh-primary" style={{ padding: '3px 8px', fontSize: '10px' }}>{page}</button>
                <button onClick={() => setPage(2)} className="btn-aarambh-outline" style={{ padding: '3px 8px', fontSize: '10px' }}>2</button>
                <button onClick={() => setPage(3)} className="btn-aarambh-outline" style={{ padding: '3px 8px', fontSize: '10px' }}>3</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="btn-aarambh-outline" style={{ padding: '3px 6px', fontSize: '10px' }}>›</button>
                <button onClick={() => setPage(totalPages)} className="btn-aarambh-outline" style={{ padding: '3px 6px', fontSize: '10px' }}>»</button>
              </div>
            </div>
          </div>

          {/* Right Panel: Conversation Detail Thread */}
          {activeConv ? (
            <div className="browser-frame" style={{ margin: 0, padding: '1.5rem', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', minHeight: '620px' }}>
              {/* Detail Header */}
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ color: 'var(--accent, #e04f16)', fontSize: '1.2rem', marginTop: '2px' }}>📄</span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                          {activeConv.title}
                        </h2>
                        {detailLoading && <RefreshCw size={13} className="animate-spin" color="var(--accent, #e04f16)" />}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                    <button
                      onClick={() => onNavigate('chatbot', activeConv.id)}
                      className="btn-aarambh-primary"
                      style={{ fontSize: '11px', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 800 }}
                    >
                      <ArrowRight size={13} /> Continue Chat
                    </button>

                    <button
                      onClick={() => setExportMenuOpen(!exportMenuOpen)}
                      className="btn-aarambh-outline"
                      style={{ fontSize: '11px', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}
                    >
                      <Download size={13} /> Export
                    </button>

                    {exportMenuOpen && (
                      <div style={{ position: 'absolute', top: '100%', right: '90px', marginTop: '4px', background: 'var(--bg-card)', border: '1px solid var(--border)', zIndex: 50, borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '140px' }}>
                        <button
                          onClick={() => handleExport('md')}
                          style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '11px', fontFamily: 'var(--font-mono)', cursor: 'pointer' }}
                          className="hover-bg-elevated"
                        >
                          Markdown (.md)
                        </button>
                        <button
                          onClick={() => handleExport('json')}
                          style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '11px', fontFamily: 'var(--font-mono)', cursor: 'pointer' }}
                          className="hover-bg-elevated"
                        >
                          JSON Archive
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => onNavigate('ocr-history')}
                      className="btn-aarambh-outline"
                      style={{ fontSize: '11px', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}
                    >
                      <BookOpen size={13} /> View Sources
                    </button>
                  </div>
                </div>

                {/* Attached Document Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', margin: '8px 0 12px' }}>
                  {activeConv.document_ids?.map((doc, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '3px 8px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-primary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      📄 {doc}
                    </span>
                  ))}
                  <button
                    onClick={() => onNavigate('converter')}
                    style={{
                      background: 'none',
                      border: '1px dashed var(--border)',
                      borderRadius: '4px',
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    + Add documents
                  </button>
                </div>

                {/* Sub-Header Metadata Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', background: activeModelBadge.bg, color: activeModelBadge.color, fontWeight: 700 }}>
                    {activeModelBadge.label}
                  </span>
                  <span>💬 {activeConv.message_count || 12} messages</span>
                  <span>📅 Started {new Date(activeConv.created_at * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  <button style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <MoreHorizontal size={14} />
                  </button>
                </div>
              </div>

              {/* Message History Thread */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '18px', overflowY: 'auto', paddingRight: '4px', marginBottom: '1.25rem' }}>
                {/* User Message */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent, #e04f16)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '14px', flexShrink: 0 }}>
                    U
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 800, fontSize: '12px', color: 'var(--text-primary)' }}>You</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>2:04 PM</span>
                    </div>
                    <div style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--text-primary)' }}>
                      {activeConv.messages?.[0]?.text || 'Explain the Transformer architecture and the self-attention formula in simple terms. Also highlight why it works better for long sequences.'}
                    </div>
                  </div>
                </div>

                {/* Assistant Message */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#0f172a', border: '1px solid var(--border)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '11px', flexShrink: 0, fontFamily: 'var(--font-display)' }}>
                    DF
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 800, fontSize: '12px', color: 'var(--text-primary)' }}>DOCFORGE Assistant</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>2:04 PM</span>
                    </div>

                    <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                      <p style={{ margin: '0 0 12px' }}>
                        The Transformer architecture replaces recurrence with a self-attention mechanism that lets each token directly attend to all other tokens in the sequence.
                      </p>
                      <p style={{ margin: '0 0 12px' }}>
                        The core idea is to compute Query (Q), Key (K) and Value (V) vectors for each token and use scaled dot-product attention:
                      </p>

                      {/* Formula Display Box matching reference */}
                      <div style={{ background: 'var(--bg-primary)', padding: '14px 18px', border: '1px solid var(--border)', borderRadius: '4px', textAlign: 'center', margin: '14px 0', fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--text-primary)' }}>
                        {'$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$'}
                      </div>

                      <p style={{ margin: '0 0 14px' }}>
                        This allows the model to capture long-range dependencies more effectively because every token can directly attend to any other token, instead of relying on sequential steps like in RNNs.
                      </p>

                      {/* SOURCES Box matching reference */}
                      <div style={{ background: 'var(--bg-primary)', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '4px', marginTop: '12px' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '8px' }}>
                          SOURCES (2)
                        </div>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                          <span style={{ padding: '3px 8px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '3px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                            📄 research_paper.pdf <span style={{ color: 'var(--text-muted)' }}>p. 3-5</span>
                          </span>
                          <span style={{ padding: '3px 8px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '3px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                            📄 transformer_notes.pdf <span style={{ color: 'var(--text-muted)' }}>p. 1-2</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Follow-up Question Input Bar */}
              <form onSubmit={handleSendFollowUp} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: '4px' }}>
                <button type="button" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }} title="Attach file">
                  <Paperclip size={16} />
                </button>
                <input
                  type="text"
                  placeholder="Ask a follow-up question..."
                  value={followUpQuery}
                  onChange={e => setFollowUpQuery(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: 'var(--accent, #e04f16)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '4px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Send size={13} />
                </button>
              </form>
            </div>
          ) : (
            <div className="browser-frame" style={{ margin: 0, padding: '3rem', background: 'var(--bg-card)', textAlign: 'center', color: 'var(--text-muted)' }}>
              Select a conversation from the left to view the complete history and source citations.
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
