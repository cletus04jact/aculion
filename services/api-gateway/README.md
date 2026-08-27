# Aculion API Gateway

The API Gateway is the **single public entry point** for all incoming external HTTP and EventSource (SSE) requests on the Aculion platform. It routes requests internally to the appropriate downstream backend services, providing centralized CORS configuration, request logging, and unified error handling.

## Architecture

```text
                    Internet
                       │
                       ▼
                 Web Application
                  apps/web
                       │
                       │ HTTPS
                       ▼
              ┌──────────────────┐
              │    API Gateway   │
              │ services/        │
              │ api-gateway/     │ (Port 8080)
              └────────┬─────────┘
                       │
             ┌─────────┴──────────┐
             │                    │
             ▼                    ▼
     /api/location/*       /api/traffic/*
             │                    │
             ▼                    ▼
    location-service       traffic-service
      (Port 8000)            (Port 8095)
```

## Available Routes

### Gateway Health Check
- `GET /health`: Returns gateway service status.
- `GET /health/services`: Performs active availability checks on location-service and traffic-service.

### Proxied Backend Routes
- `GET/POST/PUT/DELETE/OPTIONS /api/location/*`: Proxy targets `http://localhost:8000/api/*` (strips `/api/location` prefix and replaces with `/api`).
- `GET/OPTIONS /api/traffic/*`: Proxy targets `http://localhost:8095/traffic/*` (strips `/api/traffic` prefix and replaces with `/traffic`, fully supporting Server-Sent Events streaming).

## Environment Variables

Configure the gateway using a `.env` file in the gateway folder or services folder:

```env
PORT=8080
LOCATION_SERVICE_URL=http://localhost:8000
TRAFFIC_SERVICE_URL=http://localhost:8095
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5176
```

- **PORT**: Port the gateway listens on. Matches Railway's automated `$PORT` variable in production.
- **LOCATION_SERVICE_URL**: The backend URL for the location-service.
- **TRAFFIC_SERVICE_URL**: The backend URL for the traffic-service.
- **ALLOWED_ORIGINS**: Comma-separated list of origins permitted to communicate with the API Gateway. In production, this should only include the specific frontend domain names (e.g. `https://www.aculion.com`).

## Local Startup

First install the python dependencies:
```bash
pip install -r requirements.txt
```

Start the uvicorn development server:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
```

Alternatively, launch the complete platform using the root script:
```powershell
.\start-dev.ps1
```

## Service Routing

The gateway forwards requests by creating a client connection via `httpx.AsyncClient`:
- **HTTP Methods:** Preserves GET, POST, PUT, DELETE, PATCH, OPTIONS.
- **Payloads:** Forwards query parameters, path variables, request bodies, and headers (such as `Authorization` and `Content-Type`).
- **CORS:** CORS headers from downstream services are stripped, allowing the gateway's central middleware to control CORS rules uniformly.
- **Error Responses:** Connection errors and timeouts are translated into standardized JSON error responses, preventing leakage of internal stack traces.

## Railway Deployment

1. Set up a service in your Railway project pointing to `services/api-gateway`.
2. Add the following environment variables:
   - `PORT`: (Managed by Railway automatically).
   - `LOCATION_SERVICE_URL`: Internal private networking address of location-service (e.g. `http://location-service.railway.internal:8000`).
   - `TRAFFIC_SERVICE_URL`: Internal private networking address of traffic-service (e.g. `http://traffic-service.railway.internal:8095`).
   - `ALLOWED_ORIGINS`: Your production frontend URLs.
3. Deploy the service. Only the `api-gateway` needs to be publicly exposed; `location-service` and `traffic-service` can remain private within the Railway network.

## Adding a New Backend Service

To add a new backend service under the API Gateway:
1. Implement your service under `services/<new-service-name>`.
2. Set the routing URL as an environment variable in the gateway (e.g., `NEW_SERVICE_URL`).
3. Add a new API route in [services/api-gateway/app/main.py](file:///e:/Aculion/site/aculion-site-main/aculion-platform/services/api-gateway/app/main.py):

```python
NEW_SERVICE_URL = os.getenv("NEW_SERVICE_URL", "http://localhost:8085").rstrip("/")

@app.api_route("/api/new-service/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def route_new_service(path: str, request: Request):
    path_in_service = request.url.path.replace("/api/new-service", "/api") # customize prefix stripping as needed
    target_url = f"{NEW_SERVICE_URL}{path_in_service}"
    return await proxy_request(target_url, request, "new-service")
```
