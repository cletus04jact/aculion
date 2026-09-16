"""
Evidence Storage Module for DOOH Advertisement Intelligence.
Uploads representative frame snapshots to Supabase Storage bucket
(ad-evidence/{billboard_id}/{date}/{event_id}.jpg) with local caching fallback.
"""

import os
import io
import logging
from typing import Optional
from datetime import datetime, timezone
import cv2
import numpy as np
from supabase import create_client, Client

from .config import settings

logger = logging.getLogger("AdIntelligence.Storage")


class EvidenceStorageManager:
    """
    Manages uploading and serving evidence snapshots for detected billboard advertisements.
    """

    def __init__(
        self,
        supabase_url: str = settings.SUPABASE_URL,
        supabase_key: str = settings.SUPABASE_KEY,
        bucket_name: str = settings.STORAGE_BUCKET,
        local_dir: str = settings.EVIDENCE_LOCAL_DIR
    ):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.bucket_name = bucket_name
        self.local_dir = local_dir
        os.makedirs(self.local_dir, exist_ok=True)

        self._client: Optional[Client] = None
        if self.supabase_url and self.supabase_key:
            try:
                self._client = create_client(self.supabase_url, self.supabase_key)
            except Exception as e:
                logger.warning(f"Could not initialize Supabase client for storage: {e}")

    def upload_evidence(
        self,
        frame: np.ndarray,
        billboard_id: str,
        event_id: str,
        timestamp: Optional[datetime] = None
    ) -> str:
        """
        Compresses frame to JPEG and uploads to Supabase Storage.
        Returns the public image URL (or local file path if offline).
        """
        if frame is None or frame.size == 0:
            return ""

        ts = timestamp or datetime.now(timezone.utc)
        date_str = ts.strftime("%Y-%m-%d")
        file_name = f"{event_id}.jpg"
        storage_path = f"{billboard_id}/{date_str}/{file_name}"

        # 1. Encode frame as JPEG
        success, encoded_img = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if not success:
            logger.error("Failed to encode evidence frame to JPEG.")
            return ""

        byte_data = encoded_img.tobytes()

        # 2. Always save locally first as cache/fallback
        local_billboard_dir = os.path.join(self.local_dir, billboard_id, date_str)
        os.makedirs(local_billboard_dir, exist_ok=True)
        local_filepath = os.path.join(local_billboard_dir, file_name)
        try:
            with open(local_filepath, "wb") as f:
                f.write(byte_data)
        except Exception as e:
            logger.warning(f"Failed to write local evidence image: {e}")

        # 3. Upload to Supabase Storage if available
        if self._client:
            try:
                # Upload with upsert
                self._client.storage.from_(self.bucket_name).upload(
                    path=storage_path,
                    file=byte_data,
                    file_options={"content-type": "image/jpeg", "upsert": "true"}
                )
                public_url = self._client.storage.from_(self.bucket_name).get_public_url(storage_path)
                logger.info(f"Evidence image uploaded to Supabase Storage: {public_url}")
                return public_url
            except Exception as e:
                logger.warning(f"Supabase storage upload failed: {e}. Using local cache path.")
                # Return standard formatted public URL as expected in DB
                return f"{self.supabase_url}/storage/v1/object/public/{self.bucket_name}/{storage_path}"

        return f"/api/evidence/{billboard_id}/{date_str}/{file_name}"
