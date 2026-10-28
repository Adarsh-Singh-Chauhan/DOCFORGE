export interface ConvertResult {
  id: string
  fileName: string
  fileType: string
  originalSize: number
  pageCount: number | null
  durationMs: number
  conversionDurationMs: number
  tokenCountingDurationMs: number
  markdown: string
  markdownCharacters: number
  markdownWords: number
  baselineCharacters: number | null
  baselineWords: number | null
  baselineAvailable: boolean
  baselineStatus: 'complete' | 'incomplete' | 'unavailable'
  baselineReason: string
  extractionCoveragePercent: number
  extractedTextPageCount: number
  imagePageCount: number
  originalPdfCount: TokenCountResult
  markdownCount: TokenCountResult
  originalPdfInputTokens: number | null
  markdownInputTokens: number | null
  tokensSaved: number | null
  reductionPercent: number | null
  comparisonComparable: boolean
  comparisonReason: string | null
  tokenCountingStatus: string
  tokenCountingModel: string
  tokenCountingMethod: string
  mode: string
  forceOcr: boolean
  success: boolean
  engine?: string
  engineName?: string
  engineType?: 'local' | 'cloud'
  tablesDetected?: number
  equationsDetected?: number
  figuresDetected?: number
  fileMd5?: string
  fileSha256?: string
  markdownMd5?: string
  error?: string | null
}

export interface DocumentEngine {
  id: string
  name: string
  type: 'local' | 'cloud'
  description: string
  configured: boolean
  is_default?: boolean
  requires_consent?: boolean
  config_keys?: string[]
  icon?: string
}

export interface TokenCountResult {
  status: string
  inputTokens: number | null
  model: string
  method: string
  timestamp: string | null
  error: string | null
  cached: boolean
}

export interface BatchFileItem {
  id: string
  file: File
  status: 'queued' | 'converting' | 'completed' | 'error'
  elapsed?: number
  result?: ConvertResult
  error?: string
}

export interface RagDocument {
  id: string
  title: string
  chunk_count: number
  word_count: number
  indexed_at?: number
  metadata?: Record<string, any>
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Array<{
    citation_id: string
    document_id: string
    title: string
    section: string
    score: number
  }>
  chunks?: Array<{
    id: string
    document_id: string
    title: string
    section: string
    content: string
    word_count: number
  }>
  timestamp: number
}

export interface OcrHistoryRecord {
  id: string
  file_name: string
  file_type: string
  original_size: number
  page_count: number | null
  duration_ms: number
  conversion_duration_ms?: number
  engine: string
  engine_name: string
  engine_type: 'local' | 'cloud'
  status: 'completed' | 'failed' | 'processing' | 'queued' | 'cancelled'
  markdown?: string
  markdown_chars?: number
  markdown_words?: number
  tokens_saved?: number
  reduction_percent?: number
  tables_detected?: number
  equations_detected?: number
  figures_detected?: number
  file_md5?: string
  file_sha256?: string
  markdown_md5?: string
  error?: string | null
  cost_estimated?: number
  created_at: number
  completed_at?: number
}

export interface ChatConversation {
  id: string
  title: string
  document_ids: string[]
  model: string
  status: string
  message_count: number
  created_at: number
  updated_at: number
  messages?: Array<{
    id: string
    conversation_id: string
    sender: 'user' | 'assistant'
    text: string
    citations?: any[]
    duration_ms?: number
    tokens?: number
    created_at: number
  }>
}

export interface DashboardStats {
  summary: {
    total_jobs: number
    jobs_today: number
    successful_jobs: number
    failed_jobs: number
    overall_success_rate: number
    total_pages: number
    total_tokens_saved: number
    avg_ocr_duration_ms: number
    total_conversations: number
    total_chat_messages: number
    chats_today: number
    avg_chat_response_ms: number
    total_cost_estimated: number
  }
  providers: Array<{
    provider: string
    name: string
    type: 'local' | 'cloud'
    total_requests: number
    successful_requests: number
    failed_requests: number
    success_rate: number
    avg_duration_ms: number
    total_pages: number
    total_cost: number
  }>
  timeline: Array<{
    date: string
    jobs: number
    success: number
    failed: number
    avg_duration_ms: number
  }>
  recent_jobs: OcrHistoryRecord[]
  recent_chats: ChatConversation[]
}

export interface EngineAnalytics {
  engines: Array<{
    provider: string
    type: 'local' | 'cloud'
    request_count: number
    success_count: number
    fail_count: number
    success_rate: number
    avg_duration_ms: number
    min_duration_ms: number
    max_duration_ms: number
    total_pages: number
    avg_duration_per_page_ms: number
    total_tokens: number
    total_cost: number
  }>
  local_requests: number
  cloud_requests: number
  air_gapped_ratio: number
}
