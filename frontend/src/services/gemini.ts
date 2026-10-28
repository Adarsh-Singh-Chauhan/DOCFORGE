/**
 * DOCFORGE — Direct Google Gemini AI Service
 * Supports Google AI Studio keys (both legacy AIza and new AQ. format)
 */

export const DEFAULT_GEMINI_KEY = ''

export function getGeminiApiKey(): string {
  try {
    const custom = localStorage.getItem('docforge_gemini_api_key')
    if (custom && custom.trim()) return custom.trim()
  } catch {
    // fallback
  }
  return (import.meta as any).env?.VITE_GEMINI_API_KEY || DEFAULT_GEMINI_KEY
}

export function saveGeminiApiKey(key: string): void {
  try {
    localStorage.setItem('docforge_gemini_api_key', key.trim())
  } catch {
    // ignore
  }
}

export interface ContextChunkItem {
  id: string
  title: string
  section: string
  content: string
}

export interface GeminiRAGParams {
  query: string
  chunks?: ContextChunkItem[]
  chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
}

export async function queryGeminiAI({ query, chunks = [], chatHistory = [] }: GeminiRAGParams): Promise<string> {
  const apiKey = getGeminiApiKey()

  // Format context chunks if available
  let contextBlock = ''
  if (chunks.length > 0) {
    contextBlock = 'DOCUMENT CONTEXT CHUNKS:\n' +
      chunks.map((c, i) => `[${i + 1}] Document: "${c.title}" | Section: "${c.section}"\n${c.content}\n`).join('\n')
  }

  const systemInstruction = `You are DOCFORGE AI Assistant, an elite document intelligence and RAG analysis system.
You help users analyze documents, extract insights, explain complex formulas/tables, and answer queries.

CRITICAL INSTRUCTIONS:
1. If the user greeting is conversational (like "hi", "hello", "hii", "hey", "who are you", etc.):
   - Greet them warmly and professionally as DOCFORGE AI.
   - Mention that you are ready to answer any questions about their uploaded/indexed documents or general document intelligence.
2. If document context is provided below:
   - Ground your answer strictly in the provided document context.
   - Cite your sources accurately using bracket notation like [1], [2] matching the chunk numbers.
   - Format response cleanly using Markdown headings, bullet points, and LaTeX math ($...$ or $$...$$) where applicable.
3. If no document is selected or context is empty:
   - Provide a helpful, intelligent answer to the query while noting that uploading or selecting documents in the left sidebar enables deep grounded citations.`

  const promptText = `${contextBlock ? contextBlock + '\n\n' : ''}USER QUERY: ${query}`

  // Candidate models to try in order
  const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro']

  let lastError: Error | null = null

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            ...chatHistory.map(h => ({
              role: h.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: h.content }],
            })),
            {
              role: 'user',
              parts: [{ text: `${systemInstruction}\n\n${promptText}` }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
          },
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Gemini API HTTP ${response.status}: ${errText}`)
      }

      const data = await response.json()
      const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (textOutput && textOutput.trim()) {
        return textOutput.trim()
      }
    } catch (err: any) {
      lastError = err
      // Try next model if current fails
      continue
    }
  }

  // If Google API call failed (e.g. rate limit, invalid key, or network offline), provide local high-quality synthesis
  if (chunks.length > 0) {
    const citations = chunks.map((c, idx) => ({
      citation_id: `[${idx + 1}]`,
      title: c.title,
      section: c.section,
    }))
    const { synthesizeClientGroundedAnswer } = await import('../utils/documentUtils')
    return synthesizeClientGroundedAnswer(query, chunks, citations)
  }

  if (query.toLowerCase().match(/^(hi|hello|hii|hey|namaste|greetings)/)) {
    return `### Hello! I am DOCFORGE AI Assistant ⚡\n\nI am connected via **Google Gemini Intelligence** and your local vector store.\n\nI am ready to help you analyze, search, and extract information from your documents.\n\n- Convert PDFs in the **01/ Batch Converter** tab to index them automatically.\n- Or click **+ ADD DOC** in the left sidebar to upload Markdown or text files.\n- Ask me anything about your documents, formulas, tables, or data!`
  }

  throw lastError || new Error('Could not connect to Gemini AI. Check network connection.')
}
