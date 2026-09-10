"""
FastAPI Router for DOOH Billboard Advertisement Intelligence.
Exposes REST endpoints for real-time and historical ad monitoring, analytics, and traffic correlation.
"""

import os
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query, Path, Body
from pydantic import BaseModel

from .models import (
    AdDailySummary,
    AdCreativeAnalytics,
    AdPlayEvent,
    AdCycleSummary,
    TrafficExposureMetrics
)
from .service import AdIntelligenceService
from .config import settings
from .traffic_integrator import TrafficIntegrator

logger = logging.getLogger("AdIntelligence.API")

router = APIRouter(tags=["Advertisement Intelligence"])

# Active services registry: billboard_id -> AdIntelligenceService
ACTIVE_SERVICES: Dict[str, AdIntelligenceService] = {}


def get_or_create_service(billboard_id: str) -> AdIntelligenceService:
    if billboard_id not in ACTIVE_SERVICES:
        ACTIVE_SERVICES[billboard_id] = AdIntelligenceService(billboard_id=billboard_id)
    return ACTIVE_SERVICES[billboard_id]


@router.get("/api/billboards/{billboard_id}/ads/today", response_model=AdDailySummary)
def get_ads_today(
    billboard_id: str = Path(..., description="Billboard identifier (e.g. ACU-BB-4521)"),
    date: Optional[str] = Query(None, description="Target date YYYY-MM-DD")
):
    """
    Returns today's comprehensive billboard advertisement intelligence summary:
    Total playbacks, screen time, average ad duration, unique creatives, detected cycles, and recent events.
    """
    service = get_or_create_service(billboard_id)
    return service.get_daily_summary(target_date=date)


@router.get("/api/billboards/{billboard_id}/ads/events")
def get_ad_events(
    billboard_id: str = Path(..., description="Billboard identifier"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0)
):
    """
    Returns chronological list of confirmed ad playback events with actual durations and evidence links.
    """
    service = get_or_create_service(billboard_id)
    events = service.detector.event_tracker.completed_events
    paginated = events[offset : offset + limit]

    result = []
    for e in reversed(paginated):
        creative = service.detector.creative_matcher.known_creatives.get(e.creative_id)
        result.append({
            "event_id": e.event_id,
            "billboard_id": e.billboard_id,
            "creative_id": e.creative_id,
            "brand_name": creative.brand_name if creative else "Brand",
            "ad_name": creative.ad_name if creative else "Digital Creative",
            "started_at": e.started_at.isoformat(),
            "ended_at": e.ended_at.isoformat() if e.ended_at else None,
            "duration_seconds": e.duration_seconds,
            "detection_confidence": e.detection_confidence,
            "ocr_confidence": e.ocr_confidence,
            "evidence_image_url": e.evidence_image_url,
            "raw_ocr_text": creative.raw_ocr_text if creative else None
        })

    return {
        "billboard_id": billboard_id,
        "total_events": len(events),
        "events": result
    }


@router.get("/api/billboards/{billboard_id}/ads/creatives")
def get_ad_creatives(
    billboard_id: str = Path(..., description="Billboard identifier")
):
    """
    Returns list of all unique advertising creatives identified on this billboard.
    """
    service = get_or_create_service(billboard_id)
    summary = service.get_daily_summary()
    return {
        "billboard_id": billboard_id,
        "unique_creatives_count": len(summary.creatives),
        "creatives": summary.creatives
    }


@router.get("/api/billboards/{billboard_id}/ads/cycles")
def get_ad_cycles(
    billboard_id: str = Path(..., description="Billboard identifier")
):
    """
    Returns detected playlist cycles with exact observed durations and sequence order.
    """
    service = get_or_create_service(billboard_id)
    cycles = service.detector.cycle_detector.get_detected_cycles()
    return {
        "billboard_id": billboard_id,
        "total_cycles_detected": len(cycles),
        "cycles": cycles
    }


