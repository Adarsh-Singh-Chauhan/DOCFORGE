"""Mathpix OCR Engine Adapter for DOCFORGE.
Official API Documentation: https://docs.mathpix.com/
Endpoint: https://api.mathpix.com/v3/pdf
Specialized in scientific papers, mathematical equations, LaTeX, chemistry, and technical Markdown.
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

logger = logging.getLogger("pdqa_api.mathpix")

def is_mathpix_configured() -> bool:
    return bool(os.getenv("MATHPIX_APP_ID") and os.getenv("MATHPIX_APP_KEY"))

def run_mathpix_ocr(file_bytes: bytes, filename: str) -> EngineResult:
    app_id = os.getenv("MATHPIX_APP_ID")
    app_key = os.getenv("MATHPIX_APP_KEY")
    if not (app_id and app_key):
        raise ValueError(
            "Mathpix OCR requires MATHPIX_APP_ID and MATHPIX_APP_KEY environment variables. "
            "Please configure them in the DOCFORGE Engine Settings or backend .env file."
        )

    started = time.perf_counter()
    b64_doc = base64.b64encode(file_bytes).decode("utf-8")

    payload = {
        "url": f"data:application/pdf;base64,{b64_doc}",
        "conversion_formats": {
            "md": True
        },
        "math_inline_delimiters": ["$", "$"],
        "math_display_delimiters": ["$$", "$$"]
    }

    headers = {
        "app_id": app_id.strip(),
        "app_key": app_key.strip(),
        "Content-Type": "application/json",
        "User-Agent": "DocForge-Mathpix/2.0"
    }

    # 1. Initiate PDF processing job
    req = urllib.request.Request(
        "https://api.mathpix.com/v3/pdf",
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_msg = e.read().decode("utf-8")
        logger.error("Mathpix API initiation error %s: %s", e.code, error_msg)
        raise RuntimeError(f"Mathpix API Error ({e.code}): {error_msg}")
    except Exception as e:
        logger.exception("Mathpix connection error: %s", e)
        raise RuntimeError(f"Mathpix Connection Error: {str(e)}")

    pdf_id = data.get("pdf_id")
    if not pdf_id:
        raise RuntimeError(f"Mathpix API did not return a valid pdf_id: {data}")

    # 2. Poll status until completed (timeout at 120s)
    max_wait = 120
    poll_interval = 2.5
    poll_elapsed = 0
    status = "processing"

    while status not in ("completed", "error", "split") and poll_elapsed < max_wait:
        time.sleep(poll_interval)
        poll_elapsed += poll_interval
        status_req = urllib.request.Request(
            f"https://api.mathpix.com/v3/pdf/{pdf_id}",
            headers=headers,
            method="GET"
        )
        try:
            with urllib.request.urlopen(status_req, timeout=30) as resp:
                status_data = json.loads(resp.read().decode("utf-8"))
                status = status_data.get("status", "processing")
        except Exception as e:
            logger.warning("Mathpix polling warning: %s", e)

    if status != "completed":
        raise RuntimeError(f"Mathpix processing did not complete successfully (status: {status})")

    # 3. Retrieve final Markdown
    md_req = urllib.request.Request(
        f"https://api.mathpix.com/v3/pdf/{pdf_id}.md",
        headers=headers,
        method="GET"
    )
    with urllib.request.urlopen(md_req, timeout=30) as resp:
        markdown = resp.read().decode("utf-8")

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    tables_detected = len(re.findall(r"\|.*?\|.*?\|", markdown))
    equations_detected = len(re.findall(r"\$\$.*?\$\$|\$.*?\$", markdown, re.DOTALL))
    figures_detected = len(re.findall(r"!\[.*?\]\(.*?\)", markdown))
    page_count = max(1, len(markdown.split("---")))

    raw_tokens = max(1, len(file_bytes) // 4)
    md_tokens = max(1, len(markdown) // 4)
    tokens_saved = max(0, raw_tokens - md_tokens)
    reduction_pct = round((tokens_saved / raw_tokens) * 100, 1)

    return EngineResult(
        markdown=markdown,
        page_count=page_count,
        engine_id="mathpix",
        engine_name="Mathpix OCR API",
        engine_type="cloud",
        duration_ms=elapsed_ms,
        tables_detected=tables_detected,
        equations_detected=equations_detected,
        figures_detected=figures_detected,
        tokens_saved=tokens_saved,
        reduction_percent=reduction_pct,
        raw_metadata={"pdf_id": pdf_id, "provider": "Mathpix Inc."}
    )
