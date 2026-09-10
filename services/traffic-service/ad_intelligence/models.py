"""
Domain and Data Models for DOOH Advertisement Intelligence.
"""

from enum import Enum
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone
import uuid
import numpy as np
from pydantic import BaseModel, Field


class AdDetectionState(str, Enum):
    NO_AD = "NO_AD"
    AD_STABLE = "AD_STABLE"
    POSSIBLE_CHANGE = "POSSIBLE_CHANGE"
    CHANGE_CONFIRMED = "CHANGE_CONFIRMED"
    IDENTIFYING_AD = "IDENTIFYING_AD"
    AD_CONFIRMED = "AD_CONFIRMED"


class BillboardROI(BaseModel):
    x1: float = Field(default=0.0, description="Top-left X (0.0-1.0 or pixel)")
    y1: float = Field(default=0.0, description="Top-left Y (0.0-1.0 or pixel)")
    x2: float = Field(default=1.0, description="Bottom-right X (0.0-1.0 or pixel)")
    y2: float = Field(default=1.0, description="Bottom-right Y (0.0-1.0 or pixel)")

    def crop(self, frame: np.ndarray) -> np.ndarray:
        """Crops frame according to ROI coordinates."""
        if frame is None or frame.size == 0:
            return frame
        h, w = frame.shape[:2]

        # Check if coordinates are normalized [0.0 - 1.0]
        if self.x1 <= 1.0 and self.y1 <= 1.0 and self.x2 <= 1.0 and self.y2 <= 1.0:
            px1 = max(0, min(w, int(self.x1 * w)))
            py1 = max(0, min(h, int(self.y1 * h)))
            px2 = max(0, min(w, int(self.x2 * w)))
            py2 = max(0, min(h, int(self.y2 * h)))
        else:
            # Absolute pixel coordinates
            px1 = max(0, min(w, int(self.x1)))
            py1 = max(0, min(h, int(self.y1)))
            px2 = max(0, min(w, int(self.x2)))
            py2 = max(0, min(h, int(self.y2)))

        if px2 <= px1 or py2 <= py1:
            return frame

        return frame[py1:py2, px1:px2]


class AdCreative(BaseModel):
    creative_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    billboard_id: str
    brand_name: Optional[str] = "Unknown Brand"
    ad_name: Optional[str] = "Advertisement Creative"
    raw_ocr_text: Optional[str] = ""
    normalized_ocr_text: Optional[str] = ""
    visual_hash: Optional[str] = ""
    embedding_id: Optional[str] = None
    representative_image_url: Optional[str] = None
    first_seen_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_seen_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AdPlayEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    billboard_id: str
    creative_id: Optional[str] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    detection_confidence: float = 1.0
    ocr_confidence: float = 0.0
    evidence_image_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AdCycleSummary(BaseModel):
    cycle_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    billboard_id: str
    cycle_start_at: datetime
    cycle_end_at: datetime
    cycle_duration_seconds: float
    total_ads: int
    creative_sequence: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TrafficExposureMetrics(BaseModel):
    event_id: str
    billboard_id: str
    creative_id: Optional[str] = None
    brand_name: Optional[str] = None
    ad_name: Optional[str] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_seconds: float
    total_vehicles: int = 0
    cars_exposure: int = 0
    bikes_exposure: int = 0
    buses_exposure: int = 0
    trucks_exposure: int = 0
    commercial_exposure: int = 0
    estimated_reach: int = 0
    avg_exposure_time: float = 0.0


class AdCreativeAnalytics(BaseModel):
    creative_id: str
    billboard_id: str
    brand_name: str
    ad_name: str
    play_count: int
    total_duration_seconds: float
    average_duration_seconds: float
    first_seen: str
    last_seen: str
    representative_image_url: Optional[str] = None
    raw_ocr_text: Optional[str] = None


class AdDailySummary(BaseModel):
    billboard_id: str
    date: str
    total_ads_detected: int
    unique_creatives: int
    total_playbacks: int
    total_screen_time_seconds: float
    average_ad_duration_seconds: float
    cycle_count: int
    average_cycle_duration_seconds: float
    creatives: List[AdCreativeAnalytics] = Field(default_factory=list)
    recent_events: List[Dict[str, Any]] = Field(default_factory=list)
