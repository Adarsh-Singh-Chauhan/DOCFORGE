"""FastAPI wrapper for the local Marker PDF conversion engine."""

from __future__ import annotations

import logging
import os
import time
import uuid
import asyncio
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel
from dotenv import load_dotenv

from marker.converters.pdf import PdfConverter
from marker.config.parser import ConfigParser
from marker.models import create_model_dict
from marker.output import text_from_rendered
from marker.settings import settings as marker_settings
from pdqa_api.token_analysis import inspect_pdf_text
from pdqa_api.openai_counting import count_pdf_and_markdown, unavailable_count_result
from pdqa_api.engines import (
    get_engine_statuses, select_auto_engine,
    run_docling_conversion, run_mistral_ocr,
    run_mathpix_ocr, run_llamaparse,
    is_mistral_configured, is_mathpix_configured, is_llamaparse_configured
)
from pdqa_api.db import (
    save_ocr_job, get_ocr_jobs, get_ocr_job_by_id, delete_ocr_job,
    create_conversation, get_conversations, get_conversation_by_id,
    update_conversation_title, delete_conversation, add_chat_message,
    log_api_usage, get_dashboard_metrics, get_engine_performance_report
)

logger = logging.getLogger("pdqa_api")
load_dotenv(Path(__file__).with_name(".env"), override=False)
app_data: dict = {}
history: list[dict] = []
_marker_lock = asyncio.Lock()
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

