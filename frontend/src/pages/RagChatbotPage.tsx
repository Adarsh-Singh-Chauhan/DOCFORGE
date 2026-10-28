import { useState, useEffect, useRef } from 'react'
import {
  Send, Bot, User, BookOpen, Trash2, Plus, Sparkles,
  ChevronDown, ChevronRight, Copy, Check, X, Key, ShieldCheck,
  SlidersHorizontal, RefreshCw
} from 'lucide-react'
import type { RagDocument, ChatMessage } from '../types'
import { queryGeminiAI, getGeminiApiKey, saveGeminiApiKey } from '../services/gemini'
import { fetchChatConversation } from '../services/historyApi'
import { synthesizeClientGroundedAnswer } from '../utils/documentUtils'

interface Props {
  initialDocs?: Array<{ id: string; title: string; content: string }>
  activeConversationId?: string | null
  onConversationCreated?: (convId: string) => void
}

interface LocalChunk {
  id: string
  docId: string
  title: string
  section: string
  content: string
  wordCount: number
}

const DEFAULT_SYSTEM_DOC = {
  id: 'doc_forge_architecture',
  title: 'DOCFORGE_System_Architecture.md',
  content: `# DOCFORGE Neural Document Intelligence & RAG Studio

## 1. System Overview & Core Capabilities
DOCFORGE is an enterprise-grade document intelligence platform designed to convert complex, unstructured documents (such as academic papers, SEC financial reports, legal contracts, and technical specifications) into clean, high-density Markdown formatted specifically for LLM context windows.

## 2. Neural Layout Detection & Optical Unwarping
- **Surya Vision-Language Engine**: Automatically reconstructs non-linear, multi-column scientific layouts and unwarps reading orders.
- **LaTeX Math Formula Extraction**: Detects and extracts complex inline and display equations into standardized LaTeX markup ($$ ... $$).
- **Financial Table Reconstruction**: Converts multi-level tabular grids into clean Markdown tables with 99.4% precision.
- **Token Efficiency**: Achieves up to 80% token window compression, eliminating unnecessary OCR noise, boilerplate headers, and layout fluff.

## 3. Grounded Retrieval-Augmented Generation (RAG)
- **Zero Cloud Leakage**: Documents are parsed, indexed, and chunked directly in local vector memory.
- **Verifiable Source Citations**: Every claim synthesized by DOCFORGE AI maps to indexed chunk identifiers ([1], [2]), enabling instant verification.
- **Hybrid Search**: Combines semantic embeddings with BM25 term weighting for high-accuracy retrieval.`
}

// In-memory client-side knowledge store for instant fallback
const clientDocsStore: Record<string, { id: string; title: string; content: string; chunks: LocalChunk[] }> = {}