@router.get("/api/billboards/{billboard_id}/ads/{creative_id}/analytics")
def get_creative_analytics(
    billboard_id: str = Path(..., description="Billboard identifier"),
    creative_id: str = Path(..., description="Creative UUID")
):
    """
    Returns deep analytics for a specific advertisement creative:
    Play count, total screen time, average duration, first/last seen timestamps.
    """
    service = get_or_create_service(billboard_id)
    summary = service.get_daily_summary()
    
    for c in summary.creatives:
        if c.creative_id == creative_id:
            return c

    # If not found in today's summary, look in matcher cache
    creative = service.detector.creative_matcher.known_creatives.get(creative_id)
    if creative:
        return {
            "creative_id": creative.creative_id,
            "billboard_id": billboard_id,
            "brand_name": creative.brand_name,
            "ad_name": creative.ad_name,
            "play_count": 0,
            "total_duration_seconds": 0.0,
            "average_duration_seconds": 0.0,
            "first_seen": creative.first_seen_at.isoformat(),
            "last_seen": creative.last_seen_at.isoformat(),
            "representative_image_url": creative.representative_image_url,
            "raw_ocr_text": creative.raw_ocr_text
        }

    raise HTTPException(status_code=404, detail="Creative not found on this billboard.")


@router.get("/api/billboards/{billboard_id}/ads/events/{event_id}/traffic")
def get_event_traffic(
    billboard_id: str = Path(..., description="Billboard identifier"),
    event_id: str = Path(..., description="Event UUID")
):
    """
    Returns traffic intelligence correlated with this advertisement event playback.
    """
    service = get_or_create_service(billboard_id)
    events = service.detector.event_tracker.completed_events
    
    target_event = None
    for e in events:
        if e.event_id == event_id:
            target_event = e
            break

    if not target_event:
        raise HTTPException(status_code=404, detail="Ad event not found.")

    creative = service.detector.creative_matcher.known_creatives.get(target_event.creative_id)
    traffic = service.detector.event_tracker.traffic_integrator.correlate_playback_with_traffic(
        event=target_event,
        brand_name=creative.brand_name if creative else "Brand",
        ad_name=creative.ad_name if creative else "Creative"
    )
    return traffic


class MonitorControlRequest(BaseModel):
    stream_source: Optional[str] = "0"
    roi: Optional[Dict[str, float]] = None


@router.post("/api/billboards/{billboard_id}/ads/monitor/start")
def start_monitor(
    billboard_id: str = Path(..., description="Billboard identifier"),
    payload: MonitorControlRequest = Body(default_factory=MonitorControlRequest)
):
    """
    Starts real-time video monitoring on a billboard camera/RTSP stream.
    """
    src = int(payload.stream_source) if str(payload.stream_source).isdigit() else payload.stream_source
    service = get_or_create_service(billboard_id)
    service.stream_source = src
    if payload.roi:
        service.detector.set_roi(**payload.roi)
    service.start()
    return {
        "status": "started",
        "billboard_id": billboard_id,
        "stream_source": str(src),
        "is_running": service.is_running
    }


@router.post("/api/billboards/{billboard_id}/ads/monitor/stop")
def stop_monitor(
    billboard_id: str = Path(..., description="Billboard identifier")
):
    """
    Stops video monitoring.
    """
    service = get_or_create_service(billboard_id)
    service.stop()
    return {
        "status": "stopped",
        "billboard_id": billboard_id,
        "is_running": service.is_running
    }


@router.get("/api/billboards/{billboard_id}/ads/monitor/status")
def get_monitor_status(
    billboard_id: str = Path(..., description="Billboard identifier")
):
    """
    Returns active monitoring state, live frame status, and detection counts.
    """
    service = get_or_create_service(billboard_id)
    return {
        "billboard_id": billboard_id,
        "is_running": service.is_running,
        "current_state": service.detector.state.value,
        "active_ad": service.detector.current_creative.dict() if service.detector.current_creative else None,
        "total_sampled_frames": service.total_sampled_frames,
        "last_frame_status": service.last_status
    }
