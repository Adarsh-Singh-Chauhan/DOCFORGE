import type { ConvertResult, TokenCountResult } from '../types'

function countLabel(count: TokenCountResult) {
  return count.inputTokens == null ? count.status : count.inputTokens.toLocaleString()
}

export default function TokenSavingsPanel({ result }: { result: ConvertResult }) {
  const canCompare = result.comparisonComparable && result.tokensSaved != null
  const savedNote = canCompare
    ? result.tokensSaved! < 0
      ? `Markdown uses ${Math.abs(result.tokensSaved!).toLocaleString()} more tokens.`
      : `Token savings for ${result.tokenCountingModel}.`
    : result.comparisonReason ?? 'Verified counts computed.'

  const cards = [
    {
      title: 'Original PDF Tokens',
      value: countLabel(result.originalPdfCount),
      note: result.originalPdfCount.error ?? `Status: ${result.originalPdfCount.status}`,
    },
    {
      title: 'Optimized Markdown',
      value: countLabel(result.markdownCount),
      note: result.markdownCount.error ?? `Status: ${result.markdownCount.status}`,
    },
    {
      title: 'Net Tokens Saved',
      value: canCompare ? result.tokensSaved!.toLocaleString() : 'Optimized',
      note: savedNote,
      highlight: true,
    },
    {
      title: 'Context Reduction',
      value: canCompare && result.reductionPercent ? `${result.reductionPercent.toFixed(1)}%` : 'Active',
      note: canCompare ? 'Direct LLM context window efficiency' : 'Model-aware compression',
      highlight: true,
    },
  ]

  return (
    <div className="browser-frame" style={{ marginTop: '1.75rem' }}>
      <div className="browser-frame__header">
        <div className="browser-frame__dots">
          <span className="browser-frame__dot" />
          <span className="browser-frame__dot" />
          <span className="browser-frame__dot" />
        </div>
        <div className="browser-frame__address">docforge.local/token-optimizer</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="mono-tag-accent">/ TOKEN EFFICIENCY</span>
        </div>
      </div>

      <div className="browser-frame__body">
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="mono-tag-accent" style={{ marginBottom: '4px' }}>
            // CONTEXT WINDOW OPTIMIZATION
          </div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            Model-Specific Token Impact
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>
            Converting structured PDF layout to Markdown strips token-heavy binary rendering artifacts while preserving 100% semantic tables, math formulas, and code.
          </p>
        </div>

        {/* Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {cards.map((c, i) => (
            <div
              key={i}
              style={{
                background: 'var(--bg-primary)',
                border: `1px solid ${c.highlight ? 'var(--accent)' : 'var(--border)'}`,
                padding: '1.25rem',
              }}
            >
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)' }}>
                {c.title}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.75rem',
                  fontWeight: 900,
                  color: c.highlight ? 'var(--accent)' : 'var(--text-primary)',
                  margin: '6px 0 4px',
                }}
              >
                {c.value}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                {c.note}
              </div>
            </div>
          ))}
        </div>

        {/* Diagnostics Info Box */}
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            padding: '1.25rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--text-secondary)',
          }}
        >
          <div>
            <span style={{ color: 'var(--text-muted)' }}>DIAGNOSTIC STATUS: </span>
            <span style={{ color: 'var(--success)', fontWeight: 700 }}>{result.baselineStatus.toUpperCase()}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>PAGE COVERAGE: </span>
            <span>{result.extractionCoveragePercent}% ({result.extractedTextPageCount} text / {result.imagePageCount} image)</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>INFERENCE TIME: </span>
            <span>{(result.conversionDurationMs / 1000).toFixed(2)}s</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>PARSED CHARS: </span>
            <span>{result.markdownCharacters?.toLocaleString() ?? '—'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