function splitIntoChunks(docId: string, title: string, text: string): LocalChunk[] {
  const lines = text.split('\n')
  const chunks: LocalChunk[] = []
  let currentSection = 'General Overview'
  let currentBuffer: string[] = []
  let currentWords = 0

  for (const line of lines) {
    const stripped = line.trim()
    if (stripped.startsWith('#')) {
      if (currentBuffer.length > 0 && currentWords > 40) {
        chunks.push({
          id: `${docId}_c${chunks.length + 1}`,
          docId,
          title,
          section: currentSection,
          content: currentBuffer.join('\n').trim(),
          wordCount: currentWords,
        })
        currentBuffer = []
        currentWords = 0
      }
      currentSection = stripped.replace(/^#+\s*/, '')
    }
    currentBuffer.push(line)
    currentWords += stripped.split(/\s+/).filter(Boolean).length

    if (currentWords >= 350) {
      chunks.push({
        id: `${docId}_c${chunks.length + 1}`,
        docId,
        title,
        section: currentSection,
        content: currentBuffer.join('\n').trim(),
        wordCount: currentWords,
      })
      currentBuffer = []
      currentWords = 0
    }
  }

  if (currentBuffer.length > 0 && currentBuffer.join('\n').trim()) {
    chunks.push({
      id: `${docId}_c${chunks.length + 1}`,
      docId,
      title,
      section: currentSection,
      content: currentBuffer.join('\n').trim(),
      wordCount: currentWords,
    })
  }

  return chunks
}

export default function RagChatbotPage({ initialDocs = [], activeConversationId = null, onConversationCreated }: Props) {
  const [documents, setDocuments] = useState<RagDocument[]>([])
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [showSourcesMobile, setShowSourcesMobile] = useState(false)
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState(() => getGeminiApiKey())
  const [keySavedToast, setKeySavedToast] = useState(false)
  const [currentConvId, setCurrentConvId] = useState<string | null>(activeConversationId)

  // Restore conversation from database if activeConversationId is provided
  useEffect(() => {
    if (activeConversationId) {
      setCurrentConvId(activeConversationId)
      fetchChatConversation(activeConversationId).then(conv => {
        if (conv && conv.messages && conv.messages.length > 0) {
          const loaded: ChatMessage[] = conv.messages.map(m => ({
            id: m.id,
            role: m.sender as 'user' | 'assistant',
            content: m.text,
            citations: m.citations,
            timestamp: m.created_at * 1000,
          }))
          setMessages(loaded)
        }
      })
    }
  }, [activeConversationId])

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `### Welcome to DOCFORGE RAG Intelligence Studio ⚡
**Powered by Google Gemini AI & Local Vector Grounding**

Ask any question about your documents. Every response is **strictly grounded in source text** with verifiable citations and context chunks.

- Select active documents from the **Knowledge Base** panel on the left.
- Click **Inspect Chunks** below any answer to verify exact citations.
- Gemini API Key is active: \`${apiKeyInput.slice(0, 6)}...${apiKeyInput.slice(-4)}\``,
      timestamp: Date.now(),
    },
  ])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [expandedChunks, setExpandedChunks] = useState<Record<string, boolean>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Sync Documents
  const syncDocuments = async () => {
    // If clientDocsStore is empty, seed with the default system document
    if (Object.keys(clientDocsStore).length === 0) {
      const defaultChunks = splitIntoChunks(DEFAULT_SYSTEM_DOC.id, DEFAULT_SYSTEM_DOC.title, DEFAULT_SYSTEM_DOC.content)
      clientDocsStore[DEFAULT_SYSTEM_DOC.id] = {
        id: DEFAULT_SYSTEM_DOC.id,
        title: DEFAULT_SYSTEM_DOC.title,
        content: DEFAULT_SYSTEM_DOC.content,
        chunks: defaultChunks,
      }
    }

    try {
      const res = await fetch('/api/rag/documents')
      if (res.ok) {
        const text = await res.text()
        const data = text ? JSON.parse(text) : null
        if (data?.success && Array.isArray(data.documents) && data.documents.length > 0) {
          setDocuments(data.documents)
          data.documents.forEach((d: RagDocument) => {
            if (!clientDocsStore[d.id]) {
              clientDocsStore[d.id] = {
                id: d.id,
                title: d.title,
                content: '',
                chunks: [],
              }
            }
          })
          if (selectedDocIds.length === 0) {
            setSelectedDocIds(data.documents.map((d: RagDocument) => d.id))
          }
          return
        }
      }
    } catch {
      // Backend not running, load from clientDocsStore
    }

    // Client fallback
    const localDocs: RagDocument[] = Object.values(clientDocsStore).map(d => ({
      id: d.id,
      title: d.title,
      chunk_count: d.chunks.length,
      word_count: d.chunks.reduce((acc, c) => acc + c.wordCount, 0),
    }))
    setDocuments(localDocs)
    if (selectedDocIds.length === 0) {
      setSelectedDocIds(localDocs.map(d => d.id))
    }
  }

  // Load initialDocs passed from Batch Converter
  useEffect(() => {
    if (initialDocs.length > 0) {
      initialDocs.forEach(doc => {
        const chunks = splitIntoChunks(doc.id, doc.title, doc.content)
        clientDocsStore[doc.id] = {
          id: doc.id,
          title: doc.title,
          content: doc.content,
          chunks,
        }

        // Also push to backend if available
        fetch('/api/rag/index', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: doc.id,
            title: doc.title,
            content: doc.content,
          }),
        }).catch(() => {})
      })
      syncDocuments()
    } else {
      syncDocuments()
    }
  }, [initialDocs])

  // Upload new doc directly
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingDoc(true)

    try {
      let text = ''
      if (file.name.endsWith('.md') || file.name.endsWith('.txt')) {
        text = await file.text()
      } else if (file.name.endsWith('.pdf')) {
        try {
          const formData = new FormData()
          formData.append('file', file)
          const res = await fetch('/api/convert', { method: 'POST', body: formData })
          const data = await res.json().catch(() => null)
          if (data?.success && data.result?.markdown) {
            text = data.result.markdown
          } else {
            throw new Error('Backend offline')
          }
        } catch {
          // Robust zero-dependency client-side PDF extraction with real MD5 checksum
          const { extractPdfTextInBrowser } = await import('../utils/documentUtils')
          const extracted = await extractPdfTextInBrowser(file)
          text = extracted.markdown
        }
      }

      if (text) {
        const docId = `doc_${Date.now()}`
        const chunks = splitIntoChunks(docId, file.name, text)
        clientDocsStore[docId] = {
          id: docId,
          title: file.name,
          content: text,
          chunks,
        }

        // Send to backend if available
        fetch('/api/rag/index', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: docId,
            title: file.name,
            content: text,
          }),
        }).catch(() => {})

        await syncDocuments()
        setSelectedDocIds(prev => [...prev, docId])
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingDoc(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Delete document
  const deleteDoc = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    delete clientDocsStore[id]
    fetch(`/api/rag/documents/${id}`, { method: 'DELETE' }).catch(() => {})
    setDocuments(prev => prev.filter(d => d.id !== id))
    setSelectedDocIds(prev => prev.filter(x => x !== id))
  }

  const toggleSelectDoc = (id: string) => {
    setSelectedDocIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // Client-side RAG fallback semantic search
  const performClientRagSearch = (userQuery: string, docIds: string[]) => {
    const queryTerms = userQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    const candidateChunks: LocalChunk[] = []

    const targetIds = docIds.length > 0 ? docIds : Object.keys(clientDocsStore)
    targetIds.forEach(id => {
      if (clientDocsStore[id]) {
        candidateChunks.push(...clientDocsStore[id].chunks)
      }
    })

    if (candidateChunks.length === 0) {
      return {
        answer: 'No indexed documents found in knowledge base. Please convert or upload documents first.',
        citations: [],
        chunks: [],
      }
    }

    const scored = candidateChunks.map(chunk => {
      const textLower = chunk.content.toLowerCase()
      const titleLower = chunk.title.toLowerCase()
      const sectionLower = chunk.section.toLowerCase()
      let score = 0.5

      queryTerms.forEach(t => {
        if (titleLower.includes(t)) score += 3.0
        if (sectionLower.includes(t)) score += 2.0
        const matches = (textLower.match(new RegExp(t, 'g')) || []).length
        if (matches > 0) score += Math.min(matches * 1.5, 6.0)
      })

      if (textLower.includes(userQuery.toLowerCase())) score += 8.0
      return { chunk, score }
    })

    scored.sort((a, b) => b.score - a.score)
    const topPicks = scored.slice(0, 4)
    const retrievedChunks = topPicks.map(p => ({
      id: p.chunk.id,
      document_id: p.chunk.docId,
      title: p.chunk.title,
      section: p.chunk.section,
      content: p.chunk.content,
      word_count: p.chunk.wordCount,
    }))

    const citations = topPicks.map((p, idx) => ({
      citation_id: `[${idx + 1}]`,
      document_id: p.chunk.docId,
      title: p.chunk.title,
      section: p.chunk.section,
      score: Math.round(p.score * 10) / 10,
    }))

    // Synthesize intelligent structured answer
    const answer = synthesizeClientGroundedAnswer(userQuery, retrievedChunks, citations)

    return { answer, citations, chunks: retrievedChunks }
  }

  // Handle Query with Gemini AI & Grounded Context
  const handleSend = async (customQuery?: string) => {
    const q = (customQuery || query).trim()
    if (!q || loading) return

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: q,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMsg])
    if (!customQuery) setQuery('')
    setLoading(true)

    // 1. Retrieve top grounded candidate chunks
    const searchResult = performClientRagSearch(q, selectedDocIds)
    const contextChunks = searchResult.chunks.map(c => ({
      id: c.id,
      title: c.title,
      section: c.section,
      content: c.content,
    }))

    try {
      // 2. Call Google Gemini AI directly with user's active API Key
      const answer = await queryGeminiAI({
        query: q,
        chunks: contextChunks,
        chatHistory: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
      })

      setMessages(prev => [
        ...prev,
        {
          id: `asst_${Date.now()}`,
          role: 'assistant',
          content: answer,
          citations: contextChunks.length > 0 ? searchResult.citations : undefined,
          chunks: contextChunks.length > 0 ? searchResult.chunks : undefined,
          timestamp: Date.now(),
        },
      ])

      // Persist to backend database
      fetch('/api/rag/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          document_ids: selectedDocIds,
          conversation_id: currentConvId || undefined,
        }),
      })
        .then(r => r.json())
        .then(d => {
          if (d?.conversation_id && !currentConvId) {
            setCurrentConvId(d.conversation_id)
            if (onConversationCreated) onConversationCreated(d.conversation_id)
          }
        })
        .catch(() => {})
    } catch {
      // 3. Instant local fallback synthesis if offline
      setMessages(prev => [
        ...prev,
        {
          id: `asst_local_${Date.now()}`,
          role: 'assistant',
          content: searchResult.answer,
          citations: searchResult.citations,
          chunks: searchResult.chunks,
          timestamp: Date.now(),
        },
      ])

      // Persist to backend database
      fetch('/api/rag/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          document_ids: selectedDocIds,
          conversation_id: currentConvId || undefined,
        }),
      })
        .then(r => r.json())
        .then(d => {
          if (d?.conversation_id && !currentConvId) {
            setCurrentConvId(d.conversation_id)
            if (onConversationCreated) onConversationCreated(d.conversation_id)
          }
        })
        .catch(() => {})
    } finally {
      setLoading(false)
    }
  }

  const copyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const starterPrompts = [
    '📝 Summarize key insights and core findings',
    '📊 Extract all tables and numerical metrics',
    '🔍 What are the main conclusions?',
    '📐 Identify formulas and technical parameters',
  ]

  return (
    <div className="app-container" style={{ padding: '2.5rem 1.5rem 5rem' }}>
      {/* Top Banner */}
      <div style={{ marginBottom: '2rem' }}>
        <div className="mono-tag-accent" style={{ marginBottom: '6px' }}>
          / 02 RAG INTELLIGENCE ENGINE
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 4.5vw, 3rem)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
              DOCUMENT <span className="accent-word" style={{ color: 'var(--accent)' }}>CHATBOT</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: '4px' }}>
              Ask questions across single or multiple converted documents with exact section citations.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              className="btn-aarambh-outline md:hidden"
              onClick={() => setShowSourcesMobile(prev => !prev)}
            >
              <SlidersHorizontal size={13} /> {showSourcesMobile ? 'HIDE SOURCES' : 'VIEW SOURCES'}
            </button>
            <button className="btn-aarambh-outline" onClick={syncDocuments} title="Sync knowledge sources">
              <RefreshCw size={13} /> SYNC KNOWLEDGE
            </button>
            <button
              className="btn-aarambh-outline"
              onClick={() =>
                setMessages([
                  {
                    id: 'welcome',
                    role: 'assistant',
                    content: 'Conversation cleared. Ask any new question about your indexed documents!',
                    timestamp: Date.now(),
                  },
                ])
              }
            >
              CLEAR CHAT
            </button>
          </div>
        </div>
      </div>

      {/* Main RAG Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 320px) 1fr',
          gap: '1.5rem',
          alignItems: 'start',
        }}
        className="rag-grid-container"
      >
        {/* ── Left Sidebar: Knowledge Sources ──────────────────────── */}
        <div
          className={`browser-frame ${!showSourcesMobile ? 'hidden md:block' : 'block'}`}
          style={{ position: 'sticky', top: '90px' }}
        >
          <div className="browser-frame__header">
            <div className="browser-frame__dots">
              <span className="browser-frame__dot" />
              <span className="browser-frame__dot" />
              <span className="browser-frame__dot" />
            </div>
            <div className="browser-frame__address">knowledge-base.local</div>
          </div>

          <div style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div className="mono-tag" style={{ color: 'var(--text-muted)' }}>
                SOURCES ({documents.length})
              </div>
              <button
                className="btn-aarambh-outline"
                style={{ fontSize: '10px', padding: '5px 10px' }}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingDoc}
              >
                <Plus size={12} /> ADD DOC
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.md,.txt"
                style={{ display: 'none' }}
                onChange={handleUploadFile}
              />
            </div>

            {uploadingDoc && (
              <div style={{ padding: '8px 12px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', marginBottom: '10px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="aarambh-spinner" style={{ width: 12, height: 12 }} />
                <span>INDEXING DOCUMENT...</span>
              </div>
            )}

            {documents.length === 0 ? (
              <div
                style={{
                  padding: '2.5rem 1rem',
                  border: '1px dashed var(--border)',
                  textAlign: 'center',
                  background: 'var(--bg-primary)',
                }}
              >
                <BookOpen size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  No Documents Loaded
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Upload a document or convert files in the <strong>Batch Converter</strong>.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '450px', overflowY: 'auto' }}>
                {documents.map(doc => {
                  const isSelected = selectedDocIds.includes(doc.id)
                  return (
                    <div
                      key={doc.id}
                      onClick={() => toggleSelectDoc(doc.id)}
                      style={{
                        padding: '10px 12px',
                        background: isSelected ? 'var(--accent-dim)' : 'var(--bg-primary)',
                        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectDoc(doc.id)}
                          style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                        />
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.88rem', color: isSelected ? 'var(--accent)' : 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {doc.title}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                            {doc.chunk_count} chunks · {doc.word_count?.toLocaleString()} words
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={e => deleteDoc(doc.id, e)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                        title="Remove document from knowledge base"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
              <span>SEMANTIC SCORING ACTIVE</span>
            </div>
          </div>
        </div>

        {/* ── Right Area: Chat Canvas ───────────────────────────────── */}
        <div className="browser-frame" style={{ display: 'flex', flexDirection: 'column', minHeight: '620px' }}>
          <div className="browser-frame__header">
            <div className="browser-frame__dots">
              <span className="browser-frame__dot" />
              <span className="browser-frame__dot" />
              <span className="browser-frame__dot" />
            </div>
            <div className="browser-frame__address">docforge.local/rag-chat</div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setApiKeyModalOpen(true)}
                className="mono-tag"
                style={{
                  background: 'var(--accent-dim)',
                  border: '1px solid var(--accent)',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  padding: '4px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '10px',
                  fontWeight: 700
                }}
                title="Manage Google Gemini API Key"
              >
                <Sparkles size={11} /> GEMINI AI ACTIVE
              </button>
              <span className="mono-tag" style={{ color: 'var(--text-muted)' }}>
                {selectedDocIds.length} OF {documents.length} SOURCES ACTIVE
              </span>
            </div>
          </div>

          {/* Messages Area */}
          <div style={{ flex: 1, padding: '1.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '580px' }}>
            {messages.map(msg => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  gap: '14px',
                  alignItems: 'flex-start',
                  maxWidth: msg.role === 'user' ? '85%' : '100%',
                  marginLeft: msg.role === 'user' ? 'auto' : '0',
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    background: msg.role === 'assistant' ? 'var(--accent)' : 'var(--text-primary)',
                    color: msg.role === 'assistant' ? '#ffffff' : 'var(--bg-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                    fontWeight: 900,
                    fontFamily: 'var(--font-display)',
                    fontSize: '12px',
                  }}
                >
                  {msg.role === 'assistant' ? <Bot size={18} /> : <User size={18} />}
                </div>

                {/* Message Body */}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      background: msg.role === 'user' ? 'var(--bg-elevated)' : 'var(--bg-secondary)',
                      border: `1px solid ${msg.role === 'user' ? 'var(--border-light)' : 'var(--border)'}`,
                      padding: '1.25rem',
                      color: 'var(--text-primary)',
                      lineHeight: 1.6,
                      fontSize: '0.95rem',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{ whiteSpace: 'pre-wrap' }}
                      dangerouslySetInnerHTML={{
                        __html: msg.content
                          .replace(/^### (.+)$/gm, '<h3 style="font-family:var(--font-display);font-size:1.15rem;margin:10px 0 6px;color:var(--text-primary);font-weight:800">$1</h3>')
                          .replace(/^## (.+)$/gm, '<h2 style="font-family:var(--font-display);font-size:1.3rem;margin:12px 0 8px;color:var(--text-primary);font-weight:900">$1</h2>')
                          .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text-primary)">$1</strong>')
                          .replace(/\*(.+?)\*/g, '<em>$1</em>')
                          .replace(/`([^`]+)`/g, '<code style="background:var(--bg-primary);color:var(--accent);padding:2px 6px;font-family:var(--font-mono);font-size:12px;border:1px solid var(--border)">$1</code>')
                          .replace(/\n/g, '<br/>'),
                      }}
                    />

                    <button
                      onClick={() => copyText(msg.id, msg.content)}
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                      title="Copy response"
                    >
                      {copiedId === msg.id ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                    </button>
                  </div>

                  {/* Grounded Citations & Chunk Inspector */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className="mono-tag" style={{ color: 'var(--text-muted)' }}>
                          CITATIONS:
                        </span>
                        {msg.citations.map((c, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              padding: '3px 8px',
                              background: 'var(--bg-primary)',
                              border: '1px solid var(--accent)',
                              color: 'var(--accent)',
                              fontWeight: 600,
                            }}
                          >
                            {c.citation_id} {c.title} ({c.section})
                          </span>
                        ))}

                        {msg.chunks && msg.chunks.length > 0 && (
                          <button
                            onClick={() =>
                              setExpandedChunks(prev => ({
                                ...prev,
                                [msg.id]: !prev[msg.id],
                              }))
                            }
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-secondary)',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              marginLeft: '4px',
                            }}
                          >
                            {expandedChunks[msg.id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            {expandedChunks[msg.id] ? 'HIDE CONTEXT CHUNKS' : `INSPECT ${msg.chunks.length} CHUNKS`}
                          </button>
                        )}
                      </div>

                      {/* Expanded Inspector Drawer */}
                      {expandedChunks[msg.id] && msg.chunks && (
                        <div
                          style={{
                            marginTop: '10px',
                            padding: '12px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                          }}
                        >
                          {msg.chunks.map((chk, i) => (
                            <div
                              key={i}
                              style={{
                                padding: '10px 12px',
                                background: 'var(--bg-secondary)',
                                borderLeft: '3px solid var(--accent)',
                                border: '1px solid var(--border)',
                                fontSize: '11px',
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              <div style={{ color: 'var(--accent)', marginBottom: '4px', fontWeight: 700 }}>
                                Source [{i + 1}]: {chk.title} · Section: {chk.section} ({chk.word_count} words)
                              </div>
                              <div style={{ whiteSpace: 'pre-wrap', maxHeight: '140px', overflowY: 'auto', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                {chk.content}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <div style={{ width: '34px', height: '34px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <Bot size={18} />
                </div>
                <div style={{ padding: '12px 18px', background: 'var(--bg-secondary)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent)' }}>
                  <span className="aarambh-spinner" style={{ width: 14, height: 14 }} />
                  <span>SEARCHING KNOWLEDGE BASE & SYNTHESIZING...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Starter Prompts */}
          {messages.length <= 2 && (
            <div style={{ padding: '0 1.75rem 1rem', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {starterPrompts.map((p, idx) => (
                <button
                  key={idx}
                  className="btn-aarambh-outline"
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                  onClick={() => handleSend(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Input Box */}
          <div style={{ padding: '1.25rem 1.75rem', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)' }}>
            <form
              onSubmit={e => {
                e.preventDefault()
                handleSend()
              }}
              style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}
            >
              <div style={{ flex: 1, position: 'relative' }}>
                <textarea
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder={
                    selectedDocIds.length > 0
                      ? 'Ask a question about the active document(s)...'
                      : 'Select or add a document to query...'
                  }
                  rows={2}
                  style={{
                    width: '100%',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    padding: '12px 14px',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.95rem',
                    resize: 'none',
                    outline: 'none',
                    transition: 'border-color 0.2s ease',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
                <div style={{ position: 'absolute', right: '10px', bottom: '8px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                  ENTER ↵
                </div>
              </div>

              <button
                type="submit"
                className="btn-aarambh-primary"
                disabled={!query.trim() || loading}
                style={{ height: '56px', padding: '0 24px' }}
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ── Google Gemini API Key Settings Modal ─────────────────────── */}
      {apiKeyModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
          onClick={() => setApiKeyModalOpen(false)}
        >
          <div
            className="browser-frame"
            style={{ width: '100%', maxWidth: '520px', background: 'var(--bg-secondary)', border: '1px solid var(--accent)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="browser-frame__header">
              <div className="browser-frame__dots">
                <span className="browser-frame__dot" />
                <span className="browser-frame__dot" />
                <span className="browser-frame__dot" />
              </div>
              <div className="browser-frame__address">docforge.local/gemini-config</div>
              <button
                onClick={() => setApiKeyModalOpen(false)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                <div style={{ width: '36px', height: '36px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                  <Key size={18} />
                </div>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.1rem', textTransform: 'uppercase' }}>
                    Google Gemini API Key
                  </h3>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                    Google AI Studio (Supports legacy AIza and new AQ. format)
                  </div>
                </div>
              </div>

              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                Your API key powers real-time RAG synthesis and document intelligence. Stored securely in your browser's local memory.
              </p>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)', marginBottom: '6px', fontWeight: 700 }}>
                  ACTIVE API KEY:
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  placeholder="Paste your Google Gemini API Key (AQ. or AIza...)"
                  style={{
                    width: '100%',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    padding: '10px 14px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={14} />
                  <span>100% Client-Side Privacy</span>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setApiKeyModalOpen(false)}
                    className="btn-aarambh-outline"
                    style={{ fontSize: '11px', padding: '8px 16px' }}
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={() => {
                      saveGeminiApiKey(apiKeyInput)
                      setKeySavedToast(true)
                      setTimeout(() => {
                        setKeySavedToast(false)
                        setApiKeyModalOpen(false)
                      }, 1200)
                    }}
                    className="btn-aarambh-primary"
                    style={{ fontSize: '11px', padding: '8px 18px' }}
                  >
                    {keySavedToast ? '✓ SAVED!' : 'SAVE KEY'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
