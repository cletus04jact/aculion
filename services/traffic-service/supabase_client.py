import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from typing import Optional

logger = logging.getLogger("traffic-service.supabase")

current_dir = Path(__file__).resolve().parent
load_dotenv()
if (current_dir / ".env").exists():
    load_dotenv(dotenv_path=current_dir / ".env")
if (current_dir.parent / ".env").exists():
    load_dotenv(dotenv_path=current_dir.parent / ".env")
if (current_dir.parent.parent / ".env").exists():
    load_dotenv(dotenv_path=current_dir.parent.parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = None

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.warning("SUPABASE_URL or SUPABASE_KEY is not configured. Running in simulated / mock mode.")
else:
    try:
        from supabase import create_client, Client
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("Supabase client initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
