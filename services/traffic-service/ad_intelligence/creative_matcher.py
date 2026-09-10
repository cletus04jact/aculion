"""
Ad Creative Identification and Deduplication Matcher.
Combines OCR text fuzzy matching and perceptual visual hash Hamming distance
to identify returning creatives or register new ones.
"""

import difflib
import logging
from typing import Optional, List, Dict, Tuple
from datetime import datetime, timezone
import uuid

from .models import AdCreative
from .change_detector import VisualChangeDetector
from .config import settings

logger = logging.getLogger("AdIntelligence.CreativeMatcher")


class CreativeMatcher:
    """
    Fingerprints and matches ad creatives to prevent duplicate registrations.
    Maintains a cache of known creatives for the active billboard.
    """

    def __init__(
        self,
        match_threshold: float = settings.CREATIVE_MATCH_THRESHOLD,
        text_weight: float = settings.TEXT_SIMILARITY_WEIGHT,
        visual_weight: float = settings.VISUAL_SIMILARITY_WEIGHT
    ):
        self.match_threshold = match_threshold
        self.text_weight = text_weight
        self.visual_weight = visual_weight
        self.known_creatives: Dict[str, AdCreative] = {}  # creative_id -> AdCreative

    def load_existing_creatives(self, creatives: List[AdCreative]):
        """Load known creatives into memory cache."""
        for c in creatives:
            self.known_creatives[c.creative_id] = c
        logger.info(f"Loaded {len(creatives)} existing creatives into matcher cache.")

    @staticmethod
    def calculate_text_similarity(text1: str, text2: str) -> float:
        """
        Calculates token-aware text similarity in range [0.0 - 1.0].
        Handles OCR word order variations and minor character errors.
        """
        if not text1 and not text2:
            return 0.5  # Neutral if both are image-only ads without text
        if not text1 or not text2:
            return 0.0

        # Sequence matcher ratio
        seq_ratio = difflib.SequenceMatcher(None, text1, text2).ratio()

        # Token set overlap
        tokens1 = set(text1.split())
        tokens2 = set(text2.split())
        if tokens1 and tokens2:
            token_overlap = len(tokens1 & tokens2) / float(max(len(tokens1), len(tokens2)))
        else:
            token_overlap = 0.0

        return float(0.4 * seq_ratio + 0.6 * token_overlap)

    def calculate_visual_similarity(self, hash1: str, hash2: str) -> float:
        """
        Calculates visual similarity in range [0.0 - 1.0] from perceptual hashes.
        """
        if not hash1 or not hash2:
            return 0.0

        parts1 = hash1.split("_")
        parts2 = hash2.split("_")
        if len(parts1) == 2 and len(parts2) == 2:
            d_dist = VisualChangeDetector.hamming_distance(parts1[0], parts2[0])
            p_dist = VisualChangeDetector.hamming_distance(parts1[1], parts2[1])
            dist = (d_dist * 0.45) + (p_dist * 0.55)
        else:
            dist = VisualChangeDetector.hamming_distance(hash1, hash2)

        return float(np_clip := max(0.0, min(1.0, 1.0 - dist)))

    def match_or_create(
        self,
        billboard_id: str,
        visual_hash: str,
        raw_ocr_text: str,
        normalized_ocr_text: str,
        brand_candidate: Optional[str] = None,
        ad_name_candidate: Optional[str] = None,
        evidence_image_url: Optional[str] = None
    ) -> Tuple[AdCreative, bool, float]:
        """
        Matches incoming ad observation against known creatives.
        
        Returns:
            (creative, is_new, match_confidence)
        """
        best_match: Optional[AdCreative] = None
        best_score: float = 0.0

        for candidate in self.known_creatives.values():
            if candidate.billboard_id != billboard_id:
                continue

            # Visual similarity
            vis_sim = self.calculate_visual_similarity(visual_hash, candidate.visual_hash or "")

            # Text similarity
            text_sim = self.calculate_text_similarity(normalized_ocr_text, candidate.normalized_ocr_text or "")

            # Weighted combination
            if not normalized_ocr_text and not candidate.normalized_ocr_text:
                # Both are pure visual ads without text
                composite_score = vis_sim
            elif not normalized_ocr_text or not candidate.normalized_ocr_text:
                composite_score = (0.75 * vis_sim) + (0.25 * text_sim)
            else:
                composite_score = (self.visual_weight * vis_sim) + (self.text_weight * text_sim)

            if composite_score > best_score:
                best_score = composite_score
                best_match = candidate

        # Decision
        if best_match is not None and best_score >= self.match_threshold:
            # Reusing existing creative
            best_match.last_seen_at = datetime.now(timezone.utc)
            if evidence_image_url and not best_match.representative_image_url:
                best_match.representative_image_url = evidence_image_url
            
            logger.info(
                f"CREATIVE_MATCHED: Reusing existing creative_id={best_match.creative_id} "
                f"('{best_match.ad_name}') with match score {best_score:.3f}"
            )
            return best_match, False, best_score
        else:
            # Creating new creative
            new_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc)
            brand = brand_candidate or "Commercial Creative"
            ad_name = ad_name_candidate or f"{brand} Ad #{len(self.known_creatives) + 1}"

            new_creative = AdCreative(
                creative_id=new_id,
                billboard_id=billboard_id,
                brand_name=brand,
                ad_name=ad_name,
                raw_ocr_text=raw_ocr_text,
                normalized_ocr_text=normalized_ocr_text,
                visual_hash=visual_hash,
                representative_image_url=evidence_image_url,
                first_seen_at=now,
                last_seen_at=now,
                created_at=now
            )
            self.known_creatives[new_id] = new_creative

            logger.info(
                f"NEW_CREATIVE_CREATED: Registered new creative_id={new_id} "
                f"('{ad_name}', Brand: '{brand}')"
            )
            return new_creative, True, 1.0
