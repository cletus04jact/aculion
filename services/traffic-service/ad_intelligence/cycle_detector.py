"""
Playlist Cycle Detection Module for DOOH Billboard Monitoring.
Discovers arbitrary and repeating advertisement sequence cycles without
assuming fixed ad lengths or fixed loop durations.
"""

import difflib
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone

from .models import AdPlayEvent, AdCycleSummary
from .config import settings

logger = logging.getLogger("AdIntelligence.CycleDetector")


class PlaylistCycleDetector:
    """
    Real-time sequence pattern discovery engine.
    Analyzes historical ad play streams to identify repeating playlist loops.
    """

    def __init__(
        self,
        min_cycle_ads: int = settings.MIN_CYCLE_ADS,
        cycle_match_threshold: float = settings.CYCLE_MATCH_THRESHOLD,
        max_lookback: int = settings.MAX_CYCLE_LOOKBACK
    ):
        self.min_cycle_ads = min_cycle_ads
        self.cycle_match_threshold = cycle_match_threshold
        self.max_lookback = max_lookback
        self.history: List[AdPlayEvent] = []
        self.detected_cycles: List[AdCycleSummary] = []
        self.last_cycle_end_index: int = -1

    def add_event(self, event: AdPlayEvent) -> Optional[AdCycleSummary]:
        """
        Ingests a completed AdPlayEvent and tests for completed playlist cycle.
        """
        if not event.creative_id:
            return None

        self.history.append(event)
        if len(self.history) > self.max_lookback:
            self.history.pop(0)
            if self.last_cycle_end_index > 0:
                self.last_cycle_end_index -= 1

        return self.evaluate_cycles()

    def evaluate_cycles(self) -> Optional[AdCycleSummary]:
        """
        Scans recent play history to find repeating sub-sequences.
        """
        n = len(self.history)
        if n < self.min_cycle_ads * 2:
            return None

        creative_ids = [e.creative_id for e in self.history]

        # Search for repeating sequence of length k (from min_cycle_ads up to n // 2)
        max_k = min(n // 2, 30)
        
        for k in range(self.min_cycle_ads, max_k + 1):
            target_seq = creative_ids[n - k : n]
            prev_seq = creative_ids[n - (2 * k) : n - k]

            # Compare sequences using difflib for fuzzy tolerance (skipped/inserted ads)
            matcher = difflib.SequenceMatcher(None, target_seq, prev_seq)
            similarity = matcher.ratio()

            if similarity >= self.cycle_match_threshold:
                # Potential cycle detected!
                cycle_events = self.history[n - k : n]
                
                start_time = cycle_events[0].started_at
                end_time = cycle_events[-1].ended_at or cycle_events[-1].started_at
                
                total_duration = sum(
                    (e.duration_seconds or 0.0) for e in cycle_events
                )
                if total_duration <= 0.0 and end_time > start_time:
                    total_duration = (end_time - start_time).total_seconds()

                # Ensure we haven't already reported this exact cycle index
                if n == self.last_cycle_end_index:
                    continue

                self.last_cycle_end_index = n

                summary = AdCycleSummary(
                    billboard_id=cycle_events[0].billboard_id,
                    cycle_start_at=start_time,
                    cycle_end_at=end_time,
                    cycle_duration_seconds=round(total_duration, 2),
                    total_ads=k,
                    creative_sequence=target_seq
                )
                self.detected_cycles.append(summary)

                logger.info(
                    f"CYCLE_COMPLETED: Detected playlist cycle of {k} ads! "
                    f"Duration: {total_duration:.1f}s, Sequence: {target_seq}"
                )
                return summary

        return None

    def get_detected_cycles(self) -> List[AdCycleSummary]:
        return list(self.detected_cycles)

    def reset(self):
        self.history.clear()
        self.detected_cycles.clear()
        self.last_cycle_end_index = -1
