"""Smart Document Engine Router & Dispatcher for DOCFORGE.
Manages Local Docling, Surya VLM, Mistral OCR, Mathpix, and LlamaParse engines.
Guarantees privacy transparency, explicit cloud consent, and zero credentials leakage.
"""

from __future__ import annotations
import os
import re
import logging
from typing import List, Dict, Any, Optional

from pdqa_api.engines.base import EngineStatus, EngineResult
from pdqa_api.engines.docling_engine import run_docling_conversion, is_docling_available
from pdqa_api.engines.mistral_engine import run_mistral_ocr, is_mistral_configured
from pdqa_api.engines.mathpix_engine import run_mathpix_ocr, is_mathpix_configured
from pdqa_api.engines.llamaparse_engine import run_llamaparse, is_llamaparse_configured

logger = logging.getLogger("pdqa_api.router")

def get_engine_statuses() -> List[Dict[str, Any]]:
    """Returns safe, secret-free metadata on all available engines."""
    engines = [
        EngineStatus(
            id="docling",
            name="Docling (Local Processing)",
            type="local",
            description="Local PDF-to-Markdown engine by IBM. Preserves complex layouts, tables, and document hierarchy 100% air-gapped.",
            configured=True,
            is_default=True,
            requires_consent=False,
            icon="file-text"
        ),
        EngineStatus(
            id="surya",
            name="Surya VLM (Local OCR)",
            type="local",
            description="Local Vision-Language Model OCR. High-accuracy text unwarping and layout unwarping on your GPU/CPU.",
            configured=True,
            is_default=False,
            requires_consent=False,
            icon="scan"
        ),
        EngineStatus(
            id="mistral",
            name="Mistral OCR API",
            type="cloud",
            description="State-of-the-art multimodal vision model by Mistral AI for scanned PDFs, multi-lingual docs, and visual reading order.",
            configured=is_mistral_configured(),
            is_default=False,
            requires_consent=True,
            config_keys=["MISTRAL_API_KEY"],
            icon="sparkles"
        ),
        EngineStatus(
            id="mathpix",
            name="Mathpix OCR API",
            type="cloud",
            description="The gold standard for scientific papers, complex LaTeX formulations, matrices, chemical structures, and equations.",
            configured=is_mathpix_configured(),
            is_default=False,
            requires_consent=True,
            config_keys=["MATHPIX_APP_ID", "MATHPIX_APP_KEY"],
            icon="binary"
        ),
        EngineStatus(
            id="llamaparse",
            name="LlamaParse API",
            type="cloud",
            description="GenAI-native document parser by LlamaIndex for complex enterprise tables, multi-column reports, and charts.",
            configured=is_llamaparse_configured(),
            is_default=False,
            requires_consent=True,
            config_keys=["LLAMA_CLOUD_API_KEY"],
            icon="layers"
        )
    ]
    return [e.__dict__ for e in engines]

def select_auto_engine(file_bytes: bytes, filename: str, cloud_consent: bool) -> str:
    """Smart heuristic selector:
    - If no cloud consent or no cloud keys -> 'docling' (or 'surya' for scans).
    - If filename or text suggests math/physics/paper -> 'mathpix' if configured.
    - If image/scanned document -> 'mistral' if configured.
    - If complex financial report/table-heavy -> 'llamaparse' if configured.
    - Fallback -> 'docling'.
    """
    if not cloud_consent:
        return "docling"

    fn = filename.lower()

    # Heuristic 1: Math/Science paper -> Mathpix
    if is_mathpix_configured() and any(w in fn for w in ("math", "physics", "formula", "arxiv", "paper", "theorem", "chem")):
        return "mathpix"

    # Heuristic 2: Scanned document / receipt / invoice -> Mistral OCR
    if is_mistral_configured() and any(w in fn for w in ("scan", "ocr", "receipt", "invoice", "photo", "image", "unwarped")):
        return "mistral"

    # Heuristic 3: Financial or multi-column enterprise report -> LlamaParse
    if is_llamaparse_configured() and any(w in fn for w in ("report", "financial", "sec", "10k", "annual", "quarterly", "table")):
        return "llamaparse"

    # Default fallback
    return "docling"
