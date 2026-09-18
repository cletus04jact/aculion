import sys
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from sqlalchemy import text

# Add backend directory to path to enable package import
sys.path.append(str(Path(__file__).resolve().parent))
print("a")
from ingestion.logger import logger
from ingestion.discover_files import scan_and_discover_files, get_ingestion_status
from ingestion.schema_validator import SchemaValidator
from ingestion.create_tables import verify_and_bootstrap_database
from ingestion.loaders.upsert import load_with_retry, refresh_view_cache
from ingestion.reports import compile_and_save_report
from ingestion.database import engine

def update_history_log(filename, file_hash, row_count, status, error_msg=None):
    """
    Updates the ingestion history table in database.
    """
    query = text("""
        INSERT INTO metadata.ingestion_history (filename, sha256_hash, row_count, status, error_message, last_ingested_at)
        VALUES (:filename, :sha256_hash, :row_count, :status, :error_msg, CURRENT_TIMESTAMP)
        ON CONFLICT (filename) DO UPDATE SET
            sha256_hash = EXCLUDED.sha256_hash,
            row_count = EXCLUDED.row_count,
            status = EXCLUDED.status,
            error_message = EXCLUDED.error_message,
            last_ingested_at = CURRENT_TIMESTAMP;
    """)
    with engine.begin() as conn:
        conn.execute(query, {
            "filename": filename,
            "sha256_hash": file_hash,
            "row_count": row_count,
            "status": status,
            "error_msg": error_msg
        })

def render_progress_bar(iteration, total, prefix='', suffix='', length=40, fill='#'):
    """
    Generates a text-based progress bar in console.
    """
    percent = f"{100 * (iteration / float(total)):.1f}"
    filled_length = int(length * iteration // total)
    bar = fill * filled_length + '-' * (length - filled_length)
    sys.stdout.write(f'\r{prefix} |{bar}| {percent}% {suffix}')
    sys.stdout.flush()
    if iteration == total:
        sys.stdout.write('\n')
        sys.stdout.flush()

def process_file_worker(file_info):
    """
    Orchestrates validation and database load stages for a single CSV file.
    """
    filename = file_info["filename"]
    file_path = file_info["file_path"]
    checksum = file_info["checksum"]
    table_name = filename.replace(".csv", "")
    
    start_time = time.time()
    result = {
        "filename": filename,
        "status": "Skipped",
        "rows_processed": 0,
        "duration_seconds": 0,
        "warnings": [],
        "error": None
    }
    
    # Check if ingestion needed
    if not file_info["needs_ingestion"]:
        logger.info(f"Metadata Hash Match: Skipping {filename}.")
        return result

    try:
        # 1. Validation
        df, warnings = SchemaValidator.validate(file_path, filename)
        result["warnings"] = warnings
        
        if df is None:
            err_msg = f"Schema validation failed: {warnings}"
            logger.error(err_msg)
            result["status"] = "Failed"
            result["error"] = err_msg
            update_history_log(filename, checksum, 0, "Failed", err_msg)
            return result
            
        # 2. Database Load
        row_count = len(df)
        logger.info(f"Loading {row_count} rows from {filename} into public.{table_name}...")
        load_with_retry(df, table_name)
        
        # 3. Logging status update
        update_history_log(filename, checksum, row_count, "Success")
        result["status"] = "Success"
        result["rows_processed"] = row_count
        
    except Exception as e:
        err_msg = str(e)
        logger.error(f"Failed loading {filename}: {err_msg}")
        result["status"] = "Failed"
        result["error"] = err_msg
        try:
            update_history_log(filename, checksum, 0, "Failed", err_msg)
        except Exception as log_err:
            logger.error(f"Failed updating metadata database logs: {log_err}")
            
    result["duration_seconds"] = round(time.time() - start_time, 2)
    return result

def run_pipeline():
    """
    Bootstraps the database and orchestrates file ingestion concurrently.
    """
    logger.info("Initializing Spatial Data Ingestion Pipeline...")
    pipeline_start = time.time()
    
    # 1. Prepare Target Database Schemas & Tables
    try:
        verify_and_bootstrap_database()
    except Exception as e:
        logger.critical(f"Database bootstrap failed. Ingestion aborted: {e}")
        sys.exit(1)
        
    # 2. Discovery
    discovered_files = scan_and_discover_files()
    files_to_load = [f for f in discovered_files if f["needs_ingestion"]]
    
    if not files_to_load:
        logger.info("All files are up to date. Ingestion skipped.")
        return
        
    total_files = len(discovered_files)
    logger.info(f"Found {len(files_to_load)} files requiring ingestion out of {total_files} discovered.")
    
    report_details = []
    
    # Add files that do not need load directly to report detail mapping
    for f in discovered_files:
        if not f["needs_ingestion"]:
            report_details.append({
                "filename": f["filename"],
                "status": "Skipped",
                "rows_processed": 0,
                "duration_seconds": 0,
                "warnings": [],
                "error": None
            })

    # Render starting progress bar
    completed_steps = total_files - len(files_to_load)
    render_progress_bar(completed_steps, total_files, prefix='Ingestion Progress:', suffix='Initializing workers...', length=30)

    # 3. Parallel worker execution
    with ThreadPoolExecutor(max_workers=min(len(files_to_load), 4)) as executor:
        futures = {executor.submit(process_file_worker, f): f["filename"] for f in files_to_load}
        
        for future in as_completed(futures):
            filename = futures[future]
            try:
                res = future.result()
                report_details.append(res)
                completed_steps += 1
                render_progress_bar(
                    completed_steps, 
                    total_files, 
                    prefix='Ingestion Progress:', 
                    suffix=f"Finished {filename}", 
                    length=30
                )
            except Exception as exc:
                logger.error(f"Worker generated exception for {filename}: {exc}")

    # 4. Refresh PostGIS views
    refresh_view_cache()
    
    # 5. Compile & save JSON reports
    pipeline_duration = round(time.time() - pipeline_start, 2)
    report = compile_and_save_report(report_details)
    
    logger.info(f"Pipeline execution finished. Duration: {pipeline_duration}s.")
    logger.info(f"Summary: Success: {report['success_count']}, Failed: {report['failed_count']}, Skipped: {report['skipped_count']}.")

if __name__ == "__main__":
    run_pipeline()
