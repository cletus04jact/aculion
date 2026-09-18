import os
from pathlib import Path
from dotenv import load_dotenv

# Resolve paths - backend/ingestion/config.py is 3 levels deep from project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
env_path = PROJECT_ROOT / '.env'
load_dotenv(dotenv_path=env_path)

# Supabase API credentials
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://buqtshfptmqieaqcghfx.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# PostgreSQL/PostGIS Direct Database connection url
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 5432))
DB_NAME = os.getenv("DB_NAME", "location_intelligence")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "NewPassword123")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    from urllib.parse import quote_plus
    DATABASE_URL = f"postgresql://{DB_USER}:{quote_plus(DB_PASSWORD)}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
else:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://"):]
    # Defensive parsing for passwords containing special characters (like '@')
    if DATABASE_URL.startswith("postgresql://"):
        try:
            url_body = DATABASE_URL[len("postgresql://"):]
            if "@" in url_body:
                parts = url_body.rsplit("@", 1)
                if len(parts) == 2:
                    userinfo, hostinfo = parts[0], parts[1]
                    if ":" in userinfo:
                        username, password = userinfo.split(":", 1)
                        from urllib.parse import unquote, quote_plus
                        DATABASE_URL = f"postgresql://{username}:{quote_plus(unquote(password))}@{hostinfo}"
        except Exception:
            pass

# Directories
PROCESSED_DATA_DIR = (PROJECT_ROOT / "data" / "processed").resolve()
LOGS_DIR = (PROJECT_ROOT / "logs").resolve()
REPORTS_DIR = LOGS_DIR / "reports"

# Ensure folders exist
PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

# Performance tuning
BATCH_SIZE = int(os.getenv("BATCH_SIZE", 5000))
RETRY_LIMIT = int(os.getenv("RETRY_LIMIT", 3))
RETRY_BACKOFF = int(os.getenv("RETRY_BACKOFF", 2))
