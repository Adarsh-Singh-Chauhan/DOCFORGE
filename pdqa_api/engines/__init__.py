"""DOCFORGE Document Intelligence Engines Package."""

from pdqa_api.engines.base import EngineResult, EngineStatus
from pdqa_api.engines.router import get_engine_statuses, select_auto_engine
from pdqa_api.engines.docling_engine import run_docling_conversion, run_image_ocr_conversion
from pdqa_api.engines.mistral_engine import run_mistral_ocr, is_mistral_configured
from pdqa_api.engines.mathpix_engine import run_mathpix_ocr, is_mathpix_configured
from pdqa_api.engines.llamaparse_engine import run_llamaparse, is_llamaparse_configured

__all__ = [
    "EngineResult",
    "EngineStatus",
    "get_engine_statuses",
    "select_auto_engine",
    "run_docling_conversion",
    "run_image_ocr_conversion",
    "run_mistral_ocr",
    "is_mistral_configured",
    "run_mathpix_ocr",
    "is_mathpix_configured",
    "run_llamaparse",
    "is_llamaparse_configured",
]
