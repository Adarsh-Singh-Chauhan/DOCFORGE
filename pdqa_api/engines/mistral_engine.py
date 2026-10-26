"""Mistral OCR Engine Adapter for DOCFORGE.
Official API Documentation: https://docs.mistral.ai/api/endpoint/ocr
Endpoint: https://api.mistral.ai/v1/ocr
Specialized in scanned PDFs, image-based documents, multilingual text, and document structure.
"""

from __future__ import annotations
import os
import json
import base64
import time
import re
import urllib.request
import urllib.error
import logging
from pdqa_api.engines.base import EngineResult

logger = logging.getLogger("pdqa_api.mistral")

def is_mistral_configured() -> bool:
    return bool(os.getenv("MISTRAL_API_KEY"))

def run_mistral_ocr(file_bytes: bytes, filename: str) -> EngineResult:
    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        raise ValueError(
            "Mistral OCR requires MISTRAL_API_KEY environment variable. "
            "Please configure it in the DOCFORGE Engine Settings or backend .env file."
        )

    started = time.perf_counter()
    b64_doc = base64.b64encode(file_bytes).decode("utf-8")
    mime_type = "application/pdf"
    if filename.lower().endswith((".png", ".jpg", ".jpeg")):
        mime_type = "image/png" if filename.lower().endswith(".png") else "image/jpeg"

    payload = {
        "model": "mistral-ocr-latest",
        "document": {
            "type": "document_url",
            "document_url": f"data:{mime_type};base64,{b64_doc}"
        },
        "include_image_base64": False
    }

    req = urllib.request.Request(
        "https://api.mistral.ai/v1/ocr",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key.strip()}",
            "Content-Type": "application/json",
            "User-Agent": "DocForge-OCR/2.0"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_msg = e.read().decode("utf-8")
        logger.error("Mistral OCR API error %s: %s", e.code, error_msg)
        raise RuntimeError(f"Mistral OCR API Error ({e.code}): {error_msg}")
    except Exception as e:
        logger.exception("Mistral OCR network error: %s", e)
        raise RuntimeError(f"Mistral OCR Connection Error: {str(e)}")

    pages = data.get("pages", [])
    markdown_parts = []
    for i, p in enumerate(pages):
        page_md = p.get("markdown", "").strip()
        if page_md:
            markdown_parts.append(page_md)

    markdown = "\n\n---\n\n".join(markdown_parts) if markdown_parts else "# Extracted Content\n\nNo text detected."
    elapsed_ms = int((time.perf_counter() - started) * 1000)

    tables_detected = len(re.findall(r"\|.*?\|.*?\|", markdown))
    equations_detected = len(re.findall(r"\$\$.*?\$\$|\$.*?\$", markdown, re.DOTALL))
    figures_detected = len(re.findall(r"!\[.*?\]\(.*?\)", markdown))

    raw_tokens = max(1, len(file_bytes) // 4)
    md_tokens = max(1, len(markdown) // 4)
    tokens_saved = max(0, raw_tokens - md_tokens)
    reduction_pct = round((tokens_saved / raw_tokens) * 100, 1)

    return EngineResult(
        markdown=markdown,
        page_count=len(pages) or 1,
        engine_id="mistral",
        engine_name="Mistral OCR API",
        engine_type="cloud",
        duration_ms=elapsed_ms,
        tables_detected=tables_detected,
        equations_detected=equations_detected,
        figures_detected=figures_detected,
        tokens_saved=tokens_saved,
        reduction_percent=reduction_pct,
        raw_metadata={"model": "mistral-ocr-latest", "provider": "Mistral AI", "pages_processed": len(pages)}
    )
