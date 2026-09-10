"""
DOOH Advertisement Detection, Multilingual OCR, Playback Tracking,
and Playlist Cycle Detection Engine.
"""

from .config import settings, AdIntelligenceConfig
from .models import (
    AdDetectionState,
    BillboardROI,
    AdCreative,
    AdPlayEvent,
    AdCycleSummary,
    TrafficExposureMetrics,
    AdCreativeAnalytics,
    AdDailySummary
)
from .change_detector import VisualChangeDetector, ChangeDetectionResult
from .ocr import AdvertisementOCR, TextNormalizer
from .creative_matcher import CreativeMatcher
from .event_tracker import AdEventTracker
from .cycle_detector import PlaylistCycleDetector
from .storage import EvidenceStorageManager
from .traffic_integrator import TrafficIntegrator
from .detector import BillboardAdDetector
from .service import AdIntelligenceService
from .api import router as ad_router

__all__ = [
    "settings",
    "AdIntelligenceConfig",
    "AdDetectionState",
    "BillboardROI",
    "AdCreative",
    "AdPlayEvent",
    "AdCycleSummary",
    "TrafficExposureMetrics",
    "AdCreativeAnalytics",
    "AdDailySummary",
    "VisualChangeDetector",
    "ChangeDetectionResult",
    "AdvertisementOCR",
    "TextNormalizer",
    "CreativeMatcher",
    "AdEventTracker",
    "PlaylistCycleDetector",
    "EvidenceStorageManager",
    "TrafficIntegrator",
    "BillboardAdDetector",
    "AdIntelligenceService",
    "ad_router",
]
