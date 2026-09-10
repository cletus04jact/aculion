"""
Visual Change Detection Module for Digital Billboard Continuous Monitoring.
Implements perceptual hashing, color histogram analysis, structural difference,
and consecutive-frame confirmation with animation suppression.
"""

import logging
from typing import Optional, Tuple, List
import cv2
import numpy as np
from pydantic import BaseModel

from .config import settings

logger = logging.getLogger("AdIntelligence.ChangeDetector")


class ChangeDetectionResult(BaseModel):
    is_changed: bool
    score: float
    confidence: float
    visual_hash: str
    is_stable: bool
    reason: str


class VisualChangeDetector:
    """
    Lightweight, computationally efficient visual change detector designed for
    continuous 24/7 video monitoring.
    """

    def __init__(
        self,
        change_threshold: float = settings.CHANGE_THRESHOLD,
        confirmation_frames: int = settings.CHANGE_CONFIRMATION_FRAMES,
        hash_size: int = 16
    ):
        self.change_threshold = change_threshold
        self.confirmation_frames = confirmation_frames
        self.hash_size = hash_size

        self.last_stable_frame: Optional[np.ndarray] = None
        self.last_stable_hash: Optional[str] = None
        self.last_stable_hist: Optional[np.ndarray] = None
        
        # Buffer for consecutive confirmation
        self.consecutive_change_count: int = 0
        self.candidate_frame_buffer: List[np.ndarray] = []
        self.candidate_hash_buffer: List[str] = []

    def compute_dhash(self, image: np.ndarray) -> str:
        """
        Compute Difference Hash (dHash) - resilient to scaling, compression, and brightness changes.
        """
        if image is None or image.size == 0:
            return "0" * (self.hash_size * self.hash_size)

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        resized = cv2.resize(gray, (self.hash_size + 1, self.hash_size), interpolation=cv2.INTER_AREA)
        # Compute horizontal gradient
        diff = resized[:, 1:] > resized[:, :-1]
        # Convert boolean array to hex string
        return "".join(format(byte, "02x") for byte in np.packbits(diff.flatten()))

    def compute_phash(self, image: np.ndarray) -> str:
        """
        Compute Perceptual Hash (pHash) using 2D Discrete Cosine Transform (DCT).
        """
        if image is None or image.size == 0:
            return "0" * (self.hash_size * self.hash_size)

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        resized = cv2.resize(gray, (32, 32), interpolation=cv2.INTER_AREA).astype(np.float32)
        
        # 2D DCT
        dct = cv2.dct(resized)
        # Take low frequencies (8x8 top-left block)
        dct_low = dct[:8, :8]
        # Median value excluding DC term
        med = np.median(dct_low[1:, 1:])
        diff = dct_low > med
        return "".join(format(byte, "02x") for byte in np.packbits(diff.flatten()))

    def compute_composite_hash(self, image: np.ndarray) -> str:
        """
        Combines dHash + pHash for high-accuracy visual fingerprinting.
        """
        d_h = self.compute_dhash(image)
        p_h = self.compute_phash(image)
        return f"{d_h}_{p_h}"

    def compute_color_histogram(self, image: np.ndarray) -> np.ndarray:
        """
        Compute 3D HSV color histogram normalized to unit sum.
        """
        if image is None or image.size == 0:
            return np.zeros((8 * 8 * 8,), dtype=np.float32)

        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        hist = cv2.calcHist([hsv], [0, 1, 2], None, [8, 8, 8], [0, 180, 0, 256, 0, 256])
        cv2.normalize(hist, hist)
        return hist.flatten()

    @staticmethod
    def hamming_distance(hash1: str, hash2: str) -> float:
        """
        Normalized Hamming distance between two hex string hashes [0.0 - 1.0].
        """
        if not hash1 or not hash2 or len(hash1) != len(hash2):
            return 1.0

        try:
            b1 = bytes.fromhex(hash1)
            b2 = bytes.fromhex(hash2)
            # Count differing bits
            diff_bits = sum(bin(x ^ y).count("1") for x, y in zip(b1, b2))
            total_bits = len(b1) * 8
            return diff_bits / float(total_bits) if total_bits > 0 else 1.0
        except Exception:
            return 1.0

    def compute_visual_difference(
        self,
        frame1: np.ndarray,
        frame2: np.ndarray,
        hash1: Optional[str] = None,
        hash2: Optional[str] = None
    ) -> float:
        """
        Computes multi-dimensional visual difference score in range [0.0, 1.0].
        Weighted combination of:
        1. Perceptual Hash Distance (dHash + pHash)
        2. HSV Color Histogram Bhattacharyya distance
        3. Structural edge difference
        """
        if frame1 is None or frame2 is None or frame1.size == 0 or frame2.size == 0:
            return 1.0

        # 1. Perceptual hash distance
        h1 = hash1 or self.compute_composite_hash(frame1)
        h2 = hash2 or self.compute_composite_hash(frame2)
        
        parts1 = h1.split("_")
        parts2 = h2.split("_")
        if len(parts1) == 2 and len(parts2) == 2:
            d_dist = self.hamming_distance(parts1[0], parts2[0])
            p_dist = self.hamming_distance(parts1[1], parts2[1])
            hash_dist = (d_dist * 0.45) + (p_dist * 0.55)
        else:
            hash_dist = self.hamming_distance(h1, h2)

        # 2. Color histogram distance
        hist1 = self.compute_color_histogram(frame1)
        hist2 = self.compute_color_histogram(frame2)
        # cv2.HISTCMP_BHATTACHARYYA returns distance in [0, 1]
        hist_dist = cv2.compareHist(hist1, hist2, cv2.HISTCMP_BHATTACHARYYA)
        if np.isnan(hist_dist):
            hist_dist = 1.0

        # 3. Structural edge difference (on downscaled grayscale for speed)
        g1 = cv2.resize(cv2.cvtColor(frame1, cv2.COLOR_BGR2GRAY), (128, 128), interpolation=cv2.INTER_AREA)
        g2 = cv2.resize(cv2.cvtColor(frame2, cv2.COLOR_BGR2GRAY), (128, 128), interpolation=cv2.INTER_AREA)
        
        edge1 = cv2.Canny(g1, 50, 150)
        edge2 = cv2.Canny(g2, 50, 150)
        edge_diff = np.mean(np.abs(edge1.astype(float) - edge2.astype(float))) / 255.0

        # Composite score
        composite_score = (0.50 * hash_dist) + (0.35 * hist_dist) + (0.15 * edge_diff)
        return float(np.clip(composite_score, 0.0, 1.0))

    def evaluate_frame(self, frame: np.ndarray) -> ChangeDetectionResult:
        """
        Evaluates an incoming frame against the baseline stable frame.
        Applies consecutive-frame confirmation to prevent transition/animation false triggers.
        """
        if frame is None or frame.size == 0:
            return ChangeDetectionResult(
                is_changed=False,
                score=0.0,
                confidence=0.0,
                visual_hash="",
                is_stable=False,
                reason="invalid_frame"
            )

        current_hash = self.compute_composite_hash(frame)

        # Initial frame
        if self.last_stable_frame is None:
            self.last_stable_frame = frame.copy()
            self.last_stable_hash = current_hash
            self.last_stable_hist = self.compute_color_histogram(frame)
            self.consecutive_change_count = 0
            self.candidate_frame_buffer.clear()
            self.candidate_hash_buffer.clear()
            
            return ChangeDetectionResult(
                is_changed=True,
                score=1.0,
                confidence=1.0,
                visual_hash=current_hash,
                is_stable=True,
                reason="initial_frame"
            )

        # Compute difference with current stable frame
        diff_score = self.compute_visual_difference(
            self.last_stable_frame,
            frame,
            self.last_stable_hash,
            current_hash
        )

        # Case 1: Frame matches current stable frame (Minor noise / internal animation)
        if diff_score < self.change_threshold:
            # Reset transition buffer
            self.consecutive_change_count = 0
            self.candidate_frame_buffer.clear()
            self.candidate_hash_buffer.clear()
            
            return ChangeDetectionResult(
                is_changed=False,
                score=diff_score,
                confidence=round(1.0 - diff_score, 4),
                visual_hash=self.last_stable_hash,
                is_stable=True,
                reason="stable_within_threshold"
            )

        # Case 2: Potential ad change detected (Frame differs from baseline)
        self.consecutive_change_count += 1
        self.candidate_frame_buffer.append(frame.copy())
        self.candidate_hash_buffer.append(current_hash)

        # Keep buffer bounded
        if len(self.candidate_frame_buffer) > self.confirmation_frames + 2:
            self.candidate_frame_buffer.pop(0)
            self.candidate_hash_buffer.pop(0)

        # Check if consecutive confirmation count is met
        if self.consecutive_change_count >= self.confirmation_frames:
            # Check internal stability of the candidate frames in the buffer
            # (Ensures the new ad has finished transitioning and is now stable)
            recent_frames = self.candidate_frame_buffer[-self.confirmation_frames:]
            recent_hashes = self.candidate_hash_buffer[-self.confirmation_frames:]
            
            internal_diffs = []
            for i in range(len(recent_frames) - 1):
                d = self.compute_visual_difference(
                    recent_frames[i],
                    recent_frames[i + 1],
                    recent_hashes[i],
                    recent_hashes[i + 1]
                )
                internal_diffs.append(d)
                
            avg_internal_diff = float(np.mean(internal_diffs)) if internal_diffs else 0.0

            # If candidates are stable among themselves (e.g. diff < 0.15), confirm change!
            if avg_internal_diff < self.change_threshold * 0.65:
                # Update baseline to the new stable frame
                stable_candidate = recent_frames[-1]
                stable_hash = recent_hashes[-1]
                
                self.last_stable_frame = stable_candidate.copy()
                self.last_stable_hash = stable_hash
                self.last_stable_hist = self.compute_color_histogram(stable_candidate)
                self.consecutive_change_count = 0
                self.candidate_frame_buffer.clear()
                self.candidate_hash_buffer.clear()

                logger.info(
                    f"Visual change confirmed! Baseline score: {diff_score:.3f}, Internal stability: {avg_internal_diff:.3f}"
                )
                return ChangeDetectionResult(
                    is_changed=True,
                    score=diff_score,
                    confidence=round(diff_score, 4),
                    visual_hash=stable_hash,
                    is_stable=True,
                    reason="change_confirmed_and_stable"
                )
            else:
                # Still transitioning (e.g. cross-fade, slide animation)
                return ChangeDetectionResult(
                    is_changed=False,
                    score=diff_score,
                    confidence=round(diff_score, 4),
                    visual_hash=current_hash,
                    is_stable=False,
                    reason="transition_in_progress"
                )

        # Not yet confirmed (need more consecutive frames)
        return ChangeDetectionResult(
            is_changed=False,
            score=diff_score,
            confidence=round(diff_score, 4),
            visual_hash=current_hash,
            is_stable=False,
            reason=f"possible_change_accumulating_{self.consecutive_change_count}_of_{self.confirmation_frames}"
        )

    def reset(self):
        """Resets the change detector state."""
        self.last_stable_frame = None
        self.last_stable_hash = None
        self.last_stable_hist = None
        self.consecutive_change_count = 0
        self.candidate_frame_buffer.clear()
        self.candidate_hash_buffer.clear()
