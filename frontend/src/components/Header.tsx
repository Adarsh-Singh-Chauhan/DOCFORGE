import { useState, useEffect } from 'react'
import { Moon, Sun, X, Menu, Settings, BarChart2, FileText, MessageSquare, LayoutDashboard, Layers } from 'lucide-react'

interface Props {
  health: { status: string; modelsLoaded: boolean; device: string } | null
  activeTab: string
  onTabChange: (tab: string) => void
  onOpenSettings?: () => void
  ragDocCount?: number
}

export default function Header({ health, activeTab, onTabChange, onOpenSettings, ragDocCount = 0 }: Props) {
  const [isDark, setIsDark] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('docforge-theme')
    if (saved === 'dark') {
      setIsDark(true)
      document.body.classList.add('dark')
    } else {
      setIsDark(false)
      document.body.classList.remove('dark')
    }
  }, [])

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev
      if (next) {
        document.body.classList.add('dark')
        localStorage.setItem('docforge-theme', 'dark')
      } else {
        document.body.classList.remove('dark')
        localStorage.setItem('docforge-theme', 'light')
      }
      return next
    })
  }

  const ok = health?.status === 'ok' && health.modelsLoaded
  const label = ok ? 'SURYA VLM ACTIVE' : 'CONNECTING...'

  const handleNavClick = (tab: string) => {
    onTabChange(tab)
    setMobileMenuOpen(false)
  }

  return (
    <header className="aarambh-header">
      <div className="app-container">
        <div className="aarambh-header__inner">
          {/* Logo Badge */}
          <a
            href="#/dashboard"
            className="aarambh-logo"
            onClick={e => {
              e.preventDefault()
              handleNavClick('dashboard')
            }}
          >
            <div className="aarambh-logo__badge">
              DF
            </div>
            <span className="aarambh-logo__text">DOCFORGE</span>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="header-nav-links hidden lg:flex">
            <button
              onClick={() => handleNavClick('dashboard')}
              className={`header-nav-link ${activeTab === 'dashboard' ? 'header-nav-link--active' : ''}`}
            >
              Dashboard
            </button>

            <button
              onClick={() => handleNavClick('converter')}
              className={`header-nav-link ${activeTab === 'converter' ? 'header-nav-link--active' : ''}`}
            >
              Batch Converter
            </button>

            <button
              onClick={() => handleNavClick('ocr-history')}
              className={`header-nav-link ${activeTab === 'ocr-history' || activeTab === 'ocr-detail' ? 'header-nav-link--active' : ''}`}
            >
              OCR History
            </button>

            <button
              onClick={() => handleNavClick('chatbot')}
              className={`header-nav-link ${activeTab === 'chatbot' ? 'header-nav-link--active' : ''}`}
            >
              RAG Chatbot
              {ragDocCount > 0 && (
                <span
                  style={{
                    marginLeft: '6px',
                    background: 'var(--accent)',
                    color: '#ffffff',
                    fontSize: '9px',
                    fontWeight: 800,
                    padding: '1px 5px',
                    borderRadius: '3px',
                  }}
                >
                  {ragDocCount}
                </span>
              )}
            </button>

            <button
              onClick={() => handleNavClick('chat-history')}
              className={`header-nav-link ${activeTab === 'chat-history' ? 'header-nav-link--active' : ''}`}
            >
              Chat History
            </button>

            <button
              onClick={() => handleNavClick('analytics')}
              className={`header-nav-link ${activeTab === 'analytics' ? 'header-nav-link--active' : ''}`}
            >
              API Analytics
            </button>
          </nav>

          {/* Right Header Actions */}
          <div className="aarambh-header__actions">
            {/* Status Pill */}
            <div className="aarambh-status-pill hidden sm:inline-flex" title="Inference Server Status">
              <span
                className={`aarambh-status-dot ${
                  ok || !health
                    ? 'aarambh-status-dot--ready'
                    : 'aarambh-status-dot--loading'
                }`}
              />
              <span>{label}</span>
            </div>

            {/* Configure Engine Modal Button */}
            {onOpenSettings && (
              <button
                className="theme-toggle-btn"
                onClick={onOpenSettings}
                title="Configure Document Intelligence Engines"
                aria-label="Engine Settings"
              >
                <Settings size={16} />
              </button>
            )}

            {/* Theme Toggle Button (Moon / Sun) */}
            <button
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Mobile / Compact Menu Button */}
            <button
              className="theme-toggle-btn lg:hidden"
              onClick={() => setMobileMenuOpen(prev => !prev)}
              aria-label="Toggle navigation menu"
              title="Menu"
            >
              {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div
            style={{
              padding: '1.25rem 0',
              borderTop: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
            className="lg:hidden"
          >
            <button
              onClick={() => handleNavClick('dashboard')}
              className={`aarambh-nav-link ${activeTab === 'dashboard' ? 'aarambh-nav-link--active' : ''}`}
              style={{ textAlign: 'left', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <LayoutDashboard size={14} /> <span>01/</span> Main Dashboard
            </button>

            <button
              onClick={() => handleNavClick('converter')}
              className={`aarambh-nav-link ${activeTab === 'converter' ? 'aarambh-nav-link--active' : ''}`}
              style={{ textAlign: 'left', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Layers size={14} /> <span>02/</span> Batch Converter
            </button>

            <button
              onClick={() => handleNavClick('ocr-history')}
              className={`aarambh-nav-link ${activeTab === 'ocr-history' || activeTab === 'ocr-detail' ? 'aarambh-nav-link--active' : ''}`}
              style={{ textAlign: 'left', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <FileText size={14} /> <span>03/</span> OCR History
            </button>

            <button
              onClick={() => handleNavClick('chatbot')}
              className={`aarambh-nav-link ${activeTab === 'chatbot' ? 'aarambh-nav-link--active' : ''}`}
              style={{ textAlign: 'left', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={14} /> <span>04/</span> RAG Chatbot
              </div>
              {ragDocCount > 0 && (
                <span style={{ background: 'var(--accent)', color: '#fff', fontSize: '10px', padding: '2px 6px' }}>
                  {ragDocCount} DOCS
                </span>
              )}
            </button>

            <button
              onClick={() => handleNavClick('chat-history')}
              className={`aarambh-nav-link ${activeTab === 'chat-history' ? 'aarambh-nav-link--active' : ''}`}
              style={{ textAlign: 'left', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <MessageSquare size={14} /> <span>05/</span> Chat History
            </button>

            <button
              onClick={() => handleNavClick('analytics')}
              className={`aarambh-nav-link ${activeTab === 'analytics' ? 'aarambh-nav-link--active' : ''}`}
              style={{ textAlign: 'left', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <BarChart2 size={14} /> <span>06/</span> API Analytics
            </button>

            {onOpenSettings && (
              <button
                onClick={() => { setMobileMenuOpen(false); onOpenSettings(); }}
                className="aarambh-nav-link"
                style={{ textAlign: 'left', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)' }}
              >
                <Settings size={14} /> <span>07/</span> Engine Configuration
              </button>
            )}

            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
              <span className="mono-tag">RUNTIME:</span>
              <div className="aarambh-status-pill" style={{ padding: '4px 8px', fontSize: '10px' }}>
                <span className={`aarambh-status-dot ${ok ? 'aarambh-status-dot--ready' : ''}`} />
                <span>{label}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
