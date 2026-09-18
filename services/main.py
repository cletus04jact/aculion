"""
ACULION PLATFORM — Unified Backend Service
Consolidates Location Intelligence, Traffic Intelligence, and API Gateway functionality
into a single deployable FastAPI application on Railway.
"""

import os
import sys
import logging
from pathlib import Path
from typing import List, Optional
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, APIRouter, Request, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# ─────────────────────────────────────────────────────────────
# Path Configuration: Load sub-service modules deterministically
# ─────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
LOCATION_DIR = str(BASE_DIR / "location-service")
TRAFFIC_DIR = str(BASE_DIR / "traffic-service")

# Ensure unified services directory has top priority in sys.path so 'main' resolves to this file
base_dir_str = str(BASE_DIR)
if base_dir_str in sys.path:
    sys.path.remove(base_dir_str)
sys.path.insert(0, base_dir_str)

# Insert sub-services right after BASE_DIR so their internal modules take priority over site-packages
if LOCATION_DIR in sys.path:
    sys.path.remove(LOCATION_DIR)
sys.path.insert(1, LOCATION_DIR)

if TRAFFIC_DIR in sys.path:
    sys.path.remove(TRAFFIC_DIR)
sys.path.insert(2, TRAFFIC_DIR)

# Load environment configuration
load_dotenv()
if (BASE_DIR / ".env").exists():
    load_dotenv(dotenv_path=BASE_DIR / ".env")
if (BASE_DIR.parent / ".env").exists():
    load_dotenv(dotenv_path=BASE_DIR.parent / ".env")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("aculion-backend-unified")

# ─────────────────────────────────────────────────────────────
# Import Domain Handlers & Components
# ─────────────────────────────────────────────────────────────
import importlib

# Location Intelligence Handlers & Dependencies (from location-service)
_location_api = importlib.import_module("api.main")
analyze_location = _location_api.analyze_location
get_real_estate_score = _location_api.get_real_estate_score
geocode_location = _location_api.geocode_location
detect_area = _location_api.detect_area
recommend_billboards = _location_api.recommend_billboards
admin_create_user = _location_api.admin_create_user
RecommendationRequest = _location_api.RecommendationRequest
AdminCreateUserRequest = _location_api.AdminCreateUserRequest
verify_admin = _location_api.verify_admin

# Traffic Intelligence Handlers, Schemas & Realtime Manager (from traffic-service)
_traffic_realtime = importlib.import_module("realtime_manager")
traffic_manager = _traffic_realtime.manager

_traffic_routes = importlib.import_module("routes")
get_cameras = _traffic_routes.get_cameras
get_latest_traffic = _traffic_routes.get_latest_traffic
traffic_stream = _traffic_routes.traffic_stream

schemas = importlib.import_module("schemas")
CameraInfo = schemas.CameraInfo
TrafficRecord = schemas.TrafficRecord

# ─────────────────────────────────────────────────────────────
# Application Lifespan: Manage background telemetry tasks
# ─────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Aculion Unified Backend...")
    try:
        await traffic_manager.start()
        logger.info("Traffic telemetry background simulator started.")
    except Exception as e:
        logger.error(f"Error starting traffic manager: {e}", exc_info=True)

    yield

    logger.info("Stopping Aculion Unified Backend...")
    try:
        await traffic_manager.stop()
        logger.info("Traffic telemetry background simulator stopped cleanly.")
    except Exception as e:
        logger.error(f"Error stopping traffic manager: {e}", exc_info=True)

# ─────────────────────────────────────────────────────────────
# Initialize Unified FastAPI Application
# ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="Aculion Unified Platform API",
    description="Single consolidated backend service providing Location Intelligence and Traffic Telemetry for Aculion.",
    version="1.0.0",
    lifespan=lifespan,
)

# ─────────────────────────────────────────────────────────────
# CORS Configuration
# ─────────────────────────────────────────────────────────────
default_origins = [
    "http://localhost:5173",
    "http://localhost:5176",
    "https://www.aculion.com",
    "https://aculion.com",
]
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
frontend_url_env = os.getenv("FRONTEND_URL", "")

# Strip whitespace and trailing slashes so Origin headers match browser expectations
allowed_origins_set = {orig.rstrip("/") for orig in default_origins}
if allowed_origins_env:
    for orig in allowed_origins_env.split(","):
        cleaned = orig.strip().rstrip("/")
        if cleaned:
            allowed_origins_set.add(cleaned)
if frontend_url_env:
    for orig in frontend_url_env.split(","):
        cleaned = orig.strip().rstrip("/")
        if cleaned:
            allowed_origins_set.add(cleaned)

