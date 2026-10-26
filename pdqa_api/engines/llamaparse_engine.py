"""LlamaParse Engine Adapter for DOCFORGE.
Official API Documentation: https://developers.llamaindex.ai/llamaparse/parse/getting_started/
Endpoint: https://api.cloud.llamaindex.ai/api/v1/parsing/upload
Specialized in complex enterprise PDFs, tables, layouts, and agentic multi-column extraction.
"""

from __future__ import annotations
import os
import json
import time
import re
import uuid
import urllib.request
import urllib.error
import logging
from pdqa_api.engines.base import EngineResult

logger = logging.getLogger("pdqa_api.llamaparse")

def is_llamaparse_configured() -> bool:
    return bool(os.getenv("LLAMA_CLOUD_API_KEY"))

def run_llamaparse(file_bytes: bytes, filename: str) -> EngineResult:
    api_key = os.getenv("LLAMA_CLOUD_API_KEY")
    if not api_key:
        raise ValueError(
            "LlamaParse requires LLAMA_CLOUD_API_KEY environment variable. "
            "Please configure it in the DOCFORGE Engine Settings or backend .env file."
        )

    started = time.perf_counter()
    boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"

    # Construct multipart/form-data payload
    body_parts = []
    body_parts.append(f"--{boundary}\r\n".encode("utf-8"))
    body_parts.append(
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f'Content-Type: application/pdf\r\n\r\n'.encode("utf-8")
    )
    body_parts.append(file_bytes)
    body_parts.append(b"\r\n")

    # Options (result_type: markdown)
    body_parts.append(f"--{boundary}\r\n".encode("utf-8"))
    body_parts.append(
        b'Content-Disposition: form-data; name="result_type"\r\n\r\nmarkdown\r\n'
    )
    body_parts.append(f"--{boundary}--\r\n".encode("utf-8"))

    payload = b"".join(body_parts)

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Accept": "application/json",
        "User-Agent": "DocForge-LlamaParse/2.0"
    }

    # 1. Upload Document Job
    req = urllib.request.Request(
        "https://api.cloud.llamaindex.ai/api/v1/parsing/upload",
        data=payload,
        headers=headers,
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_msg = e.read().decode("utf-8")
        logger.error("LlamaParse upload error %s: %s", e.code, error_msg)
        raise RuntimeError(f"LlamaParse API Error ({e.code}): {error_msg}")
    except Exception as e:
        logger.exception("LlamaParse connection error: %s", e)
        raise RuntimeError(f"LlamaParse Connection Error: {str(e)}")

    job_id = data.get("id")
    if not job_id:
        raise RuntimeError(f"LlamaParse did not return a valid job id: {data}")

    # 2. Poll status until SUCCESS
    max_wait = 150
    poll_interval = 3.0
    poll_elapsed = 0
    status = "PENDING"

    while status not in ("SUCCESS", "ERROR") and poll_elapsed < max_wait:
        time.sleep(poll_interval)
        poll_elapsed += poll_interval
        job_req = urllib.request.Request(
            f"https://api.cloud.llamaindex.ai/api/v1/parsing/job/{job_id}",
            headers={"Authorization": f"Bearer {api_key.strip()}", "Accept": "application/json"},
            method="GET"
        )
        try:
            with urllib.request.urlopen(job_req, timeout=30) as resp:
                job_data = json.loads(resp.read().decode("utf-8"))
                status = job_data.get("status", "PENDING")
        except Exception as e:
            logger.warning("LlamaParse polling warning: %s", e)

    if status != "SUCCESS":
        raise RuntimeError(f"LlamaParse job failed or timed out (status: {status})")

    # 3. Retrieve Markdown output
    result_req = urllib.request.Request(
        f"https://api.cloud.llamaindex.ai/api/v1/parsing/job/{job_id}/result/markdown",
        headers={"Authorization": f"Bearer {api_key.strip()}", "Accept": "application/json"},
        method="GET"
    )
    with urllib.request.urlopen(result_req, timeout=30) as resp:
        result_data = json.loads(resp.read().decode("utf-8"))
        markdown = result_data.get("markdown", "")

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
        engine_id="llamaparse",
        engine_name="LlamaParse Cloud API",
        engine_type="cloud",
        duration_ms=elapsed_ms,
        tables_detected=tables_detected,
        equations_detected=equations_detected,
        figures_detected=figures_detected,
        tokens_saved=tokens_saved,
        reduction_percent=reduction_pct,
        raw_metadata={"job_id": job_id, "provider": "LlamaIndex Cloud"}
    )
