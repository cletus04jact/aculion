"""
Traffic Intelligence Integration Layer for DOOH Advertisement Intelligence.
Correlates advertisement playback events with concurrent vehicle and audience traffic data.
"""

import logging
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import psycopg2
from psycopg2.extras import RealDictCursor
from supabase import create_client, Client

from .models import AdPlayEvent, TrafficExposureMetrics
from .config import settings

logger = logging.getLogger("AdIntelligence.TrafficIntegrator")


class TrafficIntegrator:
    """
    Integrates advertisement playbacks with vehicle count and audience exposure data.
    """

    def __init__(
        self,
        supabase_url: str = settings.SUPABASE_URL,
        supabase_key: str = settings.SUPABASE_KEY,
        database_url: str = settings.DATABASE_URL
    ):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.database_url = database_url

        self._supabase_client: Optional[Client] = None
        if self.supabase_url and self.supabase_key:
            try:
                self._supabase_client = create_client(self.supabase_url, self.supabase_key)
            except Exception as e:
                logger.warning(f"Could not init Supabase client in TrafficIntegrator: {e}")

    def correlate_playback_with_traffic(
        self,
        event: AdPlayEvent,
        brand_name: Optional[str] = "Brand Ad",
        ad_name: Optional[str] = "Digital Creative"
    ) -> TrafficExposureMetrics:
        """
        Calculates traffic and vehicle exposure during the ad playback window [started_at, ended_at].
        """
        duration = float(event.duration_seconds or 0.0)
        if duration <= 0.0 and event.ended_at:
            duration = (event.ended_at - event.started_at).total_seconds()
        duration = max(1.0, duration)

        billboard_id = event.billboard_id
        started_at = event.started_at
        ended_at = event.ended_at or started_at

        # Default fallback traffic metrics
        base_traffic = {
            "total_vehicles": 45,
            "bikes": 22,
            "economy": 12,
            "premium": 6,
            "luxury": 3,
            "ultra_luxury": 1,
            "commercial": 1,
            "flow_rate": 0.75,  # vehicles / sec
            "avg_exposure_time": 8.5,
            "estimated_reach": 72
        }

        # Query latest traffic snapshot from database for this billboard
        try:
            if self._supabase_client:
                res = self._supabase_client.table("traffic_overview") \
                    .select("*") \
                    .eq("billboard_code", billboard_id) \
                    .order("created_at", desc=True) \
                    .limit(1) \
                    .execute()
                
                if res.data and len(res.data) > 0:
                    t_data = res.data[0]
                    base_traffic["total_vehicles"] = t_data.get("total_vehicles", 45) or 45
                    base_traffic["bikes"] = t_data.get("bikes", 20) or 20
                    base_traffic["economy"] = t_data.get("economy", 15) or 15
                    base_traffic["premium"] = t_data.get("premium", 6) or 6
                    base_traffic["luxury"] = t_data.get("luxury", 3) or 3
                    base_traffic["ultra_luxury"] = t_data.get("ultra_luxury", 1) or 1
                    base_traffic["commercial"] = t_data.get("commercial", 2) or 2
                    base_traffic["flow_rate"] = float(t_data.get("flow_rate", 0.75) or 0.75)
                    base_traffic["avg_exposure_time"] = float(t_data.get("avg_exposure_time", 8.5) or 8.5)
                    base_traffic["estimated_reach"] = t_data.get("estimated_reach", 70) or 70
        except Exception as e:
            logger.warning(f"Failed to fetch realtime traffic overview from Supabase: {e}")

        # Compute proportional vehicle exposures during the playback window
        # Flow rate is vehicles per second
        vehicles_passed = max(1, int(base_traffic["flow_rate"] * duration))
        
        # Breakdown proportions
        total_veh = max(1, base_traffic["total_vehicles"])
        bike_ratio = base_traffic["bikes"] / total_veh
        cars_ratio = (base_traffic["economy"] + base_traffic["premium"] + base_traffic["luxury"] + base_traffic["ultra_luxury"]) / total_veh
        comm_ratio = base_traffic["commercial"] / total_veh

        bikes_exp = max(0, int(vehicles_passed * bike_ratio))
        cars_exp = max(0, int(vehicles_passed * cars_ratio))
        comm_exp = max(0, vehicles_passed - (bikes_exp + cars_exp))
        buses_exp = max(0, int(comm_exp * 0.4))
        trucks_exp = max(0, comm_exp - buses_exp)
        reach_est = int(vehicles_passed * 1.6)

        return TrafficExposureMetrics(
            event_id=event.event_id,
            billboard_id=billboard_id,
            creative_id=event.creative_id,
            brand_name=brand_name,
            ad_name=ad_name,
            started_at=started_at,
            ended_at=ended_at,
            duration_seconds=round(duration, 2),
            total_vehicles=vehicles_passed,
            cars_exposure=cars_exp,
            bikes_exposure=bikes_exp,
            buses_exposure=buses_exp,
            trucks_exposure=trucks_exp,
            commercial_exposure=comm_exp,
            estimated_reach=reach_est,
            avg_exposure_time=base_traffic["avg_exposure_time"]
        )
