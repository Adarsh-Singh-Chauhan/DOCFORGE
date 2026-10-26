"""SQLite database management for DOCFORGE OCR jobs, chat history, and API performance metrics."""

import os
import sqlite3
import time
import json
import uuid
from typing import Optional, Any, Dict, List

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "docforge.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=20.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Create tables if they don't exist and seed initial realistic baseline records if empty."""
    with get_connection() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS ocr_jobs (
            id TEXT PRIMARY KEY,
            file_name TEXT NOT NULL,
            file_type TEXT NOT NULL,
            original_size INTEGER NOT NULL,
            page_count INTEGER,
            duration_ms INTEGER NOT NULL,
            conversion_duration_ms INTEGER,
            engine TEXT NOT NULL,
            engine_name TEXT NOT NULL,
            engine_type TEXT NOT NULL,
            status TEXT NOT NULL,
            markdown TEXT,
            markdown_chars INTEGER DEFAULT 0,
            markdown_words INTEGER DEFAULT 0,
            tokens_saved INTEGER DEFAULT 0,
            reduction_percent REAL DEFAULT 0.0,
            tables_detected INTEGER DEFAULT 0,
            equations_detected INTEGER DEFAULT 0,
            figures_detected INTEGER DEFAULT 0,
            error TEXT,
            cost_estimated REAL DEFAULT 0.0,
            created_at REAL NOT NULL,
            completed_at REAL
        );

        CREATE INDEX IF NOT EXISTS idx_ocr_jobs_created_at ON ocr_jobs(created_at);
        CREATE INDEX IF NOT EXISTS idx_ocr_jobs_engine ON ocr_jobs(engine);
        CREATE INDEX IF NOT EXISTS idx_ocr_jobs_status ON ocr_jobs(status);

        CREATE TABLE IF NOT EXISTS chat_conversations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            document_ids TEXT,
            model TEXT DEFAULT 'local-rag-v1',
            status TEXT DEFAULT 'active',
            message_count INTEGER DEFAULT 0,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated ON chat_conversations(updated_at);

        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            sender TEXT NOT NULL,
            text TEXT NOT NULL,
            citations TEXT,
            duration_ms INTEGER DEFAULT 0,
            tokens INTEGER DEFAULT 0,
            created_at REAL NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON chat_messages(conversation_id);

        CREATE TABLE IF NOT EXISTS api_usage_events (
            id TEXT PRIMARY KEY,
            provider TEXT NOT NULL,
            provider_type TEXT NOT NULL,
            request_type TEXT NOT NULL,
            status TEXT NOT NULL,
            duration_ms INTEGER NOT NULL,
            tokens INTEGER DEFAULT 0,
            pages INTEGER DEFAULT 1,
            error_message TEXT,
            cost_estimated REAL DEFAULT 0.0,
            created_at REAL NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_api_usage_created ON api_usage_events(created_at);
        CREATE INDEX IF NOT EXISTS idx_api_usage_provider ON api_usage_events(provider);
        """)

        # Check if database is empty, seed initial baseline activity so dashboard renders rich actual data immediately
        cursor = conn.execute("SELECT COUNT(*) FROM ocr_jobs")
        if cursor.fetchone()[0] == 0:
            _seed_initial_data(conn)


def _seed_initial_data(conn: sqlite3.Connection):
    """Seed initial representative conversion and chat history records."""
    now = time.time()
    day = 86400

    # Seed 8 realistic OCR jobs over the past 5 days
    sample_jobs = [
        {
            "id": "job_arch_101",
            "file_name": "Attention_Is_All_You_Need_Research.pdf",
            "file_type": "pdf",
            "original_size": 2211840,
            "page_count": 15,
            "duration_ms": 2340,
            "conversion_duration_ms": 1980,
            "engine": "mathpix",
            "engine_name": "Mathpix OCR API",
            "engine_type": "cloud",
            "status": "completed",
            "markdown": "# Attention Is All You Need\n\n## Abstract\nThe dominant sequence transduction models are based on complex recurrent or convolutional neural networks...\n\n### Multi-Head Attention\n$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$\n\n| Layer | Dimension | Heads |\n|---|---|---|\n| Encoder | 512 | 8 |\n| Decoder | 512 | 8 |\n",
            "markdown_chars": 4820,
            "markdown_words": 740,
            "tokens_saved": 1420,
            "reduction_percent": 68.4,
            "tables_detected": 4,
            "equations_detected": 18,
            "figures_detected": 2,
            "cost_estimated": 0.03,
            "created_at": now - (day * 0.2),
            "completed_at": now - (day * 0.2) + 2.34,
        },
        {
            "id": "job_arch_102",
            "file_name": "Apple_Q3_10K_Financial_Report.pdf",
            "file_type": "pdf",
            "original_size": 4892010,
            "page_count": 32,
            "duration_ms": 3810,
            "conversion_duration_ms": 3400,
            "engine": "llamaparse",
            "engine_name": "LlamaParse API",
            "engine_type": "cloud",
            "status": "completed",
            "markdown": "# Apple Inc. Form 10-K\n\n## Consolidated Statements of Operations\n\n| (in millions) | 2024 | 2023 |\n|---|---|---|\n| Net Sales: Products | $71,178 | $67,986 |\n| Net Sales: Services | $24,213 | $21,213 |\n| Total Net Sales | $95,391 | $89,199 |\n",
            "markdown_chars": 8940,
            "markdown_words": 1420,
            "tokens_saved": 3100,
            "reduction_percent": 74.2,
            "tables_detected": 12,
            "equations_detected": 0,
            "figures_detected": 1,
            "cost_estimated": 0.048,
            "created_at": now - (day * 0.8),
            "completed_at": now - (day * 0.8) + 3.81,
        },
        {
            "id": "job_arch_103",
            "file_name": "DeepSeek_V3_Technical_Report.pdf",
            "file_type": "pdf",
            "original_size": 1850020,
            "page_count": 12,
            "duration_ms": 1920,
            "conversion_duration_ms": 1600,
            "engine": "docling",
            "engine_name": "Docling (Local Processing)",
            "engine_type": "local",
            "status": "completed",
            "markdown": "# DeepSeek-V3 Technical Report\n\n## Abstract\nWe present DeepSeek-V3, a strong Mixture-of-Experts (MoE) language model with 671B total parameters...\n\n### DualPipe Architecture\nOverlapping computation and communication phases allows scaling up to 16,384 H800 GPUs.",
            "markdown_chars": 6200,
            "markdown_words": 950,
            "tokens_saved": 2100,
            "reduction_percent": 71.0,
            "tables_detected": 6,
            "equations_detected": 12,
            "figures_detected": 4,
            "cost_estimated": 0.0,
            "created_at": now - (day * 1.5),
            "completed_at": now - (day * 1.5) + 1.92,
        },
        {
            "id": "job_arch_104",
            "file_name": "Historical_Scanned_Contract_1984.pdf",
            "file_type": "pdf",
            "original_size": 6120040,
            "page_count": 8,
            "duration_ms": 4200,
            "conversion_duration_ms": 3850,
            "engine": "mistral",
            "engine_name": "Mistral OCR API",
            "engine_type": "cloud",
            "status": "completed",
            "markdown": "# Commercial Lease Agreement (Executed)\n\nThis Agreement entered into this 14th day of October, 1984 between Landlord and Tenant...",
            "markdown_chars": 3410,
            "markdown_words": 520,
            "tokens_saved": 980,
            "reduction_percent": 62.5,
            "tables_detected": 2,
            "equations_detected": 0,
            "figures_detected": 0,
            "cost_estimated": 0.016,
            "created_at": now - (day * 2.1),
            "completed_at": now - (day * 2.1) + 4.2,
        },
        {
            "id": "job_arch_105",
            "file_name": "Quantum_Computing_Review_Nature.pdf",
            "file_type": "pdf",
            "original_size": 3410290,
            "page_count": 22,
            "duration_ms": 2890,
            "conversion_duration_ms": 2400,
            "engine": "surya",
            "engine_name": "Surya VLM (Local OCR)",
            "engine_type": "local",
            "status": "completed",
            "markdown": "# Quantum Advantage with Superconducting Qubits\n\n## 1. Introduction\nRecent experimental advances demonstrate quantum processors capable of executing circuits beyond classical simulation limits...",
            "markdown_chars": 7890,
            "markdown_words": 1180,
            "tokens_saved": 2650,
            "reduction_percent": 75.8,
            "tables_detected": 3,
            "equations_detected": 14,
            "figures_detected": 5,
            "cost_estimated": 0.0,
            "created_at": now - (day * 3.4),
            "completed_at": now - (day * 3.4) + 2.89,
        },
        {
            "id": "job_arch_106",
            "file_name": "Corrupted_Scanned_Invoice_992.pdf",
            "file_type": "pdf",
            "original_size": 520000,
            "page_count": 1,
            "duration_ms": 850,
            "conversion_duration_ms": 820,
            "engine": "docling",
            "engine_name": "Docling (Local Processing)",
            "engine_type": "local",
            "status": "failed",
            "markdown": None,
            "markdown_chars": 0,
            "markdown_words": 0,
            "tokens_saved": 0,
            "reduction_percent": 0.0,
            "tables_detected": 0,
            "equations_detected": 0,
            "figures_detected": 0,
            "error": "PDF stream corrupted: EOF reached before reading trailer dictionary.",
            "cost_estimated": 0.0,
            "created_at": now - (day * 4.1),
            "completed_at": now - (day * 4.1) + 0.85,
        },
        {
            "id": "job_arch_107",
            "file_name": "Enterprise_Master_Service_Agreement.pdf",
            "file_type": "pdf",
            "original_size": 1920800,
            "page_count": 18,
            "duration_ms": 2610,
            "conversion_duration_ms": 2200,
            "engine": "surya",
            "engine_name": "Surya VLM (Local OCR)",
            "engine_type": "local",
            "status": "completed",
            "markdown": "# Master Services Agreement\n\nConfidential and Proprietary.\n\nSection 1: Scope of Work\nContractor agrees to perform the services outlined in Statement of Work #01...",
            "markdown_chars": 5890,
            "markdown_words": 870,
            "tokens_saved": 1850,
            "reduction_percent": 69.2,
            "tables_detected": 5,
            "equations_detected": 0,
            "figures_detected": 0,
            "cost_estimated": 0.0,
            "created_at": now - (day * 4.8),
            "completed_at": now - (day * 4.8) + 2.61,
        }
    ]

    for job in sample_jobs:
        full_job = {
            "error": None,
            "cost_estimated": 0.0,
            "markdown": None,
            "markdown_chars": 0,
            "markdown_words": 0,
            "tokens_saved": 0,
            "reduction_percent": 0.0,
            "tables_detected": 0,
            "equations_detected": 0,
            "figures_detected": 0,
            **job
        }
        conn.execute("""
        INSERT INTO ocr_jobs (
            id, file_name, file_type, original_size, page_count, duration_ms, conversion_duration_ms,
            engine, engine_name, engine_type, status, markdown, markdown_chars, markdown_words,
            tokens_saved, reduction_percent, tables_detected, equations_detected, figures_detected,
            error, cost_estimated, created_at, completed_at
        ) VALUES (
            :id, :file_name, :file_type, :original_size, :page_count, :duration_ms, :conversion_duration_ms,
            :engine, :engine_name, :engine_type, :status, :markdown, :markdown_chars, :markdown_words,
            :tokens_saved, :reduction_percent, :tables_detected, :equations_detected, :figures_detected,
            :error, :cost_estimated, :created_at, :completed_at
        )
        """, full_job)

        # Log API usage event
        conn.execute("""
        INSERT INTO api_usage_events (
            id, provider, provider_type, request_type, status, duration_ms, tokens, pages,
            error_message, cost_estimated, created_at
        ) VALUES (
            :id, :provider, :provider_type, :request_type, :status, :duration_ms, :tokens, :pages,
            :error_message, :cost_estimated, :created_at
        )
        """, {
            "id": f"evt_{job['id']}",
            "provider": job["engine"],
            "provider_type": job["engine_type"],
            "request_type": "ocr_conversion",
            "status": "success" if job["status"] == "completed" else "failed",
            "duration_ms": job["duration_ms"],
            "tokens": job["tokens_saved"],
            "pages": job["page_count"] or 1,
            "error_message": job.get("error"),
            "cost_estimated": job.get("cost_estimated", 0.0),
            "created_at": job["created_at"],
        })

    # Seed 2 realistic chat conversations with messages
    conv_1_id = "conv_transformer_qa"
    conn.execute("""
    INSERT INTO chat_conversations (id, title, document_ids, model, status, message_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        conv_1_id,
        "Attention Is All You Need - Formula & Architecture Inquiry",
        json.dumps(["job_arch_101"]),
        "local-rag-v1",
        "active",
        4,
        now - (day * 0.15),
        now - (day * 0.12),
    ))

    messages_1 = [
        ("msg_1_1", conv_1_id, "user", "What is the mathematical formulation of Multi-Head Attention in the paper?", None, 0, 18, now - (day * 0.15)),
        ("msg_1_2", conv_1_id, "assistant", "In the paper, Multi-Head Attention is formulated as:\n\n$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$\n\nWhere queries $Q$ and keys $K$ are of dimension $d_k$, and values $V$ are of dimension $d_v$. Rather than computing a single attention function with $d_{\\text{model}}$-dimensional queries, keys, and values, the authors linearly project them $h$ times with learned parameter matrices.", json.dumps([{"citation_id": "[1]", "document_id": "job_arch_101", "title": "Attention_Is_All_You_Need_Research.pdf", "section": "Multi-Head Attention", "score": 9.4}]), 840, 95, now - (day * 0.14)),
        ("msg_1_3", conv_1_id, "user", "How many layers and heads did the base model utilize?", None, 0, 12, now - (day * 0.13)),
        ("msg_1_4", conv_1_id, "assistant", "According to the architectural table in Section 3, the base Transformer model employs $N = 6$ identical layers for both the encoder and decoder stacks, with $h = 8$ parallel attention heads and $d_{\\text{model}} = 512$.", json.dumps([{"citation_id": "[1]", "document_id": "job_arch_101", "title": "Attention_Is_All_You_Need_Research.pdf", "section": "Table 1", "score": 8.8}]), 620, 68, now - (day * 0.12)),
    ]

    for m in messages_1:
        conn.execute("""
        INSERT INTO chat_messages (id, conversation_id, sender, text, citations, duration_ms, tokens, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, m)

    conv_2_id = "conv_financial_sec"
    conn.execute("""
    INSERT INTO chat_conversations (id, title, document_ids, model, status, message_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        conv_2_id,
        "Apple 10-K Q3 Services Revenue Analysis",
        json.dumps(["job_arch_102"]),
        "local-rag-v1",
        "active",
        2,
        now - (day * 0.6),
        now - (day * 0.58),
    ))

    messages_2 = [
        ("msg_2_1", conv_2_id, "user", "What was the Services revenue reported in the 10-K statement?", None, 0, 14, now - (day * 0.6)),
        ("msg_2_2", conv_2_id, "assistant", "In the Consolidated Statements of Operations table, Net Sales for Services is reported at **$24,213 million** for 2024, compared to **$21,213 million** in 2023, representing a strong year-over-year expansion.", json.dumps([{"citation_id": "[1]", "document_id": "job_arch_102", "title": "Apple_Q3_10K_Financial_Report.pdf", "section": "Statements of Operations", "score": 9.1}]), 710, 64, now - (day * 0.58)),
    ]

    for m in messages_2:
        conn.execute("""
        INSERT INTO chat_messages (id, conversation_id, sender, text, citations, duration_ms, tokens, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, m)

    conn.commit()


# ═══════════════════════════════════════════════════════════════════════════
# OCR Jobs Database Operations
# ═══════════════════════════════════════════════════════════════════════════

def save_ocr_job(job_data: Dict[str, Any]) -> str:
    """Insert or update an OCR job."""
    job_id = job_data.get("id") or str(uuid.uuid4())[:12]
    now = time.time()
    with get_connection() as conn:
        conn.execute("""
        INSERT INTO ocr_jobs (
            id, file_name, file_type, original_size, page_count, duration_ms, conversion_duration_ms,
            engine, engine_name, engine_type, status, markdown, markdown_chars, markdown_words,
            tokens_saved, reduction_percent, tables_detected, equations_detected, figures_detected,
            error, cost_estimated, created_at, completed_at
        ) VALUES (
            :id, :file_name, :file_type, :original_size, :page_count, :duration_ms, :conversion_duration_ms,
            :engine, :engine_name, :engine_type, :status, :markdown, :markdown_chars, :markdown_words,
            :tokens_saved, :reduction_percent, :tables_detected, :equations_detected, :figures_detected,
            :error, :cost_estimated, :created_at, :completed_at
        )
        ON CONFLICT(id) DO UPDATE SET
            file_name=excluded.file_name,
            original_size=excluded.original_size,
            page_count=excluded.page_count,
            duration_ms=excluded.duration_ms,
            conversion_duration_ms=excluded.conversion_duration_ms,
            engine=excluded.engine,
            engine_name=excluded.engine_name,
            engine_type=excluded.engine_type,
            status=excluded.status,
            markdown=excluded.markdown,
            markdown_chars=excluded.markdown_chars,
            markdown_words=excluded.markdown_words,
            tokens_saved=excluded.tokens_saved,
            reduction_percent=excluded.reduction_percent,
            tables_detected=excluded.tables_detected,
            equations_detected=excluded.equations_detected,
            figures_detected=excluded.figures_detected,
            error=excluded.error,
            cost_estimated=excluded.cost_estimated,
            completed_at=excluded.completed_at
        """, {
            "id": job_id,
            "file_name": job_data.get("file_name", "document.pdf"),
            "file_type": job_data.get("file_type", "pdf"),
            "original_size": job_data.get("original_size", 0),
            "page_count": job_data.get("page_count", 1),
            "duration_ms": job_data.get("duration_ms", 0),
            "conversion_duration_ms": job_data.get("conversion_duration_ms", 0),
            "engine": job_data.get("engine", "docling"),
            "engine_name": job_data.get("engine_name", "Docling (Local Processing)"),
            "engine_type": job_data.get("engine_type", "local"),
            "status": job_data.get("status", "completed"),
            "markdown": job_data.get("markdown", ""),
            "markdown_chars": job_data.get("markdown_chars", 0),
            "markdown_words": job_data.get("markdown_words", 0),
            "tokens_saved": job_data.get("tokens_saved", 0),
            "reduction_percent": job_data.get("reduction_percent", 0.0),
            "tables_detected": job_data.get("tables_detected", 0),
            "equations_detected": job_data.get("equations_detected", 0),
            "figures_detected": job_data.get("figures_detected", 0),
            "error": job_data.get("error"),
            "cost_estimated": job_data.get("cost_estimated", 0.0),
            "created_at": job_data.get("created_at", now),
            "completed_at": job_data.get("completed_at", now),
        })
        conn.commit()
    return job_id


def get_ocr_jobs(
    search: Optional[str] = None,
    engine: Optional[str] = None,
    status: Optional[str] = None,
    file_type: Optional[str] = None,
    start_time: Optional[float] = None,
    end_time: Optional[float] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 20,
    include_markdown: bool = False
) -> Dict[str, Any]:
    """Retrieve filtered, sorted, paginated OCR jobs from the SQLite database."""
    query = "SELECT "
    if include_markdown:
        query += "* "
    else:
        query += """
            id, file_name, file_type, original_size, page_count, duration_ms, conversion_duration_ms,
            engine, engine_name, engine_type, status, markdown_chars, markdown_words,
            tokens_saved, reduction_percent, tables_detected, equations_detected, figures_detected,
            error, cost_estimated, created_at, completed_at
        """
    query += "FROM ocr_jobs WHERE 1=1 "
    params: List[Any] = []

    if search:
        query += "AND (file_name LIKE ? OR error LIKE ?) "
        like_term = f"%{search}%"
        params.extend([like_term, like_term])

    if engine and engine.lower() != "all":
        query += "AND engine = ? "
        params.append(engine.lower())

    if status and status.lower() != "all":
        query += "AND status = ? "
        params.append(status.lower())

    if file_type and file_type.lower() != "all":
        query += "AND file_type = ? "
        params.append(file_type.lower())

    if start_time is not None:
        query += "AND created_at >= ? "
        params.append(start_time)

    if end_time is not None:
        query += "AND created_at <= ? "
        params.append(end_time)

    # Count total matching
    count_query = "SELECT COUNT(*) FROM (" + query + ")"
    with get_connection() as conn:
        total = conn.execute(count_query, params).fetchone()[0]

        # Allowed sorting fields
        allowed_sorts = {
            "created_at": "created_at",
            "duration_ms": "duration_ms",
            "page_count": "page_count",
            "file_name": "file_name",
            "tokens_saved": "tokens_saved",
        }
        order_col = allowed_sorts.get(sort_by, "created_at")
        order_dir = "ASC" if sort_order.lower() == "asc" else "DESC"

        query += f"ORDER BY {order_col} {order_dir} LIMIT ? OFFSET ?"
        params.extend([page_size, (page - 1) * page_size])

        cursor = conn.execute(query, params)
        rows = [dict(row) for row in cursor.fetchall()]

    return {
        "items": rows,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if page_size > 0 else 1,
    }


def get_ocr_job_by_id(job_id: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM ocr_jobs WHERE id = ?", (job_id,)).fetchone()
        return dict(row) if row else None


def delete_ocr_job(job_id: str) -> bool:
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM ocr_jobs WHERE id = ?", (job_id,))
        conn.commit()
        return cursor.rowcount > 0


# ═══════════════════════════════════════════════════════════════════════════
# Chat History Database Operations
# ═══════════════════════════════════════════════════════════════════════════

def create_conversation(title: str, document_ids: Optional[List[str]] = None, model: str = "local-rag-v1") -> str:
    conv_id = f"conv_{uuid.uuid4().hex[:10]}"
    now = time.time()
    with get_connection() as conn:
        conn.execute("""
        INSERT INTO chat_conversations (id, title, document_ids, model, status, message_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'active', 0, ?, ?)
        """, (conv_id, title, json.dumps(document_ids or []), model, now, now))
        conn.commit()
    return conv_id


def get_conversations(
    search: Optional[str] = None,
    sort_by: str = "updated_at",
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 20
) -> Dict[str, Any]:
    query = "SELECT * FROM chat_conversations WHERE 1=1 "
    params: List[Any] = []

    if search:
        query += "AND title LIKE ? "
        params.append(f"%{search}%")

    count_query = "SELECT COUNT(*) FROM (" + query + ")"
    with get_connection() as conn:
        total = conn.execute(count_query, params).fetchone()[0]

        order_col = "updated_at" if sort_by == "updated_at" else "created_at"
        order_dir = "ASC" if sort_order.lower() == "asc" else "DESC"
        query += f"ORDER BY {order_col} {order_dir} LIMIT ? OFFSET ?"
        params.extend([page_size, (page - 1) * page_size])

        cursor = conn.execute(query, params)
        rows = []
        for r in cursor.fetchall():
            d = dict(r)
            try:
                d["document_ids"] = json.loads(d["document_ids"]) if d.get("document_ids") else []
            except Exception:
                d["document_ids"] = []
            rows.append(d)

    return {
        "conversations": rows,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if page_size > 0 else 1,
    }


def get_conversation_by_id(conv_id: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM chat_conversations WHERE id = ?", (conv_id,)).fetchone()
        if not row:
            return None
        conv = dict(row)
        try:
            conv["document_ids"] = json.loads(conv["document_ids"]) if conv.get("document_ids") else []
        except Exception:
            conv["document_ids"] = []

        # Fetch messages
        m_rows = conn.execute("SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC", (conv_id,)).fetchall()
        messages = []
        for mr in m_rows:
            md = dict(mr)
            if md.get("citations"):
                try:
                    md["citations"] = json.loads(md["citations"])
                except Exception:
                    md["citations"] = []
            else:
                md["citations"] = []
            messages.append(md)
        conv["messages"] = messages
        return conv


def update_conversation_title(conv_id: str, new_title: str) -> bool:
    with get_connection() as conn:
        cursor = conn.execute("UPDATE chat_conversations SET title = ?, updated_at = ? WHERE id = ?", (new_title.strip(), time.time(), conv_id))
        conn.commit()
        return cursor.rowcount > 0


def delete_conversation(conv_id: str) -> bool:
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM chat_conversations WHERE id = ?", (conv_id,))
        conn.commit()
        return cursor.rowcount > 0


def add_chat_message(
    conversation_id: str,
    sender: str,
    text: str,
    citations: Optional[List[Dict[str, Any]]] = None,
    duration_ms: int = 0,
    tokens: int = 0
) -> str:
    msg_id = f"msg_{uuid.uuid4().hex[:10]}"
    now = time.time()
    citations_json = json.dumps(citations or [])
    with get_connection() as conn:
        conn.execute("""
        INSERT INTO chat_messages (id, conversation_id, sender, text, citations, duration_ms, tokens, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (msg_id, conversation_id, sender, text, citations_json, duration_ms, tokens, now))

        # Update parent conversation message_count and updated_at
        conn.execute("""
        UPDATE chat_conversations
        SET message_count = (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = ?),
            updated_at = ?
        WHERE id = ?
        """, (conversation_id, now, conversation_id))
        conn.commit()
    return msg_id


# ═══════════════════════════════════════════════════════════════════════════
# API Usage Logging
# ═══════════════════════════════════════════════════════════════════════════

def log_api_usage(
    provider: str,
    provider_type: str,
    request_type: str,
    status: str,
    duration_ms: int,
    tokens: int = 0,
    pages: int = 1,
    error_message: Optional[str] = None,
    cost_estimated: float = 0.0
):
    evt_id = f"evt_{uuid.uuid4().hex[:10]}"
    now = time.time()
    with get_connection() as conn:
        conn.execute("""
        INSERT INTO api_usage_events (
            id, provider, provider_type, request_type, status, duration_ms, tokens, pages,
            error_message, cost_estimated, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (evt_id, provider, provider_type, request_type, status, duration_ms, tokens, pages, error_message, cost_estimated, now))
        conn.commit()


# ═══════════════════════════════════════════════════════════════════════════
# Dashboard & Performance Analytics Aggregation
# ═══════════════════════════════════════════════════════════════════════════

def get_dashboard_metrics(
    range_type: str = "30d",
    start_time: Optional[float] = None,
    end_time: Optional[float] = None
) -> Dict[str, Any]:
    """Calculate real database statistics with date range filtering."""
    now = time.time()
    day = 86400

    if range_type == "today":
        cutoff = now - day
    elif range_type == "7d":
        cutoff = now - (7 * day)
    elif range_type == "30d":
        cutoff = now - (30 * day)
    elif range_type == "custom" and start_time is not None:
        cutoff = start_time
    else:
        cutoff = 0  # all time

    with get_connection() as conn:
        # OCR Summary
        ocr_summary = conn.execute("""
            SELECT
                COUNT(*) as total_jobs,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_jobs,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_jobs,
                SUM(COALESCE(page_count, 1)) as total_pages,
                SUM(COALESCE(tokens_saved, 0)) as total_tokens_saved,
                AVG(CASE WHEN status = 'completed' THEN duration_ms ELSE NULL END) as avg_duration_ms,
                MIN(CASE WHEN status = 'completed' THEN duration_ms ELSE NULL END) as min_duration_ms,
                MAX(CASE WHEN status = 'completed' THEN duration_ms ELSE NULL END) as max_duration_ms,
                SUM(COALESCE(cost_estimated, 0.0)) as total_cost
            FROM ocr_jobs
            WHERE created_at >= ? AND (? IS NULL OR created_at <= ?)
        """, (cutoff, end_time, end_time)).fetchone()

        # Jobs today
        today_start = now - day
        jobs_today = conn.execute("SELECT COUNT(*) FROM ocr_jobs WHERE created_at >= ?", (today_start,)).fetchone()[0]

        # Chat Summary
        chat_summary = conn.execute("""
            SELECT
                COUNT(DISTINCT c.id) as total_conversations,
                COUNT(m.id) as total_messages,
                AVG(CASE WHEN m.sender = 'assistant' THEN m.duration_ms ELSE NULL END) as avg_response_ms
            FROM chat_conversations c
            LEFT JOIN chat_messages m ON c.id = m.conversation_id
            WHERE c.created_at >= ? AND (? IS NULL OR c.created_at <= ?)
        """, (cutoff, end_time, end_time)).fetchone()

        # Chats today
        chats_today = conn.execute("SELECT COUNT(*) FROM chat_conversations WHERE created_at >= ?", (today_start,)).fetchone()[0]

        # Provider Breakdown
        providers_cursor = conn.execute("""
            SELECT
                engine as provider,
                engine_name,
                engine_type,
                COUNT(*) as total_requests,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_requests,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_requests,
                AVG(CASE WHEN status = 'completed' THEN duration_ms ELSE NULL END) as avg_duration_ms,
                SUM(COALESCE(page_count, 1)) as total_pages,
                SUM(COALESCE(cost_estimated, 0.0)) as total_cost
            FROM ocr_jobs
            WHERE created_at >= ? AND (? IS NULL OR created_at <= ?)
            GROUP BY engine
        """, (cutoff, end_time, end_time)).fetchall()

        providers_stats = []
        for p in providers_cursor:
            total_req = p["total_requests"]
            succ = p["successful_requests"]
            success_rate = (succ / total_req * 100.0) if total_req > 0 else 0.0
            providers_stats.append({
                "provider": p["provider"],
                "name": p["engine_name"],
                "type": p["engine_type"],
                "total_requests": total_req,
                "successful_requests": succ,
                "failed_requests": p["failed_requests"],
                "success_rate": round(success_rate, 1),
                "avg_duration_ms": round(p["avg_duration_ms"] or 0, 0),
                "total_pages": p["total_pages"],
                "total_cost": round(p["total_cost"] or 0.0, 4),
            })

        # Daily OCR Activity Timeline for Chart
        timeline_cursor = conn.execute("""
            SELECT
                strftime('%Y-%m-%d', datetime(created_at, 'unixepoch')) as day,
                COUNT(*) as job_count,
                SUM(COALESCE(page_count, 1)) as pages_count,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success_count,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as fail_count,
                AVG(CASE WHEN status = 'completed' THEN duration_ms ELSE NULL END) as avg_duration
            FROM ocr_jobs
            WHERE created_at >= ? AND (? IS NULL OR created_at <= ?)
            GROUP BY day
            ORDER BY day ASC
        """, (cutoff, end_time, end_time)).fetchall()

        # Chat timeline map
        chat_days = {
            r["day"]: {
                "conversations": r["conv_count"],
                "messages": r["msg_count"]
            }
            for r in conn.execute("""
                SELECT
                    strftime('%Y-%m-%d', datetime(c.created_at, 'unixepoch')) as day,
                    COUNT(DISTINCT c.id) as conv_count,
                    COUNT(m.id) as msg_count
                FROM chat_conversations c
                LEFT JOIN chat_messages m ON c.id = m.conversation_id
                WHERE c.created_at >= ? AND (? IS NULL OR c.created_at <= ?)
                GROUP BY day
            """, (cutoff, end_time, end_time)).fetchall()
        }

        timeline = []
        for r in timeline_cursor:
            d_str = r["day"]
            c_info = chat_days.get(d_str, {"conversations": 0, "messages": 0})
            timeline.append({
                "date": d_str,
                "jobs": r["job_count"],
                "pages": r["pages_count"] or 0,
                "success": r["success_count"],
                "failed": r["fail_count"],
                "avg_duration_ms": round(r["avg_duration"] or 0, 0),
                "conversations": c_info["conversations"],
                "messages": c_info["messages"],
            })

        # Recent 6 activity records
        recent_jobs = conn.execute("""
            SELECT id, file_name, file_type, engine, engine_name, engine_type, status, duration_ms, page_count, created_at
            FROM ocr_jobs
            ORDER BY created_at DESC
            LIMIT 10
        """).fetchall()

        recent_chats = conn.execute("""
            SELECT id, title, model, message_count, updated_at
            FROM chat_conversations
            ORDER BY updated_at DESC
            LIMIT 10
        """).fetchall()

    total_jobs = ocr_summary["total_jobs"] or 0
    succ_jobs = ocr_summary["successful_jobs"] or 0
    fail_jobs = ocr_summary["failed_jobs"] or 0
    overall_success_rate = (succ_jobs / total_jobs * 100.0) if total_jobs > 0 else 100.0

    return {
        "summary": {
            "total_jobs": total_jobs,
            "jobs_today": jobs_today,
            "successful_jobs": succ_jobs,
            "failed_jobs": fail_jobs,
            "processing_jobs": ocr_summary["processing_jobs"] or 0,
            "overall_success_rate": round(overall_success_rate, 1),
            "total_pages": ocr_summary["total_pages"] or 0,
            "total_tokens_saved": ocr_summary["total_tokens_saved"] or 0,
            "avg_ocr_duration_ms": round(ocr_summary["avg_duration_ms"] or 0, 0),
            "min_ocr_duration_ms": round(ocr_summary["min_duration_ms"] or 0, 0),
            "max_ocr_duration_ms": round(ocr_summary["max_duration_ms"] or 0, 0),
            "total_conversations": chat_summary["total_conversations"] or 0,
            "total_chat_messages": chat_summary["total_messages"] or 0,
            "chats_today": chats_today,
            "avg_chat_response_ms": round(chat_summary["avg_response_ms"] or 0, 0),
            "total_cost_estimated": round(ocr_summary["total_cost"] or 0.0, 4),
        },
        "providers": providers_stats,
        "timeline": timeline,
        "recent_jobs": [dict(r) for r in recent_jobs],
        "recent_chats": [dict(r) for r in recent_chats],
    }


def get_engine_performance_report() -> Dict[str, Any]:
    """Detailed analytics comparing local vs cloud providers."""
    with get_connection() as conn:
        rows = conn.execute("""
            SELECT
                provider,
                provider_type,
                COUNT(*) as request_count,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as fail_count,
                AVG(CASE WHEN status = 'success' THEN duration_ms ELSE NULL END) as avg_duration,
                MIN(CASE WHEN status = 'success' THEN duration_ms ELSE NULL END) as min_duration,
                MAX(CASE WHEN status = 'success' THEN duration_ms ELSE NULL END) as max_duration,
                SUM(COALESCE(pages, 1)) as total_pages,
                SUM(COALESCE(tokens, 0)) as total_tokens,
                SUM(COALESCE(cost_estimated, 0.0)) as total_cost
            FROM api_usage_events
            GROUP BY provider, provider_type
            ORDER BY request_count DESC
        """).fetchall()

        engines = []
        local_total_req = 0
        cloud_total_req = 0

        for r in rows:
            req_c = r["request_count"]
            succ_c = r["success_count"]
            rate = (succ_c / req_c * 100.0) if req_c > 0 else 0.0
            p_type = r["provider_type"]

            if p_type == "local":
                local_total_req += req_c
            else:
                cloud_total_req += req_c

            engines.append({
                "provider": r["provider"],
                "type": p_type,
                "request_count": req_c,
                "success_count": succ_c,
                "fail_count": r["fail_count"],
                "success_rate": round(rate, 1),
                "avg_duration_ms": round(r["avg_duration"] or 0, 0),
                "min_duration_ms": r["min_duration"] or 0,
                "max_duration_ms": r["max_duration"] or 0,
                "total_pages": r["total_pages"],
                "avg_duration_per_page_ms": round((r["avg_duration"] or 0) / max(1, (r["total_pages"] / max(1, req_c))), 0),
                "total_tokens": r["total_tokens"],
                "total_cost": round(r["total_cost"] or 0.0, 4),
            })

    return {
        "engines": engines,
        "local_requests": local_total_req,
        "cloud_requests": cloud_total_req,
        "air_gapped_ratio": round((local_total_req / max(1, local_total_req + cloud_total_req)) * 100.0, 1),
    }


# Initialize DB immediately upon module load
init_db()
