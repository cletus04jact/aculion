"""
Advertisement Intelligence Stream Monitoring Service.
Supports live RTSP camera feeds, local video files, OpenCV video capture,
and offline video processing with asynchronous threading and metrics aggregation.
"""

import time
import os
import threading
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta
import cv2

from .models import (
    AdDailySummary,
    AdCreativeAnalytics,
    AdPlayEvent,
    AdCycleSummary
)
from .detector import BillboardAdDetector
from .config import settings

logger = logging.getLogger("AdIntelligence.Service")


class AdIntelligenceService:
    """
    Continuous background monitoring service for DOOH billboard cameras.
    """

    def __init__(self, billboard_id: str, stream_source: Any = 0, roi: Optional[Dict[str, float]] = None):
        self.billboard_id = billboard_id
        self.stream_source = stream_source
        self.detector = BillboardAdDetector(billboard_id=billboard_id, roi=roi)

        self.is_running: bool = False
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

        # Monitoring statistics
        self.start_time: Optional[datetime] = None
        self.total_sampled_frames: int = 0
        self.last_status: Dict[str, Any] = {}

    def start(self):
        """Starts continuous video monitoring in a background daemon thread."""
        if self.is_running:
            logger.warning(f"Monitoring service for '{self.billboard_id}' is already running.")
            return

        self.is_running = True
        self._stop_event.clear()
        self.start_time = datetime.now(timezone.utc)
        self._thread = threading.Thread(target=self._stream_loop, daemon=True)
        self._thread.start()
        logger.info(f"Started billboard ad intelligence monitoring on '{self.billboard_id}' (Source: {self.stream_source})")

    def stop(self):
        """Stops video monitoring."""
        if not self.is_running:
            return

        self.is_running = False
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3.0)
        self.detector.close()
        logger.info(f"Stopped billboard ad intelligence monitoring on '{self.billboard_id}'")

    def _stream_loop(self):
        """Internal worker loop consuming camera frames."""
        retry_delay = 2.0
        sample_interval = self.detector.sample_interval

        while not self._stop_event.is_set():
            cap = cv2.VideoCapture(self.stream_source)
            if not cap.isOpened():
                logger.error(
                    f"CAMERA_DISCONNECTED: Could not open camera/video source '{self.stream_source}' for billboard '{self.billboard_id}'. "
                    f"Retrying in {retry_delay}s..."
                )
                time.sleep(retry_delay)
                continue

            logger.info(f"CAMERA_RECONNECTED: Successfully connected to video source '{self.stream_source}'")
            fps = cap.get(cv2.CAP_PROP_FPS) or settings.DEFAULT_FPS
            frame_skip = max(1, int(fps * sample_interval))

            frame_idx = 0
            while not self._stop_event.is_set():
                success, frame = cap.read()
                if not success:
                    logger.warning(f"Video stream ended or connection lost for billboard '{self.billboard_id}'")
                    break

                # Sample at configured interval
                if frame_idx % frame_skip == 0:
                    self.total_sampled_frames += 1
                    status = self.detector.process_frame(frame)
                    self.last_status = status

                frame_idx += 1
                # Small sleep to yield CPU if reading faster than real-time
                time.sleep(0.001)

            cap.release()
            if self._stop_event.is_set():
                break
            time.sleep(retry_delay)

    def process_video_file(
        self,
        video_path: str,
        sample_interval: float = settings.FRAME_SAMPLE_INTERVAL
    ) -> Dict[str, Any]:
        """
        Synchronously processes a video file from start to finish for batch analysis or testing.
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError(f"Could not open video file: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or settings.DEFAULT_FPS
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        frame_skip = max(1, int(fps * sample_interval))

        logger.info(
            f"Processing video '{video_path}': Total Frames={total_frames}, "
            f"FPS={fps:.2f}, Skip={frame_skip} frames ({sample_interval}s interval)"
        )

        frame_idx = 0
        video_start_time = datetime.now(timezone.utc)

        while True:
            success, frame = cap.read()
            if not success:
                break

            if frame_idx % frame_skip == 0:
                # Calculate synthetic timestamp corresponding to video playback progress
                simulated_time = video_start_time + timedelta(seconds=(frame_idx / fps))
                self.detector.process_frame(frame, timestamp=simulated_time)

            frame_idx += 1

        cap.release()
        # Finalize last playing ad
        simulated_end = video_start_time + timedelta(seconds=(total_frames / fps))
        self.detector.close(timestamp=simulated_end)

        return self.get_daily_summary()

    def get_daily_summary(self, target_date: Optional[str] = None) -> AdDailySummary:
        """
        Aggregates today's billboard analytics per creative and overall.
        """
        today_str = target_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        events = self.detector.event_tracker.completed_events
        cycles = self.detector.cycle_detector.detected_cycles

        # Filter events by date if specified
        filtered_events = [
            e for e in events
            if e.started_at.strftime("%Y-%m-%d") == today_str
        ]

        total_playbacks = len(filtered_events)
        total_screen_time = sum((e.duration_seconds or 0.0) for e in filtered_events)
        avg_duration = (total_screen_time / total_playbacks) if total_playbacks > 0 else 0.0

        # Group by creative
        creative_map: Dict[str, List[AdPlayEvent]] = {}
        for e in filtered_events:
            cid = e.creative_id or "unknown"
            creative_map.setdefault(cid, []).append(e)

        creatives_analytics: List[AdCreativeAnalytics] = []
        for cid, ev_list in creative_map.items():
            master_creative = self.detector.creative_matcher.known_creatives.get(cid)
            brand = master_creative.brand_name if master_creative else "Unknown Brand"
            ad_name = master_creative.ad_name if master_creative else "Digital Ad"
            c_duration = sum((e.duration_seconds or 0.0) for e in ev_list)
            c_avg = (c_duration / len(ev_list)) if ev_list else 0.0
            first_seen = min(e.started_at for e in ev_list).isoformat()
            last_seen = max(e.started_at for e in ev_list).isoformat()

            creatives_analytics.append(
                AdCreativeAnalytics(
                    creative_id=cid,
                    billboard_id=self.billboard_id,
                    brand_name=brand,
                    ad_name=ad_name,
                    play_count=len(ev_list),
                    total_duration_seconds=round(c_duration, 2),
                    average_duration_seconds=round(c_avg, 2),
                    first_seen=first_seen,
                    last_seen=last_seen,
                    representative_image_url=master_creative.representative_image_url if master_creative else None,
                    raw_ocr_text=master_creative.raw_ocr_text if master_creative else None
                )
            )

        cycle_count = len(cycles)
        avg_cycle_dur = (sum(c.cycle_duration_seconds for c in cycles) / cycle_count) if cycle_count > 0 else 0.0

        recent_events_dicts = [
            {
                "event_id": e.event_id,
                "creative_id": e.creative_id,
                "brand_name": self.detector.creative_matcher.known_creatives.get(e.creative_id, None).brand_name if e.creative_id in self.detector.creative_matcher.known_creatives else "Brand Ad",
                "ad_name": self.detector.creative_matcher.known_creatives.get(e.creative_id, None).ad_name if e.creative_id in self.detector.creative_matcher.known_creatives else "Ad",
                "started_at": e.started_at.isoformat(),
                "ended_at": e.ended_at.isoformat() if e.ended_at else None,
                "duration_seconds": e.duration_seconds,
                "detection_confidence": e.detection_confidence,
                "ocr_confidence": e.ocr_confidence,
                "evidence_image_url": e.evidence_image_url
            }
            for e in reversed(filtered_events[-50:])
        ]

        return AdDailySummary(
            billboard_id=self.billboard_id,
            date=today_str,
            total_ads_detected=len(creatives_analytics),
            unique_creatives=len(creatives_analytics),
            total_playbacks=total_playbacks,
            total_screen_time_seconds=round(total_screen_time, 2),
            average_ad_duration_seconds=round(avg_duration, 2),
            cycle_count=cycle_count,
            average_cycle_duration_seconds=round(avg_cycle_dur, 2),
            creatives=creatives_analytics,
            recent_events=recent_events_dicts
        )
