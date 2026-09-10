"""
Configuration module for DOOH Advertisement Intelligence, OCR, Playback Tracking, and Cycle Detection.
"""

import os
from pathlib import Path
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Try loading environment from multiple possible locations
_potential_envs = [
    Path(__file__).resolve().parent / ".env",
    Path(__file__).resolve().parent.parent / ".env",
    Path("E:/Aculion/site/aculion-site-main/aculion-platform/services/.env"),
    Path("E:/Aculion/.env"),
]
for p in _potential_envs:
    if p.exists():
        load_dotenv(p)
        break


class AdIntelligenceConfig(BaseModel):
    # Video & Sampling Configuration
    FRAME_SAMPLE_INTERVAL: float = Field(default=0.5, description="Seconds between frame samples (e.g. 0.5s = 2fps)")
    DEFAULT_FPS: float = Field(default=15.0, description="Default FPS for video streams if undetectable")
    
    # Change Detection Thresholds
    CHANGE_THRESHOLD: float = Field(default=0.28, description="Visual difference score to trigger potential ad change [0.0 - 1.0]")
    CHANGE_CONFIRMATION_FRAMES: int = Field(default=3, description="Consecutive stable frames to confirm transition")
    ANIMATION_MAX_VARIANCE: float = Field(default=0.18, description="Max variance threshold for internal ad animations")
    
    # OCR Settings
    OCR_CONFIDENCE_THRESHOLD: float = Field(default=0.25, description="Minimum confidence score for individual OCR text region")
    OCR_LANGUAGES: list = Field(default=["en", "ta"], description="Supported OCR languages (English, Tamil, etc.)")
    USE_GPU: Optional[bool] = Field(default=None, description="Enable GPU for OCR if available")
    
    # Creative Matching & Deduplication
    CREATIVE_MATCH_THRESHOLD: float = Field(default=0.72, description="Combined text & visual similarity score to match existing creative [0.0 - 1.0]")
    TEXT_SIMILARITY_WEIGHT: float = Field(default=0.45, description="Weight of OCR text similarity in creative matching")
    VISUAL_SIMILARITY_WEIGHT: float = Field(default=0.55, description="Weight of perceptual visual hash similarity")
    
    # Playback Duration Constraints
    MIN_AD_DURATION_SECONDS: float = Field(default=3.0, description="Minimum valid ad playback duration to filter camera noise")
    MAX_AD_DURATION_SECONDS: float = Field(default=300.0, description="Maximum single ad playback duration")
    
    # Cycle / Playlist Detection
    CYCLE_MATCH_THRESHOLD: float = Field(default=0.80, description="Sequence similarity threshold to declare a completed playlist cycle")
    MIN_CYCLE_ADS: int = Field(default=2, description="Minimum number of ads in a repeating cycle")
    MAX_CYCLE_LOOKBACK: int = Field(default=100, description="Number of recent play events to keep in cycle search window")
    
    # Billboard Default Region of Interest (Normalized [0.0, 1.0] or absolute pixels)
    BILLBOARD_ROI: Dict[str, float] = Field(
        default_factory=lambda: {"x1": 0.0, "y1": 0.0, "x2": 1.0, "y2": 1.0},
        description="Billboard Region of Interest (ROI) box"
    )
    
    # Supabase Configuration
    SUPABASE_URL: str = Field(
        default_factory=lambda: os.getenv("SUPABASE_URL", "https://buqtshfptmqieaqcghfx.supabase.co")
    )
    SUPABASE_KEY: str = Field(
        default_factory=lambda: os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1cXRzaGZwdG1xaWVhcWNnaGZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzkwOTYyMiwiZXhwIjoyMDk5NDg1NjIyfQ.f12uC9oK_BzLzlXgy_5ybUAgdHJTY6N7E5VWXXmgr5Q")
    )
    DATABASE_URL: str = Field(
        default_factory=lambda: os.getenv("DATABASE_URL", "postgresql://postgres.buqtshfptmqieaqcghfx:Aculion%402025@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require")
    )
    STORAGE_BUCKET: str = Field(default="ad-evidence", description="Supabase Storage bucket for ad snapshots")
    
    # Local Storage Fallback
    EVIDENCE_LOCAL_DIR: str = Field(
        default_factory=lambda: os.path.join(os.path.dirname(__file__), "evidence_cache")
    )


# Singleton instance
settings = AdIntelligenceConfig()
