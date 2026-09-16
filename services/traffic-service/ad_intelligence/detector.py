"""
Master Advertisement Detector & State Machine Engine.
Coordinates ROI cropping, frame sampling, visual change detection,
multilingual OCR, creative matching, playback event tracking, and cycle detection.
"""

import os
import sys
import logging
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime, timezone
import numpy as np

from .models import (
    AdDetectionState,
    BillboardROI,
    AdCreative,
    AdPlayEvent,
    AdCycleSummary
)
from .config import settings
from .change_detector import VisualChangeDetector, ChangeDetectionResult
from .ocr import AdvertisementOCR
from .creative_matcher import CreativeMatcher
from .event_tracker import AdEventTracker
from .cycle_detector import PlaylistCycleDetector
from .storage import EvidenceStorageManager

logger = logging.getLogger("AdIntelligence.Detector")


class BillboardAdDetector:
    """
    Production-ready Advertisement Detection, OCR, Playback Tracking,
    and Playlist Cycle Detection Engine.
    """

    def __init__(
        self,
        billboard_id: str,
        roi: Optional[Dict[str, float]] = None,
        sample_interval: float = settings.FRAME_SAMPLE_INTERVAL
    ):
        self.billboard_id = billboard_id
        self.roi = BillboardROI(**(roi or settings.BILLBOARD_ROI))
        self.sample_interval = sample_interval

        # State Machine
        self.state: AdDetectionState = AdDetectionState.NO_AD
        self.current_creative: Optional[AdCreative] = None
        self.last_state_change: datetime = datetime.now(timezone.utc)

        # Core Subsystems
        self.change_detector = VisualChangeDetector(
            change_threshold=settings.CHANGE_THRESHOLD,
            confirmation_frames=settings.CHANGE_CONFIRMATION_FRAMES
        )
        self.ocr_engine = AdvertisementOCR(
            languages=settings.OCR_LANGUAGES,
            use_gpu=settings.USE_GPU,
            min_confidence=settings.OCR_CONFIDENCE_THRESHOLD
        )
        self.creative_matcher = CreativeMatcher(
            match_threshold=settings.CREATIVE_MATCH_THRESHOLD,
            text_weight=settings.TEXT_SIMILARITY_WEIGHT,
            visual_weight=settings.VISUAL_SIMILARITY_WEIGHT
        )
        self.event_tracker = AdEventTracker(
            billboard_id=billboard_id,
            min_duration=settings.MIN_AD_DURATION_SECONDS
        )
        self.cycle_detector = PlaylistCycleDetector(
            min_cycle_ads=settings.MIN_CYCLE_ADS,
            cycle_match_threshold=settings.CYCLE_MATCH_THRESHOLD
        )
        self.storage = EvidenceStorageManager()

        # Connect event tracker completion to cycle detector
        self.event_tracker.add_event_listener(self._on_event_completed)

        # Performance and frame counters
        self.processed_frames_count: int = 0
        self.last_frame_timestamp: Optional[datetime] = None

    def _on_event_completed(self, event: AdPlayEvent):
        """Called automatically when an ad playback finishes."""
        cycle = self.cycle_detector.add_event(event)
        if cycle is not None:
            self.event_tracker.persist_cycle(cycle)

    def set_roi(self, x1: float, y1: float, x2: float, y2: float):
        """Updates the billboard Region of Interest."""
        self.roi = BillboardROI(x1=x1, y1=y1, x2=x2, y2=y2)
        logger.info(f"Updated Billboard ROI for '{self.billboard_id}': {self.roi.dict()}")

    def process_frame(
        self,
        frame: np.ndarray,
        timestamp: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Process a single sampled video frame through the state machine.
        
        Args:
            frame: Raw full-resolution BGR camera frame.
            timestamp: Frame capture timestamp (defaults to UTC now).
            
        Returns:
            Dictionary with current state, active ad, and detection diagnostics.
        """
        self.processed_frames_count += 1
        now = timestamp or datetime.now(timezone.utc)
        self.last_frame_timestamp = now

        if frame is None or frame.size == 0:
            return {
                "state": self.state.value,
                "billboard_id": self.billboard_id,
                "active_ad": None,
                "error": "empty_frame"
            }

        # 1. Crop billboard ROI
        roi_crop = self.roi.crop(frame)

        # 2. Visual change detection with consecutive-frame confirmation
        change_res: ChangeDetectionResult = self.change_detector.evaluate_frame(roi_crop)

        # 3. State Machine Transitions
        if self.state == AdDetectionState.NO_AD:
            if change_res.is_stable and roi_crop.size > 0:
                logger.info(f"AD_CHANGE_DETECTED: First stable frame observed on billboard {self.billboard_id}")
                self._transition_to(AdDetectionState.CHANGE_CONFIRMED)
                self._handle_ad_confirmation(roi_crop, change_res.visual_hash, now)
            else:
                self._transition_to(AdDetectionState.POSSIBLE_CHANGE)

        elif self.state == AdDetectionState.AD_STABLE:
            if change_res.is_changed and change_res.is_stable:
                logger.info(
                    f"AD_CHANGE_DETECTED: Confirmed creative transition on billboard {self.billboard_id} "
                    f"(score: {change_res.score:.3f})"
                )
                self._transition_to(AdDetectionState.CHANGE_CONFIRMED)
                self._handle_ad_confirmation(roi_crop, change_res.visual_hash, now)
            elif not change_res.is_stable and change_res.score >= settings.CHANGE_THRESHOLD:
                self._transition_to(AdDetectionState.POSSIBLE_CHANGE)

        elif self.state == AdDetectionState.POSSIBLE_CHANGE:
            if change_res.is_changed and change_res.is_stable:
                logger.info(f"CHANGE_CONFIRMED: Stable candidate frame achieved on billboard {self.billboard_id}")
                self._transition_to(AdDetectionState.CHANGE_CONFIRMED)
                self._handle_ad_confirmation(roi_crop, change_res.visual_hash, now)
            elif change_res.is_stable and not change_res.is_changed:
                # Returned back to previous stable state without transitioning
                self._transition_to(AdDetectionState.AD_STABLE)

        elif self.state == AdDetectionState.AD_CONFIRMED:
            # Settle into stable tracking
            self._transition_to(AdDetectionState.AD_STABLE)

        return {
            "state": self.state.value,
            "billboard_id": self.billboard_id,
            "active_creative": self.current_creative.dict() if self.current_creative else None,
            "active_event": self.event_tracker.current_event.dict() if self.event_tracker.current_event else None,
            "change_score": change_res.score,
            "is_stable": change_res.is_stable,
            "visual_hash": change_res.visual_hash,
            "timestamp": now.isoformat()
        }

    def _transition_to(self, new_state: AdDetectionState):
        """Transition state machine to new state."""
        if self.state != new_state:
            self.state = new_state
            self.last_state_change = datetime.now(timezone.utc)

    def _handle_ad_confirmation(
        self,
        roi_crop: np.ndarray,
        visual_hash: str,
        timestamp: datetime
    ):
        """
        Executes identification pipeline when a new ad transition is confirmed:
        1. Capture stable frame
        2. Upload evidence image to Supabase Storage
        3. Run Multilingual OCR
        4. Match or create creative
        5. Start new playback event
        """
        self._transition_to(AdDetectionState.IDENTIFYING_AD)
        logger.info(f"AD_IDENTIFICATION_STARTED: Identifying ad for billboard {self.billboard_id}")

        # 1. Generate temp event ID for evidence upload
        temp_event_id = str(np.random.randint(10000000, 99999999))
        
        # 2. Upload evidence snapshot
        evidence_url = self.storage.upload_evidence(
            frame=roi_crop,
            billboard_id=self.billboard_id,
            event_id=temp_event_id,
            timestamp=timestamp
        )

        # 3. Multilingual OCR
        ocr_res = self.ocr_engine.extract(roi_crop)
        logger.info(
            f"OCR_COMPLETED: Extracted text='{ocr_res['normalized_ocr_text'][:60]}' "
            f"(conf: {ocr_res['ocr_confidence']:.2f}, brand: '{ocr_res['brand_candidate']}')"
        )

        # 4. Creative Matching & Fingerprinting
        creative, is_new, match_score = self.creative_matcher.match_or_create(
            billboard_id=self.billboard_id,
            visual_hash=visual_hash,
            raw_ocr_text=ocr_res["raw_ocr_text"],
            normalized_ocr_text=ocr_res["normalized_ocr_text"],
            brand_candidate=ocr_res["brand_candidate"],
            ad_name_candidate=ocr_res["ad_name_candidate"],
            evidence_image_url=evidence_url
        )
        self.current_creative = creative

        # 5. Start Playback Event (closes previous ad and calculates its duration)
        event = self.event_tracker.start_ad_play(
            creative=creative,
            detection_confidence=match_score,
            ocr_confidence=ocr_res["ocr_confidence"],
            evidence_image_url=evidence_url,
            timestamp=timestamp
        )

        self._transition_to(AdDetectionState.AD_CONFIRMED)

    def close(self, timestamp: Optional[datetime] = None):
        """Finalizes active ad playback session and cleans up resources."""
        self.event_tracker.finish_ad_play(timestamp=timestamp)
        self.state = AdDetectionState.NO_AD
        logger.info(f"Billboard ad detector for '{self.billboard_id}' closed.")
