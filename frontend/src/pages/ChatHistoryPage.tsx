import { useState, useEffect } from 'react'
import {
  MessageSquare, Search, Trash2, Edit3, Download, ArrowRight,
  Check, X, ChevronLeft, ChevronRight, RefreshCw, ArrowUpDown
} from 'lucide-react'
import type { ChatConversation } from '../types'
import { fetchChatHistory, renameConversation, deleteConversation, fetchChatConversation } from '../services/historyApi'

interface Props {
  onNavigate: (tab: string, param?: string) => void
}

export default function ChatHistoryPage({ onNavigate }: Props) {
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('updated_at')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')

  // Renaming state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  // Deletion confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const loadChats = async () => {
    setLoading(true)
    try {
      const res = await fetchChatHistory({
        search: search.trim() || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        page_size: pageSize,
      })
      setConversations(res.conversations)
      setTotal(res.total)
      setTotalPages(res.total_pages)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadChats()
  }, [search, sortBy, sortOrder, page, pageSize])

  const handleStartRename = (conv: ChatConversation, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(conv.id)
    setEditTitle(conv.title)
  }

  const handleSaveRename = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!editTitle.trim()) return
    await renameConversation(convId, editTitle.trim())
    setEditingId(null)
    loadChats()
  }

  const handleDelete = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteConversation(convId)
    setDeleteConfirmId(null)
    loadChats()
  }

  const handleExportChat = async (conv: ChatConversation, format: 'md' | 'json', e: React.MouseEvent) => {
    e.stopPropagation()
    const fullConv = await fetchChatConversation(conv.id)
    if (!fullConv) return

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(fullConv, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${conv.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      let md = `# ${fullConv.title}\n\n`
      md += `*Exported from DOCFORGE RAG Studio on ${new Date().toLocaleString()}*\n`
      md += `*Model: ${fullConv.model} | Messages: ${fullConv.messages?.length || 0}*\n\n---\n\n`
      if (fullConv.messages) {
        for (const m of fullConv.messages) {
          md += `### ${m.sender === 'user' ? 'USER' : 'DOCFORGE ASSISTANT'} (${new Date(m.created_at * 1000).toLocaleTimeString()})\n\n`
          md += `${m.text}\n\n`
          if (m.citations && m.citations.length > 0) {
            md += `**Citations:**\n`
            for (const c of m.citations) {
              md += `- ${c.citation_id} *${c.title}* (${c.section}) - Score: ${c.score}\n`
            }
            md += `\n`
          }
          md += `---\n\n`
        }
      }
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${conv.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const formatTimeAgo = (ts: number) => {
    const diff = Math.floor(Date.now() / 1000 - ts)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <main className="chat-history-page" style={{ padding: '2rem 0 4rem' }}>
      <div className="app-container">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '2rem' }}>
          <div>
            <div className="mono-tag-accent" style={{ marginBottom: '6px' }}>/ 03 RAG CONVERSATION ARCHIVES</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', margin: 0 }}>
              Chat History
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>
              Persistent dialogues and citation-grounded research sessions across your knowledge base.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={() => onNavigate('chatbot')}
              className="btn-aarambh-primary"
              style={{ fontSize: '11px', padding: '8px 16px' }}
            >
              + NEW CONVERSATION
            </button>
          </div>
        </div>

        {/* Search & Sort Bar */}
        <div className="browser-frame" style={{ marginBottom: '1.75rem' }}>
          <div style={{ padding: '1.25rem', background: 'var(--bg-card)', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search conversations by title or topic..."
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

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className="mono-tag">SORT:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
              >
                <option value="updated_at">LAST ACTIVE</option>
                <option value="created_at">CREATION DATE</option>
                <option value="message_count">MESSAGE COUNT</option>
              </select>

              <button
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="btn-aarambh-outline"
                style={{ padding: '6px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Toggle ascending / descending"
              >
                <ArrowUpDown size={12} /> {sortOrder.toUpperCase()}
              </button>

              <button
                onClick={loadChats}
                className="btn-aarambh-outline"
                style={{ padding: '7px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={13} className={loading ? 'aarambh-spinner' : ''} /> REFRESH
              </button>
            </div>
          </div>
        </div>

        {/* ── Conversation Grid ──────────────────────────────────────── */}
        <div className="browser-frame">
          <div className="browser-frame__header">
            <div className="browser-frame__dots">
              <span className="browser-frame__dot" />
              <span className="browser-frame__dot" />
              <span className="browser-frame__dot" />
            </div>
            <div className="browser-frame__address">docforge.local/conversations</div>
            <div style={{ marginLeft: 'auto' }}>
              <span className="mono-tag" style={{ color: 'var(--accent)' }}>
                {total} CONVERSATIONS STORED
              </span>
            </div>
          </div>

          <div style={{ padding: '1.5rem', background: 'var(--bg-card)' }}>
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                <span className="aarambh-spinner" style={{ marginRight: '8px' }} />
                LOADING CHAT ARCHIVES...
              </div>
            ) : conversations.length === 0 ? (
              <div style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
                <MessageSquare size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800 }}>No Chat Conversations Found</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '420px', margin: '4px auto 16px' }}>
                  Ask questions against your converted documents in RAG Chatbot to build semantic conversation histories.
                </p>
                <button
                  onClick={() => onNavigate('chatbot')}
                  className="btn-aarambh-primary"
                  style={{ fontSize: '11px', padding: '8px 18px' }}
                >
                  START NEW CHAT
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' }}>
                {conversations.map(conv => (
                  <div
                    key={conv.id}
                    onClick={() => onNavigate('chatbot', conv.id)}
                    style={{
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border)',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s ease, transform 0.15s ease',
                    }}
                    className="hover-border-accent"
                  >
                    <div>
                      {/* Top Meta */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span className="mono-tag" style={{ color: '#a855f7' }}>
                          <MessageSquare size={11} style={{ marginRight: '4px' }} /> {conv.message_count} MESSAGES
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                          {formatTimeAgo(conv.updated_at)}
                        </span>
                      </div>

                      {/* Title or Inline Edit */}
                      {editingId === conv.id ? (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '10px' }} onClick={e => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            style={{ flex: 1, padding: '4px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--accent)', color: 'var(--text-primary)', fontSize: '13px' }}
                          />
                          <button onClick={e => handleSaveRename(conv.id, e)} className="btn-aarambh-primary" style={{ padding: '4px 8px' }}>
                            <Check size={12} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); setEditingId(null); }} className="btn-aarambh-outline" style={{ padding: '4px 8px' }}>
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                          {conv.title}
                        </h3>
                      )}

                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                        Model: {conv.model} · {conv.document_ids.length > 0 ? `${conv.document_ids.length} docs indexed` : 'General RAG'}
                      </div>
                    </div>

                    {/* Bottom Action Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '10px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={e => handleStartRename(conv, e)}
                          className="btn-aarambh-outline"
                          style={{ padding: '4px 8px', fontSize: '10px' }}
                          title="Rename title"
                        >
                          <Edit3 size={11} />
                        </button>
                        <button
                          onClick={e => handleExportChat(conv, 'md', e)}
                          className="btn-aarambh-outline"
                          style={{ padding: '4px 8px', fontSize: '10px' }}
                          title="Export Markdown (.md)"
                        >
                          <Download size={11} />
                        </button>
                        {deleteConfirmId === conv.id ? (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              onClick={e => handleDelete(conv.id, e)}
                              style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '3px 6px', fontSize: '10px', cursor: 'pointer' }}
                            >
                              CONFIRM
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); setDeleteConfirmId(null); }}
                              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '3px 6px', fontSize: '10px', cursor: 'pointer' }}
                            >
                              CANCEL
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={e => { e.stopPropagation(); setDeleteConfirmId(conv.id); }}
                            className="btn-aarambh-outline"
                            style={{ padding: '4px 8px', fontSize: '10px', color: 'var(--text-muted)' }}
                            title="Delete conversation"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => onNavigate('chatbot', conv.id)}
                        className="btn-aarambh-primary"
                        style={{ padding: '4px 10px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        CONTINUE CHAT <ArrowRight size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                PAGE {page} OF {totalPages} ({total} CONVERSATIONS)
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="mono-tag" style={{ fontSize: '10px' }}>PER PAGE:</span>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '3px 6px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                >
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                  <option value={48}>48</option>
                </select>
              </div>
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="btn-aarambh-outline"
                  style={{ padding: '4px 10px', fontSize: '11px', opacity: page <= 1 ? 0.4 : 1 }}
                >
                  <ChevronLeft size={12} /> PREV
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="btn-aarambh-outline"
                  style={{ padding: '4px 10px', fontSize: '11px', opacity: page >= totalPages ? 0.4 : 1 }}
                >
                  NEXT <ChevronRight size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
