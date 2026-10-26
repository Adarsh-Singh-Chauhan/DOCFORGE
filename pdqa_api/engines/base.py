"""Base definitions for DOCFORGE document parsing engines."""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional, Literal, Dict, Any

EngineType = Literal["local", "cloud"]

@dataclass
class EngineStatus:
    id: str
    name: str
    type: EngineType
    description: str
    configured: bool
    is_default: bool = False
    requires_consent: bool = False
    config_keys: list[str] = field(default_factory=list)
    icon: str = "cpu"

@dataclass
class EngineResult:
    markdown: str
    page_count: int
    engine_id: str
    engine_name: str
    engine_type: EngineType
    duration_ms: int
    tables_detected: int = 0
    equations_detected: int = 0
    figures_detected: int = 0
    tokens_saved: int = 0
    reduction_percent: float = 0.0
    raw_metadata: Dict[str, Any] = field(default_factory=dict)
    warning: Optional[str] = None
