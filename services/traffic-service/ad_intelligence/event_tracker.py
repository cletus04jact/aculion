"""
Advertisement Playback Event Tracker & Supabase Persistence Engine.
Tracks real-time ad lifecycles, calculates true durations, closes completed events,
and syncs data with Supabase.
"""

import logging
from typing import Optional, List, Dict, Any, Callable
from datetime import datetime, timezone
import psycopg2
from psycopg2.extras import RealDictCursor
from supabase import create_client, Client

from .models import AdPlayEvent, AdCreative, AdCycleSummary, TrafficExposureMetrics
from .config import settings
from .traffic_integrator import TrafficIntegrator

logger = logging.getLogger("AdIntelligence.EventTracker")


class AdEventTracker:
    """
    Manages active playback sessions, closes completed play events,
    persists events into Supabase, and correlates traffic metrics.
    """

    def __init__(
        self,
        billboard_id: str,
        supabase_url: str = settings.SUPABASE_URL,
        supabase_key: str = settings.SUPABASE_KEY,
        database_url: str = settings.DATABASE_URL,
        min_duration: float = settings.MIN_AD_DURATION_SECONDS
    ):
        self.billboard_id = billboard_id
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.database_url = database_url
        self.min_duration = min_duration

        self.current_event: Optional[AdPlayEvent] = None
        self.current_creative: Optional[AdCreative] = None
        self.completed_events: List[AdPlayEvent] = []
        self.listeners: List[Callable[[AdPlayEvent], None]] = []

        self.traffic_integrator = TrafficIntegrator(
            supabase_url=self.supabase_url,
            supabase_key=self.supabase_key,
            database_url=self.database_url
        )

        self._supabase_client: Optional[Client] = None
        if self.supabase_url and self.supabase_key:
            try:
                self._supabase_client = create_client(self.supabase_url, self.supabase_key)
            except Exception as e:
                logger.warning(f"Failed to init Supabase client in AdEventTracker: {e}")

    def add_event_listener(self, callback: Callable[[AdPlayEvent], None]):
        self.listeners.append(callback)

    def start_ad_play(
        self,
        creative: AdCreative,
        detection_confidence: float = 1.0,
        ocr_confidence: float = 0.0,
        evidence_image_url: Optional[str] = None,
        timestamp: Optional[datetime] = None
    ) -> AdPlayEvent:
        """
        Starts a new advertisement playback session.
        If an ad is currently playing, finishes and closes it first.
        """
        now = timestamp or datetime.now(timezone.utc)

        # 1. Close current active event if exists
        if self.current_event is not None:
            self.finish_ad_play(timestamp=now)

        # 2. Start new event
        new_event = AdPlayEvent(
            billboard_id=self.billboard_id,
            creative_id=creative.creative_id,
            started_at=now,
            detection_confidence=round(detection_confidence, 4),
            ocr_confidence=round(ocr_confidence, 4),
            evidence_image_url=evidence_image_url,
            created_at=now
        )
        self.current_event = new_event
        self.current_creative = creative

        logger.info(
            f"AD_PLAY_STARTED: Billboard '{self.billboard_id}' started playing "
            f"creative '{creative.ad_name}' (ID: {creative.creative_id}) at {now.isoformat()}"
        )

        # Save creative in DB if new/updated
        self._persist_creative(creative)

        return new_event

    def finish_ad_play(self, timestamp: Optional[datetime] = None) -> Optional[AdPlayEvent]:
        """
        Closes the currently active ad playback event, computes actual duration,
        persists to Supabase, and notifies listeners.
        """
        if self.current_event is None:
            return None

        now = timestamp or datetime.now(timezone.utc)
        event = self.current_event
        event.ended_at = now
        
        # Calculate real observed duration
        duration = (now - event.started_at).total_seconds()
        event.duration_seconds = round(max(0.1, duration), 2)

        # Filter out negligible jitter/glitches (< MIN_AD_DURATION_SECONDS)
        if event.duration_seconds < self.min_duration:
            logger.warning(
                f"Ad playback duration ({event.duration_seconds:.2f}s) below minimum "
                f"threshold ({self.min_duration}s). Discarding noise event."
            )
            self.current_event = None
            self.current_creative = None
            return None

        logger.info(
            f"AD_PLAY_ENDED: Billboard '{self.billboard_id}' finished creative "
            f"(ID: {event.creative_id}) duration={event.duration_seconds:.2f}s"
        )

        self.completed_events.append(event)
        self.current_event = None
        current_c = self.current_creative
        self.current_creative = None

        # Correlate traffic
        traffic = self.traffic_integrator.correlate_playback_with_traffic(
            event=event,
            brand_name=current_c.brand_name if current_c else "Brand Ad",
            ad_name=current_c.ad_name if current_c else "Digital Creative"
        )

        # Persist event to Supabase
        self._persist_event(event)

        # Notify callbacks
        for listener in self.listeners:
            try:
                listener(event)
            except Exception as e:
                logger.error(f"Error in ad event listener: {e}")

        return event

    def _persist_creative(self, creative: AdCreative):
        """Upserts ad_creative_master row in Supabase."""
        try:
            if self._supabase_client:
                data = {
                    "creative_id": creative.creative_id,
                    "billboard_id": creative.billboard_id,
                    "brand_name": creative.brand_name,
                    "ad_name": creative.ad_name,
                    "raw_ocr_text": creative.raw_ocr_text,
                    "normalized_ocr_text": creative.normalized_ocr_text,
                    "visual_hash": creative.visual_hash,
                    "representative_image_url": creative.representative_image_url,
                    "first_seen_at": creative.first_seen_at.isoformat(),
                    "last_seen_at": creative.last_seen_at.isoformat()
                }
                self._supabase_client.table("ad_creative_master").upsert(data).execute()
        except Exception as e:
            logger.warning(f"Error persisting creative {creative.creative_id} to Supabase: {e}")

    def _persist_event(self, event: AdPlayEvent):
        """Inserts ad_play_events row in Supabase."""
        try:
            if self._supabase_client:
                data = {
                    "event_id": event.event_id,
                    "billboard_id": event.billboard_id,
                    "creative_id": event.creative_id,
                    "started_at": event.started_at.isoformat(),
                    "ended_at": event.ended_at.isoformat() if event.ended_at else None,
                    "duration_seconds": event.duration_seconds,
                    "detection_confidence": event.detection_confidence,
                    "ocr_confidence": event.ocr_confidence,
                    "evidence_image_url": event.evidence_image_url
                }
                self._supabase_client.table("ad_play_events").insert(data).execute()
        except Exception as e:
            logger.warning(f"Error persisting play event {event.event_id} to Supabase: {e}")

    def persist_cycle(self, cycle: AdCycleSummary):
        """Inserts ad_cycle_summary row in Supabase."""
        try:
            if self._supabase_client:
                data = {
                    "cycle_id": cycle.cycle_id,
                    "billboard_id": cycle.billboard_id,
                    "cycle_start_at": cycle.cycle_start_at.isoformat(),
                    "cycle_end_at": cycle.cycle_end_at.isoformat(),
                    "cycle_duration_seconds": cycle.cycle_duration_seconds,
                    "total_ads": cycle.total_ads
                }
                self._supabase_client.table("ad_cycle_summary").insert(data).execute()
        except Exception as e:
            logger.warning(f"Error persisting cycle {cycle.cycle_id} to Supabase: {e}")
