import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Resolve environment file location
# Try loading from local directory first, then parent directory (services/.env)
current_dir = Path(__file__).resolve().parent
if (current_dir / ".env").exists():
    load_dotenv(dotenv_path=current_dir / ".env")
elif (current_dir.parent / ".env").exists():
    load_dotenv(dotenv_path=current_dir.parent / ".env")
else:
    # Fallback to general system env
    load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in the environment variables.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