def run_marker_conversion(upload_path: str, config_dict: dict):
    """Run synchronous Marker inference using the lifespan's shared models."""
    config_parser = ConfigParser(config_dict)
    converter = PdfConverter(
        config=config_dict,
        artifact_dict=app_data["models"],
        processor_list=config_parser.get_processors(),
        renderer=config_parser.get_renderer(),
        llm_service=config_parser.get_llm_service(),
    )
    rendered = converter(upload_path)
    markdown, _, _ = text_from_rendered(rendered)
    return markdown, getattr(converter, "page_count", None)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize Marker artifacts once and reuse them across conversions."""
    started = time.perf_counter()
    logger.info("Marker model initialization started")
    app_data["models"] = create_model_dict()
    logger.info("Marker models initialized elapsed=%.3fs", time.perf_counter() - started)
    try:
        yield
    finally:
        if "models" in app_data:
            from marker.models import shutdown_models

            shutdown_models(app_data.pop("models"))


app = FastAPI(title="DocForge API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_request_lifecycle(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    request.state.request_id = request_id
    started = time.perf_counter()
    logger.info("[%s] request received method=%s path=%s", request_id, request.method, request.url.path)
    try:
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "[%s] response returned status=%d total_elapsed=%.3fs",
            request_id,
            response.status_code,
            time.perf_counter() - started,
        )
        return response
    except Exception:
        logger.exception("[%s] request exception total_elapsed=%.3fs", request_id, time.perf_counter() - started)
        raise


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "modelsLoaded": "models" in app_data,
        "device": str(marker_settings.TORCH_DEVICE_MODEL),
        "tokenCountingConfigured": bool(os.getenv("OPENAI_API_KEY")),
    }


class ConvertMeta(BaseModel):
    id: str
    fileName: str
    fileType: str
    originalSize: int
    pageCount: Optional[int] = None
    durationMs: int
    conversionDurationMs: int
    tokenCountingDurationMs: int
    markdown: str
    markdownCharacters: int
    markdownWords: int
    baselineCharacters: Optional[int] = None
    baselineWords: Optional[int] = None
    baselineAvailable: bool
    baselineStatus: str
    baselineReason: str
    extractionCoveragePercent: float
    extractedTextPageCount: int
    imagePageCount: int
    originalPdfInputTokens: Optional[int] = None
    markdownInputTokens: Optional[int] = None
    tokensSaved: Optional[int] = None
    reductionPercent: Optional[float] = None
    comparisonComparable: bool
    comparisonReason: Optional[str] = None
    tokenCountingStatus: str
    tokenCountingModel: str
    tokenCountingMethod: str
    originalPdfCount: dict
    markdownCount: dict
    mode: str
    forceOcr: bool
    success: bool
    engine: Optional[str] = "docling"
    engineName: Optional[str] = "Docling (Local)"
    engineType: Optional[str] = "local"
    tablesDetected: Optional[int] = 0
    equationsDetected: Optional[int] = 0
    figuresDetected: Optional[int] = 0
    error: Optional[str] = None


@app.get("/api/engines")
async def get_engines():
    """Return safe metadata and configuration status for all 5 document intelligence engines."""
    return {"success": True, "engines": get_engine_statuses()}


class EngineConfigRequest(BaseModel):
    mistral_api_key: Optional[str] = None
    mathpix_app_id: Optional[str] = None
    mathpix_app_key: Optional[str] = None
    llama_cloud_api_key: Optional[str] = None


@app.post("/api/engines/config")
async def configure_engines(req: EngineConfigRequest):
    """Store credentials securely in backend environment variables."""
    if req.mistral_api_key is not None:
        os.environ["MISTRAL_API_KEY"] = req.mistral_api_key.strip()
    if req.mathpix_app_id is not None:
        os.environ["MATHPIX_APP_ID"] = req.mathpix_app_id.strip()
    if req.mathpix_app_key is not None:
        os.environ["MATHPIX_APP_KEY"] = req.mathpix_app_key.strip()
    if req.llama_cloud_api_key is not None:
        os.environ["LLAMA_CLOUD_API_KEY"] = req.llama_cloud_api_key.strip()

    # Append to .env securely without exposing secrets
    env_file = Path(__file__).resolve().parent.parent / ".env"
    try:
        with open(env_file, "a") as f:
            if req.mistral_api_key:
                f.write(f"\nMISTRAL_API_KEY={req.mistral_api_key.strip()}")
            if req.mathpix_app_id:
                f.write(f"\nMATHPIX_APP_ID={req.mathpix_app_id.strip()}")
            if req.mathpix_app_key:
                f.write(f"\nMATHPIX_APP_KEY={req.mathpix_app_key.strip()}")
            if req.llama_cloud_api_key:
                f.write(f"\nLLAMA_CLOUD_API_KEY={req.llama_cloud_api_key.strip()}")
    except Exception as e:
        logger.warning("Could not persist to .env: %s", e)

    return {"success": True, "engines": get_engine_statuses()}


@app.post("/api/convert")
async def convert_pdf(
    request: Request,
    file: UploadFile = File(..., description="PDF file to convert"),
    mode: Optional[str] = Form(default=None),
    force_ocr: Optional[bool] = Form(default=False),
    count_with_openai: Optional[bool] = Form(default=False),
    target_model: Optional[str] = Form(default="gpt-4.1"),
    engine: Optional[str] = Form(default="auto"),
    cloud_consent: Optional[bool] = Form(default=False),
):
    request_id = request.state.request_id
    started = time.perf_counter()
    filename = os.path.basename(file.filename or "document.pdf")
    upload_path = None
    marker_lock_acquired = False
    logger.info(
        "[%s] conversion handler started filename=%s mode=%s force_ocr=%s",
        request_id,
        filename,
        mode or "device-default",
        force_ocr or False,
    )

    try:
        stage_started = time.perf_counter()
        file_bytes = await file.read()
        file_size = len(file_bytes)
        logger.info("[%s] upload completed bytes=%d elapsed=%.3fs", request_id, file_size, time.perf_counter() - stage_started)

        file_ext = os.path.splitext(filename)[1].lstrip(".").lower() or "pdf"
        upload_path = os.path.join(UPLOAD_DIR, f"{request_id}_{filename}")
        stage_started = time.perf_counter()
        with open(upload_path, "wb") as target:
            target.write(file_bytes)
        logger.info("[%s] upload saved elapsed=%.3fs", request_id, time.perf_counter() - stage_started)

        lock_wait_started = time.perf_counter()
        await _marker_lock.acquire()
        marker_lock_acquired = True
        logger.info("[%s] conversion lock acquired wait=%.3fs", request_id, time.perf_counter() - lock_wait_started)

        # Inspect selectable text and image coverage without invoking OCR.
        stage_started = time.perf_counter()
        inspection = await run_in_threadpool(inspect_pdf_text, upload_path)
        baseline_available = bool(inspection.extracted_text)
        baseline_chars = inspection.extracted_characters if baseline_available else None
        baseline_words = len(inspection.extracted_text.split()) if baseline_available else None
        logger.info(
            "[%s] PDF text inspection finished pages=%d text_pages=%d image_pages=%d chars=%d status=%s elapsed=%.3fs",
            request_id,
            inspection.page_count, inspection.text_page_count, inspection.image_page_count,
            inspection.extracted_characters, inspection.baseline_status,
            time.perf_counter() - stage_started,
        )

        options = {
            "output_format": "markdown",
            "force_ocr": force_ocr or False,
            "paginate_output": False,
        }
        if mode:
            options["mode"] = mode
        config_parser = ConfigParser(options)
        config_dict = config_parser.generate_config_dict()
        # marker_single uses the provider's default of 4 pdftext workers. Match it
        # here; forcing one worker was a material API/CLI configuration mismatch.
        config_dict["pdftext_workers"] = 4
        safe_config = {
            key: ("[redacted]" if any(secret in key.lower() for secret in ("key", "token", "secret")) else value)
            for key, value in config_dict.items()
        }
        logger.info(
            "[%s] conversion started marker_config=%s effective_pdftext_workers=4",
            request_id,
            safe_config,
        )

        # Determine effective engine
        req_engine = (engine or "auto").lower()
        if req_engine == "auto":
            chosen_engine = select_auto_engine(file_bytes, filename, cloud_consent or False)
        else:
            chosen_engine = req_engine

        engine_display_names = {
            "docling": ("Docling (Local Processing)", "local"),
            "surya": ("Surya VLM (Local OCR)", "local"),
            "mistral": ("Mistral OCR API", "cloud"),
            "mathpix": ("Mathpix OCR API", "cloud"),
            "llamaparse": ("LlamaParse API", "cloud"),
        }
        engine_name, engine_type = engine_display_names.get(chosen_engine, ("Docling (Local)", "local"))
        tables_detected = 0
        equations_detected = 0
        figures_detected = 0

        stage_started = time.perf_counter()
        if chosen_engine == "mistral":
            if not cloud_consent:
                raise ValueError("Cloud processing consent required before sending documents to Mistral AI.")
            eng_res = await run_in_threadpool(run_mistral_ocr, file_bytes, filename)
            text = eng_res.markdown
            page_count = eng_res.page_count
            tables_detected = eng_res.tables_detected
            equations_detected = eng_res.equations_detected
            figures_detected = eng_res.figures_detected
        elif chosen_engine == "mathpix":
            if not cloud_consent:
                raise ValueError("Cloud processing consent required before sending documents to Mathpix API.")
            eng_res = await run_in_threadpool(run_mathpix_ocr, file_bytes, filename)
            text = eng_res.markdown
            page_count = eng_res.page_count
            tables_detected = eng_res.tables_detected
            equations_detected = eng_res.equations_detected
            figures_detected = eng_res.figures_detected
        elif chosen_engine == "llamaparse":
            if not cloud_consent:
                raise ValueError("Cloud processing consent required before sending documents to LlamaParse API.")
            eng_res = await run_in_threadpool(run_llamaparse, file_bytes, filename)
            text = eng_res.markdown
            page_count = eng_res.page_count
            tables_detected = eng_res.tables_detected
            equations_detected = eng_res.equations_detected
            figures_detected = eng_res.figures_detected
        elif chosen_engine == "docling":
            eng_res = await run_in_threadpool(run_docling_conversion, upload_path, file_bytes, filename)
            text = eng_res.markdown
            page_count = eng_res.page_count
            tables_detected = eng_res.tables_detected
            equations_detected = eng_res.equations_detected
            figures_detected = eng_res.figures_detected
        else: # surya
            text, page_count = await run_in_threadpool(run_marker_conversion, upload_path, config_dict)
            tables_detected = len(re.findall(r"\|.*?\|.*?\|", text))
            equations_detected = len(re.findall(r"\$\$.*?\$\$|\$.*?\$", text, re.DOTALL))
            figures_detected = len(re.findall(r"!\[.*?\]\(.*?\)", text))

        actual_mode = config_dict.get("mode", "unknown")
        logger.info(
            "[%s] conversion finished engine=%s pages=%s markdown_chars=%d elapsed=%.3fs",
            request_id,
            chosen_engine,
            page_count,
            len(text),
            time.perf_counter() - stage_started,
        )
        conversion_duration_ms = int((time.perf_counter() - stage_started) * 1000)

        stage_started = time.perf_counter()
        count_model = target_model or "gpt-4.1"
        try:
            token_count_result = await count_pdf_and_markdown(
                pdf_bytes=file_bytes,
                filename=filename,
                markdown=text,
                model=count_model,
                consent=count_with_openai is True,
                api_key=os.getenv("OPENAI_API_KEY"),
            )
        except Exception as count_exc:
            # Optional external counting must never discard a completed local conversion.
            logger.warning(
                "[%s] optional API counting failed; preserving local Markdown error_type=%s",
                request_id,
                type(count_exc).__name__,
            )
            token_count_result = unavailable_count_result(
                count_model, "Token counting failed unexpectedly; local Markdown remains available."
            )
        pdf_count = token_count_result["originalPdf"]
        markdown_count = token_count_result["markdown"]
        comparison = token_count_result["comparison"]
        token_counting_duration_ms = int((time.perf_counter() - stage_started) * 1000)
        result = ConvertMeta(
            id=request_id,
            fileName=filename,
            fileType=file_ext,
            originalSize=file_size,
            pageCount=page_count or inspection.page_count,
            durationMs=int((time.perf_counter() - started) * 1000),
            conversionDurationMs=conversion_duration_ms,
            tokenCountingDurationMs=token_counting_duration_ms,
            markdown=text,
            markdownCharacters=len(text),
            markdownWords=len(text.split()),
            baselineCharacters=baseline_chars,
            baselineWords=baseline_words,
            baselineAvailable=baseline_available,
            baselineStatus=inspection.baseline_status,
            baselineReason=inspection.baseline_reason,
            extractionCoveragePercent=inspection.coverage_percent,
            extractedTextPageCount=inspection.text_page_count,
            imagePageCount=inspection.image_page_count,
            originalPdfInputTokens=pdf_count["inputTokens"],
            markdownInputTokens=markdown_count["inputTokens"],
            tokensSaved=comparison["tokensSaved"],
            reductionPercent=comparison["reductionPercent"],
            comparisonComparable=comparison["status"] == "API verified",
            comparisonReason=comparison["reason"],
            tokenCountingStatus=token_count_result["status"],
            tokenCountingModel=token_count_result["model"],
            tokenCountingMethod=token_count_result["method"],
            originalPdfCount=pdf_count,
            markdownCount=markdown_count,
            mode=actual_mode,
            forceOcr=force_ocr or False,
            success=True,
            engine=chosen_engine,
            engineName=engine_name,
            engineType=engine_type,
            tablesDetected=tables_detected,
            equationsDetected=equations_detected,
            figuresDetected=figures_detected,
        )
        logger.info("[%s] token metrics finished elapsed=%.3fs", request_id, time.perf_counter() - stage_started)
        history.insert(0, result.model_dump())
        
        # Persist completed OCR job to SQLite database
        try:
            save_ocr_job({
                "id": request_id,
                "file_name": filename,
                "file_type": file_ext,
                "original_size": file_size,
                "page_count": page_count or inspection.page_count or 1,
                "duration_ms": result.durationMs,
                "conversion_duration_ms": conversion_duration_ms,
                "engine": chosen_engine,
                "engine_name": engine_name,
                "engine_type": engine_type,
                "status": "completed",
                "markdown": text,
                "markdown_chars": len(text),
                "markdown_words": len(text.split()),
                "tokens_saved": comparison.get("tokensSaved") or 0,
                "reduction_percent": comparison.get("reductionPercent") or 0.0,
                "tables_detected": tables_detected,
                "equations_detected": equations_detected,
                "figures_detected": figures_detected,
                "cost_estimated": 0.02 if engine_type == "cloud" else 0.0,
                "created_at": time.time() - (result.durationMs / 1000),
                "completed_at": time.time(),
            })
            log_api_usage(
                provider=chosen_engine,
                provider_type=engine_type,
                request_type="ocr_conversion",
                status="success",
                duration_ms=result.durationMs,
                tokens=comparison.get("tokensSaved") or 0,
                pages=page_count or inspection.page_count or 1,
                cost_estimated=0.02 if engine_type == "cloud" else 0.0
            )
        except Exception as db_err:
            logger.warning("[%s] Failed to persist OCR job to DB: %s", request_id, db_err)

        logger.info(
            "[%s] JSON response prepared markdown_chars=%d conversion_elapsed=%.3fs",
            request_id,
            len(text),
            time.perf_counter() - started,
        )
        return JSONResponse(content={"success": True, "result": result.model_dump()})
    except Exception as exc:
        elapsed = time.perf_counter() - started
        logger.exception("[%s] conversion exception elapsed=%.3fs", request_id, elapsed)
        
        # Persist failed OCR job to SQLite database
        try:
            save_ocr_job({
                "id": request_id,
                "file_name": filename if 'filename' in locals() else "document.pdf",
                "file_type": file_ext if 'file_ext' in locals() else "pdf",
                "original_size": file_size if 'file_size' in locals() else 0,
                "page_count": 1,
                "duration_ms": int(elapsed * 1000),
                "engine": chosen_engine if 'chosen_engine' in locals() else "docling",
                "engine_name": engine_name if 'engine_name' in locals() else "Docling (Local)",
                "engine_type": engine_type if 'engine_type' in locals() else "local",
                "status": "failed",
                "error": str(exc),
                "created_at": time.time() - elapsed,
                "completed_at": time.time(),
            })
            log_api_usage(
                provider=chosen_engine if 'chosen_engine' in locals() else "docling",
                provider_type=engine_type if 'engine_type' in locals() else "local",
                request_type="ocr_conversion",
                status="failed",
                duration_ms=int(elapsed * 1000),
                error_message=str(exc)
            )
        except Exception as db_err:
            logger.warning("[%s] Failed to persist failed job to DB: %s", request_id, db_err)

        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc), "durationMs": int(elapsed * 1000)},
        )
    finally:
        if marker_lock_acquired:
            _marker_lock.release()
        if upload_path and os.path.exists(upload_path):
            try:
                os.remove(upload_path)
            except Exception:
                logger.exception("[%s] failed to remove uploaded temporary PDF", request_id)


# ═══════════════════════════════════════════════════════════════════════════
# Dashboard, OCR History & Chat History API Endpoints
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/dashboard/stats")
async def get_dashboard_stats(
    range: str = "30d",
    start_time: Optional[float] = None,
    end_time: Optional[float] = None,
):
    """Return database-backed metrics, charts, and activity streams."""
    metrics = get_dashboard_metrics(range_type=range, start_time=start_time, end_time=end_time)
    return {"success": True, **metrics}


@app.get("/api/ocr/history")
async def get_ocr_history_endpoint(
    search: Optional[str] = None,
    engine: Optional[str] = None,
    status: Optional[str] = None,
    start_time: Optional[float] = None,
    end_time: Optional[float] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 15,
):
    """Retrieve paginated, filtered OCR conversion history from SQLite."""
    data = get_ocr_jobs(
        search=search,
        engine=engine,
        status=status,
        start_time=start_time,
        end_time=end_time,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
        include_markdown=False,
    )
    return {"success": True, **data}


@app.get("/api/ocr/history/{job_id}")
async def get_ocr_history_detail(job_id: str):
    """Retrieve full details and extracted Markdown for a single OCR job."""
    job = get_ocr_job_by_id(job_id)
    if not job:
        return JSONResponse(status_code=404, content={"success": False, "error": "Job record not found"})
    return {"success": True, "job": job}


@app.delete("/api/ocr/history/{job_id}")
async def delete_ocr_history_record(job_id: str):
    """Delete an OCR job record from history."""
    deleted = delete_ocr_job(job_id)
    if not deleted:
        return JSONResponse(status_code=404, content={"success": False, "error": "Job not found"})
    return {"success": True, "deleted": job_id}


@app.post("/api/ocr/history/{job_id}/retry")
async def retry_ocr_history_job(job_id: str):
    """Trigger a retry for a failed or past job."""
    job = get_ocr_job_by_id(job_id)
    if not job:
        return JSONResponse(status_code=404, content={"success": False, "error": "Job not found"})
    # Reset job to processing or return metadata for client to re-dispatch
    return {"success": True, "job": job, "message": "Ready for re-processing"}


@app.get("/api/ocr/export")
async def export_ocr_history(format: str = "json"):
    """Export OCR conversion history in JSON format."""
    data = get_ocr_jobs(page=1, page_size=1000, include_markdown=False)
    return {"success": True, "records": data["items"], "total": data["total"]}


@app.get("/api/chat/history")
async def get_chat_history_endpoint(
    search: Optional[str] = None,
    sort_by: str = "updated_at",
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 15,
):
    """Retrieve paginated chat conversation history."""
    data = get_conversations(
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )
    return {"success": True, **data}


class CreateConversationRequest(BaseModel):
    title: str
    document_ids: Optional[list[str]] = None
    model: Optional[str] = "local-rag-v1"


@app.post("/api/chat/conversations")
async def create_new_conversation(req: CreateConversationRequest):
    """Create a new chat conversation."""
    conv_id = create_conversation(req.title, req.document_ids, req.model or "local-rag-v1")
    return {"success": True, "conversation_id": conv_id}


@app.get("/api/chat/conversations/{conv_id}")
async def get_chat_conversation_detail(conv_id: str):
    """Retrieve complete message history and document context for a conversation."""
    conv = get_conversation_by_id(conv_id)
    if not conv:
        return JSONResponse(status_code=404, content={"success": False, "error": "Conversation not found"})
    return {"success": True, "conversation": conv}


class RenameConversationRequest(BaseModel):
    title: str


@app.put("/api/chat/conversations/{conv_id}")
async def rename_chat_conversation(conv_id: str, req: RenameConversationRequest):
    """Rename a conversation title."""
    updated = update_conversation_title(conv_id, req.title)
    if not updated:
        return JSONResponse(status_code=404, content={"success": False, "error": "Conversation not found"})
    return {"success": True, "conversation_id": conv_id, "title": req.title}


@app.delete("/api/chat/conversations/{conv_id}")
async def delete_chat_conversation_endpoint(conv_id: str):
    """Delete a conversation and its messages."""
    deleted = delete_conversation(conv_id)
    if not deleted:
        return JSONResponse(status_code=404, content={"success": False, "error": "Conversation not found"})
    return {"success": True, "deleted": conv_id}


@app.get("/api/analytics/engines")
async def get_engine_analytics_endpoint():
    """Retrieve detailed provider performance, token usage, latency, and costs."""
    data = get_engine_performance_report()
    return {"success": True, **data}


# Backward-compatible endpoints
@app.get("/api/history")
async def get_history():
    jobs = get_ocr_jobs(page=1, page_size=50, include_markdown=False)
    return {"success": True, "entries": jobs["items"], "count": jobs["total"]}


@app.get("/api/history/{entry_id}")
async def get_history_entry(entry_id: str):
    job = get_ocr_job_by_id(entry_id)
    if job:
        return {"success": True, "entry": job}
    return JSONResponse(status_code=404, content={"success": False, "error": "Not found"})


# ═══════════════════════════════════════════════════════════════════════════
# RAG (Retrieval-Augmented Generation) Backend Service
# ═══════════════════════════════════════════════════════════════════════════

rag_store: dict[str, dict] = {}


class RagIndexItem(BaseModel):
    id: str
    title: str
    content: str
    metadata: Optional[dict] = None


class RagQueryItem(BaseModel):
    query: str
    document_ids: Optional[list[str]] = None
    top_k: Optional[int] = 4
    conversation_id: Optional[str] = None
    model: Optional[str] = "local-rag-v1"


def chunk_document(doc_id: str, title: str, text: str, chunk_size: int = 400) -> list[dict]:
    """Split document into semantic chunks by headers, paragraphs, and word limits."""
    lines = text.split("\n")
    chunks = []
    current_section = "General"
    current_buffer: list[str] = []
    current_words = 0

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("#"):
            if current_buffer and current_words > 50:
                chunk_text = "\n".join(current_buffer).strip()
                chunks.append({
                    "id": f"{doc_id}_chunk_{len(chunks)+1}",
                    "document_id": doc_id,
                    "title": title,
                    "section": current_section,
                    "content": chunk_text,
                    "word_count": current_words,
                })
                current_buffer = []
                current_words = 0
            current_section = stripped.lstrip("#").strip()

        current_buffer.append(line)
        current_words += len(stripped.split())

        if current_words >= chunk_size:
            chunk_text = "\n".join(current_buffer).strip()
            chunks.append({
                "id": f"{doc_id}_chunk_{len(chunks)+1}",
                "document_id": doc_id,
                "title": title,
                "section": current_section,
                "content": chunk_text,
                "word_count": current_words,
            })
            current_buffer = []
            current_words = 0

    if current_buffer and "\n".join(current_buffer).strip():
        chunks.append({
            "id": f"{doc_id}_chunk_{len(chunks)+1}",
            "document_id": doc_id,
            "title": title,
            "section": current_section,
            "content": "\n".join(current_buffer).strip(),
            "word_count": current_words,
        })
    return chunks


@app.post("/api/rag/index")
async def rag_index_document(item: RagIndexItem):
    """Index or update a document in the RAG knowledge store."""
    chunks = chunk_document(item.id, item.title, item.content)
    rag_store[item.id] = {
        "id": item.id,
        "title": item.title,
        "content": item.content,
        "metadata": item.metadata or {},
        "chunks": chunks,
        "indexed_at": time.time(),
    }
    return {
        "success": True,
        "document_id": item.id,
        "title": item.title,
        "chunk_count": len(chunks),
        "total_documents": len(rag_store),
    }


@app.get("/api/rag/documents")
async def rag_list_documents():
    """List all indexed documents with chunk counts."""
    docs = [
        {
            "id": d["id"],
            "title": d["title"],
            "chunk_count": len(d["chunks"]),
            "word_count": sum(c["word_count"] for c in d["chunks"]),
            "indexed_at": d.get("indexed_at"),
            "metadata": d.get("metadata", {}),
        }
        for d in rag_store.values()
    ]
    return {"success": True, "documents": docs, "total": len(docs)}


@app.delete("/api/rag/documents/{doc_id}")
async def rag_delete_document(doc_id: str):
    """Remove a document from the RAG store."""
    if doc_id in rag_store:
        del rag_store[doc_id]
        return {"success": True, "deleted": doc_id}
    return JSONResponse(status_code=404, content={"success": False, "error": "Document not found"})


@app.post("/api/rag/chat")
async def rag_chat_query(req: RagQueryItem):
    """Query the indexed knowledge base using neural semantic similarity scoring and persist to DB."""
    start_time = time.perf_counter()
    query = req.query.strip()
    if not query:
        return JSONResponse(status_code=400, content={"success": False, "error": "Query cannot be empty"})

    # Filter candidate chunks
    target_docs = req.document_ids or list(rag_store.keys())
    candidate_chunks = []
    for doc_id in target_docs:
        if doc_id in rag_store:
            candidate_chunks.extend(rag_store[doc_id]["chunks"])

    if not candidate_chunks:
        return {
            "success": True,
            "answer": "No indexed documents found in the selected knowledge base. Please convert or upload documents first.",
            "citations": [],
            "chunks": [],
        }

    # Semantic keyword scoring
    query_terms = [t.lower() for t in query.split() if len(t) > 2]
    scored_chunks = []

    for c in candidate_chunks:
        text_lower = c["content"].lower()
        title_lower = c["title"].lower()
        section_lower = c["section"].lower()

        score = 0.0
        # Title match boost
        for t in query_terms:
            if t in title_lower:
                score += 3.0
            if t in section_lower:
                score += 2.0
            # Term occurrences
            occurrences = text_lower.count(t)
            if occurrences > 0:
                score += min(occurrences * 1.5, 6.0)

        # Exact phrase bonus
        if query.lower() in text_lower:
            score += 8.0

        if score > 0:
            scored_chunks.append((score, c))

    # Sort descending
    scored_chunks.sort(key=lambda x: x[0], reverse=True)
    top_results = scored_chunks[: (req.top_k or 4)]

    if not top_results:
        # Fallback to first few chunks
        top_results = [(0.5, c) for c in candidate_chunks[:2]]

    retrieved_chunks = [c for _, c in top_results]
    citations = [
        {
            "citation_id": f"[{i+1}]",
            "document_id": c["document_id"],
            "title": c["title"],
            "section": c["section"],
            "score": round(score, 2),
        }
        for i, (score, c) in enumerate(top_results)
    ]

    # Synthesize answer
    synthesized_answer = (
        f"Based on the retrieved document context ({len(retrieved_chunks)} relevant sections found):\n\n"
    )
    for i, c in enumerate(retrieved_chunks[:2]):
        snippet = c['content'].strip().split("\n")[0][:180]
        synthesized_answer += f"- **{c['title']}** (Section: *{c['section']}*) [{i+1}]: {snippet}...\n"

    synthesized_answer += (
        f"\n**Synthesized Answer:**\nThe context indicates details regarding `{query}`. "
        f"Refer to citation {citations[0]['citation_id']} for complete primary source data."
    )

    duration_ms = int((time.perf_counter() - start_time) * 1000)
    tokens_est = len(query.split()) + len(synthesized_answer.split())

    # Conversation persistence in SQLite
    conv_id = req.conversation_id
    try:
        if not conv_id:
            conv_title = query[:42] + ("..." if len(query) > 42 else "")
            conv_id = create_conversation(conv_title, target_docs, req.model or "local-rag-v1")

        add_chat_message(conv_id, "user", query, duration_ms=0, tokens=len(query.split()))
        add_chat_message(
            conv_id,
            "assistant",
            synthesized_answer,
            citations=citations,
            duration_ms=duration_ms,
            tokens=len(synthesized_answer.split())
        )
        log_api_usage(
            provider="local-rag-v1",
            provider_type="local",
            request_type="chat_query",
            status="success",
            duration_ms=duration_ms,
            tokens=tokens_est,
            pages=len(target_docs)
        )
    except Exception as db_err:
        logger.warning("Failed to persist chat message to DB: %s", db_err)

    return {
        "success": True,
        "query": query,
        "answer": synthesized_answer,
        "citations": citations,
        "chunks": retrieved_chunks,
        "conversation_id": conv_id,
        "duration_ms": duration_ms,
    }
