import os
import time
import json
import logging
import httpx
from datetime import datetime
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv

# Try loading from local environment first
load_dotenv()
# Also try loading from services/.env or root .env if it exists
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
if os.path.exists(env_path):
    load_dotenv(env_path)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("api-gateway")

app = FastAPI(
    title="Aculion API Gateway",
    description="Single public entry point for Aculion Platform APIs.",
    version="1.0.0"
)

# CORS setup
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5176")
allowed_origins = [orig.strip() for orig in allowed_origins_str.split(",") if orig.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

LOCATION_SERVICE_URL = os.getenv("LOCATION_SERVICE_URL", "http://localhost:8000").rstrip("/")
TRAFFIC_SERVICE_URL = os.getenv("TRAFFIC_SERVICE_URL", "http://localhost:8095").rstrip("/")

async_client = httpx.AsyncClient()

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "api-gateway",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/health/services")
async def health_services():
    services_status = {}
    
    # Check Location Service
    try:
        start = time.perf_counter()
        res = await async_client.get(f"{LOCATION_SERVICE_URL}/", timeout=2.0)
        duration = time.perf_counter() - start
        if res.status_code == 200:
            services_status["location-service"] = {
                "status": "healthy",
                "latency_sec": round(duration, 3),
                "url": LOCATION_SERVICE_URL
            }
        else:
            services_status["location-service"] = {
                "status": "unhealthy",
                "status_code": res.status_code,
                "url": LOCATION_SERVICE_URL
            }
    except Exception as e:
        services_status["location-service"] = {
            "status": "unhealthy",
            "error": str(e),
            "url": LOCATION_SERVICE_URL
        }
        
    # Check Traffic Service
    try:
        start = time.perf_counter()
        res = await async_client.get(f"{TRAFFIC_SERVICE_URL}/health", timeout=2.0)
        duration = time.perf_counter() - start
        if res.status_code == 200:
            services_status["traffic-service"] = {
                "status": "healthy",
                "latency_sec": round(duration, 3),
                "url": TRAFFIC_SERVICE_URL
            }
        else:
            services_status["traffic-service"] = {
                "status": "unhealthy",
                "status_code": res.status_code,
                "url": TRAFFIC_SERVICE_URL
            }
    except Exception as e:
        services_status["traffic-service"] = {
            "status": "unhealthy",
            "error": str(e),
            "url": TRAFFIC_SERVICE_URL
        }
        
    return {
        "status": "ok",
        "services": services_status
    }

# Helper to log requests
def log_gateway_request(method: str, route: str, status_code: int, duration: float, upstream: str):
    # Standard format: timestamp, HTTP method, route, response status, request duration, upstream service
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    logger.info(f"[{timestamp}] {method} {route} -> {status_code} ({duration:.3f}s) upstream: {upstream}")

# Catch-all routes for routing/proxying
async def proxy_request(target_url: str, request: Request, upstream_service: str) -> Response:
    method = request.method
    params = request.query_params
    
    # Strip client-specific request headers like Host and Connection, but preserve Auth and Content-Type
    headers = {k: v for k, v in request.headers.items() if k.lower() not in {"host", "connection", "content-length"}}
    body = await request.body()
    
    # Check for SSE stream expectations
    is_stream = "text/event-stream" in request.headers.get("accept", "") or "stream" in request.url.path
    
    start_time = time.perf_counter()
    
    if is_stream:
        async def stream_generator():
            try:
                async with async_client.stream(
                    method=method,
                    url=target_url,
                    params=params,
                    headers=headers,
                    content=body,
                    timeout=None
                ) as response:
                    # Log initial proxy routing
                    duration = time.perf_counter() - start_time
                    log_gateway_request(method, request.url.path, response.status_code, duration, f"{upstream_service} (Stream)")
                    async for chunk in response.aiter_bytes():
                        yield chunk
            except httpx.ConnectError:
                yield b"data: {\"success\": false, \"message\": \"Upstream service unavailable\"}\n\n"
            except Exception as e:
                yield f"data: {{\"success\": false, \"message\": \"Stream proxy error: {str(e)}\"}}\n\n".encode("utf-8")
                
        return StreamingResponse(stream_generator(), media_type="text/event-stream")
        
    else:
        try:
            response = await async_client.request(
                method=method,
                url=target_url,
                params=params,
                headers=headers,
                content=body,
                timeout=60.0
            )
            
            duration = time.perf_counter() - start_time
            log_gateway_request(method, request.url.path, response.status_code, duration, upstream_service)
            
            # Extract headers and strip CORS headers to prevent duplicate headers in browser
            headers_to_strip = {
                "access-control-allow-origin",
                "access-control-allow-credentials",
                "access-control-allow-headers",
                "access-control-allow-methods",
                "content-encoding",
                "content-length",
                "transfer-encoding",
                "connection"
            }
            res_headers = {k: v for k, v in response.headers.items() if k.lower() not in headers_to_strip}
            
            return Response(
                content=response.content,
                status_code=response.status_code,
                headers=res_headers,
                media_type=response.headers.get("content-type")
            )
        except httpx.ConnectError:
            duration = time.perf_counter() - start_time
            log_gateway_request(method, request.url.path, 503, duration, upstream_service)
            return Response(
                content=json.dumps({"success": False, "message": f"{upstream_service.capitalize()} service temporarily unavailable"}),
                status_code=503,
                media_type="application/json"
            )
        except httpx.TimeoutException:
            duration = time.perf_counter() - start_time
            log_gateway_request(method, request.url.path, 504, duration, upstream_service)
            return Response(
                content=json.dumps({"success": False, "message": f"{upstream_service.capitalize()} service request timed out"}),
                status_code=504,
                media_type="application/json"
            )
        except Exception as e:
            duration = time.perf_counter() - start_time
            log_gateway_request(method, request.url.path, 500, duration, upstream_service)
            return Response(
                content=json.dumps({"success": False, "message": f"Gateway error: {str(e)}"}),
                status_code=500,
                media_type="application/json"
            )

@app.api_route("/api/location/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def route_location(path: str, request: Request):
    # Mapping /api/location/* -> LOCATION_SERVICE_URL/api/*
    path_in_service = request.url.path.replace("/api/location", "/api")
    target_url = f"{LOCATION_SERVICE_URL}{path_in_service}"
    return await proxy_request(target_url, request, "location-service")

@app.api_route("/api/traffic/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def route_traffic(path: str, request: Request):
    # Mapping /api/traffic/* -> TRAFFIC_SERVICE_URL/traffic/*
    path_in_service = request.url.path.replace("/api/traffic", "/traffic")
    target_url = f"{TRAFFIC_SERVICE_URL}{path_in_service}"
    return await proxy_request(target_url, request, "traffic-service")
