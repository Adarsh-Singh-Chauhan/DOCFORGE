import { useState, useEffect } from 'react'
import Header from './components/Header'
import DashboardPage from './pages/DashboardPage'
import ConverterPage from './pages/ConverterPage'
import OcrHistoryPage from './pages/OcrHistoryPage'
import OcrJobDetailPage from './pages/OcrJobDetailPage'
import RagChatbotPage from './pages/RagChatbotPage'
import ChatHistoryPage from './pages/ChatHistoryPage'
import AnalyticsPage from './pages/AnalyticsPage'
import EngineConfigModal from './components/EngineConfigModal'

export default function App() {
  const [health, setHealth] = useState<{ status: string; modelsLoaded: boolean; device: string } | null>(null)
  const [activeTab, setActiveTab] = useState<string>('dashboard')
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [isEngineModalOpen, setIsEngineModalOpen] = useState(false)
  const [ragDocs, setRagDocs] = useState<Array<{ id: string; title: string; content: string }>>([])
  const [ragDocCount, setRagDocCount] = useState(0)

  // ── URL Hash Synchronization for Browser Back/Forward & Direct Tabs ─────
  const parseHash = () => {
    const hash = window.location.hash.replace(/^#\/?/, '')
    if (!hash || hash === 'dashboard') {
      setActiveTab('dashboard')
      setActiveJobId(null)
      setActiveChatId(null)
    } else if (hash === 'converter') {
      setActiveTab('converter')
      setActiveJobId(null)
      setActiveChatId(null)
    } else if (hash === 'ocr-history') {
      setActiveTab('ocr-history')
      setActiveJobId(null)
      setActiveChatId(null)
    } else if (hash.startsWith('ocr-history/')) {
      const id = hash.replace('ocr-history/', '')
      setActiveTab('ocr-detail')
      setActiveJobId(id)
    } else if (hash.startsWith('chatbot/')) {
      const id = hash.replace('chatbot/', '')
      setActiveTab('chatbot')
      setActiveChatId(id)
    } else if (hash === 'chatbot') {
      setActiveTab('chatbot')
    } else if (hash === 'chat-history') {
      setActiveTab('chat-history')
      setActiveJobId(null)
      setActiveChatId(null)
    } else if (hash === 'analytics') {
      setActiveTab('analytics')
      setActiveJobId(null)
      setActiveChatId(null)
    }
  }

  useEffect(() => {
    parseHash()
    const onHashChange = () => parseHash()
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Health and RAG Document Polling
  useEffect(() => {
    const check = () => {
      fetch('/api/health')
        .then(r => r.json())
        .then(d => setHealth(d))
        .catch(() => setHealth(null))

      fetch('/api/rag/documents')
        .then(r => r.json())
        .then(d => {
          if (d.success && Array.isArray(d.documents)) {
            setRagDocCount(d.documents.length)
          }
        })
        .catch(() => {})
    }
    check()
    const id = setInterval(check, 15_000)
    return () => clearInterval(id)
  }, [])

  const navigateTo = (tab: string, param?: string) => {
    if (tab === 'ocr-detail' && param) {
      setActiveTab('ocr-detail')
      setActiveJobId(param)
      window.location.hash = `#/ocr-history/${param}`
    } else if (tab === 'chatbot') {
      setActiveTab('chatbot')
      if (param) {
        setActiveChatId(param)
        window.location.hash = `#/chatbot/${param}`
      } else {
        window.location.hash = '#/chatbot'
      }
    } else {
      setActiveTab(tab)
      setActiveJobId(null)
      setActiveChatId(null)
      window.location.hash = `#/${tab}`
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleOpenRagChatbot = (doc?: { id: string; title: string; content: string }) => {
    if (doc) {
      setRagDocs(prev => [...prev.filter(d => d.id !== doc.id), doc])
      setRagDocCount(prev => prev + 1)
    }
    navigateTo('chatbot')
  }

  return (
    <div className="app-shell">
      <Header
        health={health}
        activeTab={activeTab}
        onTabChange={navigateTo}
        onOpenSettings={() => setIsEngineModalOpen(true)}
        ragDocCount={ragDocCount}
      />

      {/* Dynamic Workspace Rendering */}
      {activeTab === 'dashboard' && (
        <DashboardPage
          onNavigate={navigateTo}
          onOpenSettings={() => setIsEngineModalOpen(true)}
        />
      )}

      {activeTab === 'converter' && (
        <ConverterPage onOpenRagChatbot={handleOpenRagChatbot} />
      )}

      {activeTab === 'ocr-history' && (
        <OcrHistoryPage
          onNavigate={navigateTo}
          onOpenRagChatbot={handleOpenRagChatbot}
        />
      )}

      {activeTab === 'ocr-detail' && activeJobId && (
        <OcrJobDetailPage
          jobId={activeJobId}
          onBack={() => navigateTo('ocr-history')}
          onOpenRagChatbot={handleOpenRagChatbot}
        />
      )}

      {activeTab === 'chatbot' && (
        <RagChatbotPage
          initialDocs={ragDocs}
          activeConversationId={activeChatId}
          onConversationCreated={(convId) => setActiveChatId(convId)}
        />
      )}

      {activeTab === 'chat-history' && (
        <ChatHistoryPage onNavigate={navigateTo} />
      )}

      {activeTab === 'analytics' && (
        <AnalyticsPage
          onOpenSettings={() => setIsEngineModalOpen(true)}
          onNavigate={navigateTo}
        />
      )}

      {/* Global Engine Configuration Modal */}
      <EngineConfigModal
        isOpen={isEngineModalOpen}
        onClose={() => setIsEngineModalOpen(false)}
      />
    </div>
  )
}
