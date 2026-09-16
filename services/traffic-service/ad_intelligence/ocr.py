"""
OCR Module for DOOH Advertisement Intelligence.
Interfaces with existing front_camera multilingual BillboardOCR engine
and adds advanced text normalization, keyword extraction, and brand heuristic tagging.
"""

import re
import sys
import os
import logging
from typing import Optional, Dict, Any, List
import numpy as np

from .config import settings

logger = logging.getLogger("AdIntelligence.OCR")

# Add front_camera directory to sys.path so we can import existing BillboardOCR
FRONT_CAMERA_PATH = os.path.abspath("E:/Aculion/front_camera/front_camera")
if FRONT_CAMERA_PATH not in sys.path:
    sys.path.insert(0, FRONT_CAMERA_PATH)

try:
    from ocr import BillboardOCR
    from ocr.preprocessing import enhance_billboard_image
    HAS_BILLBOARD_OCR = True
    logger.info("Successfully imported BillboardOCR from front_camera pipeline.")
except ImportError as e:
    HAS_BILLBOARD_OCR = False
    logger.warning(f"Could not import BillboardOCR directly: {e}. Fallback OCR will be used.")


class TextNormalizer:
    """
    Normalizes OCR text to enable robust creative matching despite minor OCR noise.
    """

    @staticmethod
    def normalize(text: str) -> str:
        if not text:
            return ""

        # Convert to lower case
        cleaned = text.lower()
        # Replace common OCR misreads / noise
        cleaned = re.sub(r'[\r\n\t]+', ' ', cleaned)
        # Remove non-alphanumeric characters except basic spaces
        cleaned = re.sub(r'[^\w\s]', ' ', cleaned, flags=re.UNICODE)
        # Collapse multi-spaces
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        return cleaned

    @staticmethod
    def extract_brand_candidate(text: str, text_regions: List[Dict[str, Any]]) -> str:
        """
        Heuristic extractor for primary brand name from OCR text regions.
        Prefers top-positioned, large-font / highest-confidence text tokens.
        """
        if not text:
            return "Commercial Creative"

        # If we have bounding box text regions, look for prominent regions
        if text_regions:
            # Sort regions by vertical position and confidence
            valid_regions = [r for r in text_regions if len(r.get("text", "").strip()) >= 3]
            if valid_regions:
                # Top-most high-confidence region
                top_region = max(valid_regions, key=lambda r: r.get("confidence", 0.0))
                brand = top_region.get("text", "").strip()
                if len(brand) > 2:
                    return brand[:40].title()

        # Fallback to first major words of text
        words = text.split()
        if words:
            candidate = " ".join(words[:3])
            return candidate.strip().title()

        return "Commercial Creative"


class AdvertisementOCR:
    """
    Wrapper for Billboard OCR with text normalization and brand discovery.
    """

    def __init__(
        self,
        languages: Optional[List[str]] = None,
        use_gpu: Optional[bool] = settings.USE_GPU,
        min_confidence: float = settings.OCR_CONFIDENCE_THRESHOLD
    ):
        self.languages = languages or settings.OCR_LANGUAGES
        self.use_gpu = use_gpu
        self.min_confidence = min_confidence
        self._ocr_engine = None

    def _get_engine(self):
        if self._ocr_engine is None:
            if HAS_BILLBOARD_OCR:
                logger.info(f"Initializing BillboardOCR engine (languages: {self.languages}, GPU: {self.use_gpu})...")
                self._ocr_engine = BillboardOCR(
                    languages=self.languages,
                    use_gpu=self.use_gpu,
                    min_confidence=self.min_confidence
                )
            else:
                logger.warning("BillboardOCR engine unavailable, running mock engine.")
                self._ocr_engine = None
        return self._ocr_engine

    def extract(self, image: np.ndarray) -> Dict[str, Any]:
        """
        Executes OCR on billboard image ROI and normalizes output.
        """
        if image is None or image.size == 0:
            return {
                "raw_ocr_text": "",
                "normalized_ocr_text": "",
                "ocr_confidence": 0.0,
                "brand_candidate": "Unknown",
                "ad_name_candidate": "Digital Ad",
                "text_regions": [],
                "status": "invalid_image"
            }

        engine = self._get_engine()
        if engine is not None:
            try:
                result = engine.extract_text(image, apply_preprocessing=True)
                raw_text = result.get("full_text", "") or result.get("text", "")
                avg_conf = float(result.get("average_confidence", 0.0) or result.get("confidence", 0.0))
                regions = result.get("text_regions", [])
                normalized_text = TextNormalizer.normalize(raw_text)
                brand = TextNormalizer.extract_brand_candidate(raw_text, regions)
                ad_name = f"{brand} Display" if brand != "Commercial Creative" else "Digital Billboard Creative"

                return {
                    "raw_ocr_text": raw_text,
                    "normalized_ocr_text": normalized_text,
                    "ocr_confidence": round(avg_conf, 4),
                    "brand_candidate": brand,
                    "ad_name_candidate": ad_name,
                    "text_regions": regions,
                    "status": result.get("status", "success")
                }
            except Exception as e:
                logger.error(f"Error during OCR extraction: {e}", exc_info=True)
                return {
                    "raw_ocr_text": "",
                    "normalized_ocr_text": "",
                    "ocr_confidence": 0.0,
                    "brand_candidate": "Unknown",
                    "ad_name_candidate": "Digital Ad",
                    "text_regions": [],
                    "status": f"error: {str(e)}"
                }
        else:
            return {
                "raw_ocr_text": "",
                "normalized_ocr_text": "",
                "ocr_confidence": 0.0,
                "brand_candidate": "Commercial Creative",
                "ad_name_candidate": "Digital Ad",
                "text_regions": [],
                "status": "engine_unavailable"
            }
