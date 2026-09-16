import os
from datetime import datetime
from collections import Counter

from dotenv import load_dotenv
from supabase import create_client, Client


# ============================================================
# CONFIGURATION
# ============================================================

load_dotenv()

SUPABASE_URL = "https://buqtshfptmqieaqcghfx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1cXRzaGZwdG1xaWVhcWNnaGZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzkwOTYyMiwiZXhwIjoyMDk5NDg1NjIyfQ.f12uC9oK_BzLzlXgy_5ybUAgdHJTY6N7E5VWXXmgr5Q"

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env"
    )

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
)


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def print_title(title: str):
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)


def print_subtitle(title: str):
    print("\n" + "-" * 80)
    print(title)
    print("-" * 80)


def print_rows(rows, empty_message="No records found."):
    if not rows:
        print(empty_message)
        return

    for index, row in enumerate(rows, start=1):
        print(f"\nRecord {index}")
        for key, value in row.items():
            print(f"  {key}: {value}")


def fetch_table(table_name: str, limit: int = 100):
    """
    Fetch records from a table.
    """
    response = (
        supabase
        .table(table_name)
        .select("*")
        .limit(limit)
        .execute()
    )

    return response.data or []


def count_table_rows(table_name: str):
    """
    Count rows in a table using Supabase's exact count option.
    """
    response = (
        supabase
        .table(table_name)
        .select("*", count="exact", head=True)
        .execute()
    )

    return response.count or 0


# ============================================================
# TABLE REPORT
# ============================================================

def show_table_overview():
    print_title("TRAFFIC DATA PIPELINE - TABLE OVERVIEW")

    table_purposes = {
        "traffic_overview": (
            "Current live traffic state. Usually one row per billboard."
        ),
        "traffic_overview_history": (
            "Short-term snapshots of cumulative readings used for "
            "hourly calculations."
        ),
        "traffic_hour": (
            "Permanent hourly aggregation for each billboard."
        ),
        "traffic_day": (
            "Permanent daily aggregation for each billboard."
        ),
        "traffic_week": (
            "Weekly aggregation for each billboard."
        ),
        "traffic_monthly": (
            "Monthly aggregation for each billboard."
        ),
    }

    for table_name, purpose in table_purposes.items():
        try:
            count = count_table_rows(table_name)

            print(f"\nTable: {table_name}")
            print(f"Purpose: {purpose}")
            print(f"Row count: {count}")

        except Exception as error:
            print(f"\nTable: {table_name}")
            print(f"Purpose: {purpose}")
            print(f"Status: Could not read table")
            print(f"Error: {error}")


# ============================================================
# LIVE DATA REPORT
# ============================================================

def show_live_data():
    print_title("1. CURRENT LIVE DATA - traffic_overview")

    try:
        rows = (
            supabase
            .table("traffic_overview")
            .select("*")
            .order("last_updated", desc=True)
            .limit(20)
            .execute()
            .data
        )

        print_rows(rows)

    except Exception as error:
        print(f"Error reading traffic_overview: {error}")


# ============================================================
# HISTORY REPORT
# ============================================================

def show_history_data():
    print_title("2. HISTORY SNAPSHOTS - traffic_overview_history")

    try:
        rows = (
            supabase
            .table("traffic_overview_history")
            .select("*")
            .order("recorded_at", desc=True)
            .limit(20)
            .execute()
            .data
        )

        print_rows(rows)

        print_subtitle("History Snapshot Count by Billboard")

        all_rows = (
            supabase
            .table("traffic_overview_history")
            .select("billboard_code")
            .limit(10000)
            .execute()
            .data
        )

        counts = Counter(
            row.get("billboard_code")
            for row in all_rows
            if row.get("billboard_code")
        )

        if not counts:
            print("No history records found.")
        else:
            for billboard_code, count in counts.items():
                print(f"{billboard_code}: {count} snapshots")

    except Exception as error:
        print(f"Error reading traffic_overview_history: {error}")


# ============================================================
# HOURLY REPORT
# ============================================================

def show_hourly_data():
    print_title("3. HOURLY AGGREGATION - traffic_hour")

    try:
        rows = (
            supabase
            .table("traffic_hour")
            .select("*")
            .order("date", desc=True)
            .order("hour", desc=True)
            .limit(50)
            .execute()
            .data
        )

        print_rows(rows)

    except Exception as error:
        print(f"Error reading traffic_hour: {error}")


# ============================================================
# DAILY REPORT
# ============================================================

def show_daily_data():
    print_title("4. DAILY AGGREGATION - traffic_day")

    try:
        rows = (
            supabase
            .table("traffic_day")
            .select("*")
            .order("date", desc=True)
            .limit(50)
            .execute()
            .data
        )

        print_rows(rows)

    except Exception as error:
        print(f"Error reading traffic_day: {error}")


