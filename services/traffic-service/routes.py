import asyncio
import json
import logging
from typing import List, Optional
from fastapi import APIRouter, Request, HTTPException, Query
from fastapi.responses import StreamingResponse
from supabase_client import supabase
from realtime_manager import manager
import schemas

logger = logging.getLogger("traffic-service.routes")
router = APIRouter()

@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "realtime_active": manager.is_running,
        "clients_connected": len(manager.queues)
    }

@router.get("/traffic/cameras", response_model=List[schemas.CameraInfo])
def get_cameras():
    try:
        response = supabase.table("traffic_master").select("camera_code, location_name").execute()
        records = response.data
        if not records:
            return []
        # De-duplicate cameras by camera_code
        seen = set()
        cameras = []
        for r in records:
            cc = r.get("camera_code")
            if cc and cc not in seen:
                seen.add(cc)
                cameras.append({
                    "camera_code": cc,
                    "location_name": r.get("location_name") or cc
                })
        return cameras
    except Exception as e:
        logger.error(f"Error fetching cameras: {e}")
        return []

@router.get("/traffic/latest", response_model=schemas.TrafficRecord)
def get_latest_traffic(camera_code: str = Query(..., description="Camera code to filter by")):
    try:
        response = supabase.table("traffic_master")\
            .select("*")\
            .eq("camera_code", camera_code)\
            .order("last_updated", desc=True)\
            .limit(1)\
            .execute()
        
        records = response.data
        if not records:
            raise HTTPException(status_code=404, detail=f"No traffic record found for camera {camera_code}")
        return records[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching latest traffic for {camera_code}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/traffic/stream")
async def traffic_stream(request: Request, camera_code: Optional[str] = Query(None, description="Optional camera code filter")):
    queue = asyncio.Queue()
    manager.register(queue)
    
    async def event_generator():
        try:
            # Yield initial snapshot if camera_code is specified
            if camera_code:
                try:
                    response = supabase.table("traffic_master")\
                        .select("*")\
                        .eq("camera_code", camera_code)\
                        .order("last_updated", desc=True)\
                        .limit(1)\
                        .execute()
                    
                    if response.data:
                        initial_rec = response.data[0]
                        serialized = manager._serialize_record(initial_rec)
                        yield f"data: {json.dumps(serialized)}\n\n"
                except Exception as ex:
                    logger.error(f"Error fetching initial record for stream: {ex}")
            
            # Streaming loop
            while True:
                if await request.is_disconnected():
                    break
                
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=1.0)
                    if camera_code:
                        parsed = json.loads(msg)
                        if parsed.get("camera_code") == camera_code:
                            yield f"data: {msg}\n\n"
                    else:
                        yield f"data: {msg}\n\n"
                except asyncio.TimeoutError:
                    # Keep-alive event
                    yield ": keep-alive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            manager.unregister(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