# If wildcard "*" is provided, browsers forbid Access-Control-Allow-Origin: * when
# allow_credentials=True. We handle this by setting allow_origin_regex=".*" to echo origins safely.
if "*" in allowed_origins_set:
    allowed_origins_set.remove("*")
    allow_origin_regex = ".*"
else:
    # Allow Vercel preview/production deployments by default
    allow_origin_regex = os.getenv("ALLOWED_ORIGIN_REGEX", r"^https:\/\/.*\.vercel\.app$")

allowed_origins = sorted(list(allowed_origins_set))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ─────────────────────────────────────────────────────────────
# Health & Root Endpoints
# ─────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
def root_check():
    return {
        "service": "aculion-backend-unified",
        "status": "ok",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "ok",
        "service": "aculion-backend-unified",
        "timestamp": datetime.utcnow().isoformat(),
        "components": {
            "gateway": "in-process",
            "location": "active",
            "traffic": "active" if traffic_manager.is_running else "idle"
        }
    }

@app.get("/health/services", tags=["Health"])
def health_services():
    return {
        "status": "ok",
        "mode": "unified",
        "services": {
            "location-service": {
                "status": "healthy",
                "mode": "in-process",
            },
            "traffic-service": {
                "status": "healthy",
                "mode": "in-process",
                "realtime_active": traffic_manager.is_running,
                "clients_connected": len(traffic_manager.queues)
            }
        }
    }

# ─────────────────────────────────────────────────────────────
# Location Intelligence Router (/api/location/...)
# ─────────────────────────────────────────────────────────────
location_router = APIRouter(prefix="/api/location", tags=["Location Intelligence"])

@location_router.get("/v1/analyze", summary="Analyze location spatial features and KPIs")
def route_analyze_location(
    latitude: float = Query(..., ge=-90, le=90, description="Latitude of analysis point"),
    longitude: float = Query(..., ge=-180, le=180, description="Longitude of analysis point"),
    radius: int = Query(1000, ge=100, le=5000, description="Radius in metres"),
):
    return analyze_location(latitude=latitude, longitude=longitude, radius=radius)

@location_router.get("/v1/real-estate-score", summary="Get real estate potential score")
def route_real_estate_score(
    latitude: float = Query(..., ge=-90, le=90, description="Latitude"),
    longitude: float = Query(..., ge=-180, le=180, description="Longitude"),
    radius: int = Query(1000, ge=100, le=5000, description="Radius in metres"),
):
    return get_real_estate_score(latitude=latitude, longitude=longitude, radius=radius)

@location_router.get("/v1/geocode", summary="Geocode location name to coordinates")
def route_geocode(q: str):
    return geocode_location(q=q)

@location_router.get("/v1/area/detect", summary="Detect area name for coordinates")
def route_area_detect(latitude: float, longitude: float):
    return detect_area(latitude=latitude, longitude=longitude)

@location_router.post("/v1/recommend", summary="Recommend billboards based on campaign criteria")
def route_recommend_billboards(req: RecommendationRequest):
    return recommend_billboards(req=req)

@location_router.post("/v1/admin/create-user", summary="Secure admin endpoint to create owner/brand users")
async def route_admin_create_user(req: AdminCreateUserRequest, admin_id: str = Depends(verify_admin)):
    return await admin_create_user(req=req, admin_id=admin_id)

# ─────────────────────────────────────────────────────────────
# Traffic Intelligence Router (/api/traffic/...)
# ─────────────────────────────────────────────────────────────
traffic_router = APIRouter(prefix="/api/traffic", tags=["Traffic Intelligence"])

@traffic_router.get("/cameras", response_model=List[CameraInfo], summary="List monitored traffic cameras")
def route_traffic_cameras():
    return get_cameras()

@traffic_router.get("/latest", response_model=TrafficRecord, summary="Get latest traffic record for camera")
def route_traffic_latest(camera_code: str = Query(..., description="Camera code to filter by")):
    return get_latest_traffic(camera_code=camera_code)

@traffic_router.get("/stream", summary="Server-Sent Events (SSE) live traffic stream")
async def route_traffic_stream(request: Request, camera_code: Optional[str] = Query(None, description="Optional camera code filter")):
    return await traffic_stream(request=request, camera_code=camera_code)

# ─────────────────────────────────────────────────────────────
# Register Routers
# ─────────────────────────────────────────────────────────────
app.include_router(location_router)
app.include_router(traffic_router)

# ─────────────────────────────────────────────────────────────
# Standalone Execution Entrypoint
# ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    logger.info(f"Starting Aculion Unified Backend on 0.0.0.0:{port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