# ============================================================
# FUNCTION REPORT
# ============================================================

def show_database_functions():
    print_title("5. DATABASE FUNCTIONS")

    print(
        """
The following functions should normally exist:

1. set_traffic_overview_hour()
   Sets the IST hour value in traffic_overview.

2. log_traffic_overview_history()
   Copies live traffic updates into traffic_overview_history.

3. process_previous_hour()
   Converts history snapshots into traffic_hour.

4. process_previous_day()
   Converts traffic_hour records into traffic_day.

5. cleanup_traffic_overview_history()
   Deletes history records older than the retention period.
        """
    )

    print(
        "Note: Supabase's normal data API cannot directly query "
        "pg_proc without an exposed RPC function."
    )

    print(
        "Use the SQL query below in Supabase SQL Editor to see "
        "the exact installed function definitions:"
    )

    print(
        """
SELECT
    n.nspname AS schema_name,
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n
    ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
      p.proname ILIKE '%traffic%'
      OR p.proname ILIKE '%hour%'
      OR p.proname ILIKE '%day%'
      OR p.proname ILIKE '%history%'
  )
ORDER BY p.proname;
        """
    )


# ============================================================
# TRIGGER REPORT
# ============================================================

def show_triggers():
    print_title("6. DATABASE TRIGGERS")

    print(
        """
Expected trigger flow:

traffic_overview INSERT or UPDATE
    |
    +--> trg_set_traffic_overview_hour
    |        |
    |        +--> set_traffic_overview_hour()
    |
    +--> trg_log_traffic_overview_history
             |
             +--> log_traffic_overview_history()
                      |
                      +--> traffic_overview_history
        """
    )

    print(
        "Use this SQL in Supabase SQL Editor to see the exact triggers:"
    )

    print(
        """
SELECT
    event_object_schema,
    event_object_table,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN (
      'traffic_overview',
      'traffic_overview_history',
      'traffic_hour',
      'traffic_day',
      'traffic_week',
      'traffic_monthly'
  )
ORDER BY event_object_table, trigger_name;
        """
    )


# ============================================================
# CRON REPORT
# ============================================================

def show_cron_jobs():
    print_title("7. CRON JOBS")

    print(
        """
Expected cron jobs:

traffic-hourly-aggregation
    Schedule: 5 * * * *
    Function: process_previous_hour()

traffic-daily-aggregation
    Schedule: 30 18 * * *
    Function: process_previous_day()

traffic-history-cleanup
    Schedule: 20 */2 * * *
    Function: cleanup_traffic_overview_history()
        """
    )

    print(
        "Use this SQL in Supabase SQL Editor to see the actual cron jobs:"
    )

    print(
        """
SELECT
    jobid,
    jobname,
    schedule,
    command,
    active
FROM cron.job
ORDER BY jobid;
        """
    )

    print(
        "Use this SQL to inspect recent cron executions:"
    )

    print(
        """
SELECT
    jobid,
    runid,
    status,
    return_message,
    start_time,
    end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 30;
        """
    )


# ============================================================
# PIPELINE EXPLANATION
# ============================================================

def show_pipeline_explanation():
    print_title("8. COMPLETE DATA PIPELINE")

    print(
        """
Radxa + YOLO
    |
    | Sends cumulative vehicle counts every few seconds
    v
traffic_overview
    |
    | Frontend reads current live values
    |
    | INSERT/UPDATE trigger
    v
traffic_overview_history
    |
    | Stores timestamped snapshots
    | Retains only recent history, for example 6 hours
    |
    | Hourly cron:
    | process_previous_hour()
    v
traffic_hour
    |
    | Daily cron:
    | process_previous_day()
    v
traffic_day
    |
    v
traffic_week
    |
    v
traffic_monthly
        """
    )

    print(
        """
Important calculation:

Radxa cumulative values:

13:01 = 500
13:02 = 525
13:03 = 543

Actual new vehicles:

543 - 500 = 43

Do not calculate:

500 + 525 + 543

because that would double-count cumulative readings.
        """
    )


# ============================================================
# MAIN
# ============================================================

def main():
    start_time = datetime.now()

    print_title("ACULION TRAFFIC PIPELINE INSPECTION")
    print(f"Report started at: {start_time}")

    try:
        show_table_overview()
        show_live_data()
        show_history_data()
        show_hourly_data()
        show_daily_data()
        show_database_functions()
        show_triggers()
        show_cron_jobs()
        show_pipeline_explanation()

    except KeyboardInterrupt:
        print("\nReport interrupted by user.")

    finally:
        end_time = datetime.now()
        print_title("REPORT COMPLETED")
        print(f"Report finished at: {end_time}")
        print(f"Duration: {end_time - start_time}")


if __name__ == "__main__":
    main()