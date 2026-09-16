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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(router)
