import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from supabase_client import supabase
from realtime_manager import manager
from routes import router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("traffic-service.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    logger.info("Starting Traffic Intelligence Backend Service...")
    await manager.start()
    
    yield
    
    # Shutdown actions
    logger.info("Stopping Traffic Intelligence Backend Service...")
    await manager.stop()

app = FastAPI(
    title="Aculion Traffic Intelligence Service",
    description="FastAPI service serving realtime traffic camera updates using Supabase Realtime.",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
default_origins = [
    "http://localhost:5173",
    "http://localhost:5176",
    "https://www.aculion.com",
    "https://aculion.com"
]
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
frontend_url_env = os.getenv("FRONTEND_URL", "")

allowed_origins_set = set(default_origins)
if allowed_origins_env:
    for orig in allowed_origins_env.split(","):
        if orig.strip():
            allowed_origins_set.add(orig.strip())
if frontend_url_env:
    for orig in frontend_url_env.split(","):
        if orig.strip():
            allowed_origins_set.add(orig.strip())

allowed_origins = sorted(list(allowed_origins_set))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8095))
    logger.info(f"Starting Traffic Service on port {port}...")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
