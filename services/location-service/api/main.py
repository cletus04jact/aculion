"""
Location Intelligence FastAPI Backend
Endpoint: GET /api/v1/analyze
Full spatial feature engineering + AI recommendation engine.

v3.2 — POI category density legend reworked to a FIXED set of 17 main
  business verticals, each with its OWN calibration constant.
  - Added MAIN_CATEGORY_MAP: every granular POI sub-category returned by the
    SQL layer (e.g. "Mall", "Department Store", "Supermarket", "Restaurant",
    "Cafe", ...) is now folded into exactly one of 17 canonical legend
    buckets: real_estate, fitness, food_dining, shopping, home_furnishing,
    fashion, office, electronics, retail, commercial, automotive,
    healthcare, banking_finance, residential, education, entertainment,
    travel_tourism.
  - Added EXPECTED_MAX_DENSITY_MAIN + _K_MAIN: a SEPARATE, independently
    calibrated half-saturation constant (k) per legend category, instead of
    reusing the old fine-grained per-sub-category EXPECTED_MAX_DENSITY table.
    Each category's k is chosen from a realistic "typical max density"
    for THAT vertical specifically (e.g. residential POIs cluster far
    denser per km² than, say, real estate offices), so "score = 63" always
    means "at that category's own half-saturation density", never a
    borrowed threshold from an unrelated vertical.
  - build_poi_distribution() rewritten: it now aggregates raw poi_counts
    into these 17 buckets FIRST (summing every sub-category that maps to a
    given bucket), computes ONE area-normalized density per bucket, then
    runs that density through _saturate() with the bucket's own k. The
    legend/chart therefore always has exactly 17 rows (in the same order,
    every time), each independently scaled by its own formula.
  - Categories with no mapping (Government, uncategorized "Others") are
    excluded from the legend entirely, per requirements — they are not one
    of the 17 requested legends.
  - All other KPI math (compute_features, compute_kpis,
    compute_road_analytics, the LLM recommendation hookup, endpoints) is
    UNCHANGED from v3.1; this release only touches the POI category density
    component.

v3.1 — KPI layer mathematically reformulated.
  - Every KPI in compute_kpis() and every sub-score in compute_road_analytics()
    is now a CONVEX COMBINATION (non-negative weights summing to exactly 1.0)
    of sub-scores that are bounded in [0,100] BY CONSTRUCTION — either via the
    canonical _saturate() transform on a raw density/count, or because the
    quantity is already a genuine percentage of a physical total (e.g. land
    use area). This guarantees analytically, not defensively, that every KPI
    stays in [0,100].
  - Removed every remaining ad hoc `min(raw_value * constant, 100)` clip that
    used to live INSIDE compute_kpis / compute_road_analytics. Those clips
    each re-derived their own inconsistent scaling of the SAME raw metric
    (poi_density, road_density, junction_density, competition_index) with a
    hard "cliff" at the cap. Now every KPI references the ONE canonical score
    for that metric (poi_density_score, road_density_score,
    junction_density_score, competition_index, transit_accessibility, ...),
    computed exactly once in compute_features() and threaded through.
  - Fixed an oversight: poi_density_score / road_density_score /
    junction_density_score were being computed inside compute_features() (to
    build walkability) but never included in its returned dict, so
    compute_kpis() and compute_road_analytics() could not actually reach them
    and were silently falling back to re-deriving raw-value clips instead.
    They are now part of the returned features payload.
  - ai_confidence reformulated: the old formula gave a dead 10-point bonus
    for `metro_count > 0`, but metro_count is permanently fixed at 0
    elsewhere in this module (metro stations intentionally excluded), so
    that term could never fire. Replaced with a smooth, three-signal convex
    combination (POI count coverage, road-data presence, transit signal),
    each passed through _saturate() instead of a binary flag or hard cap.
  - compute_road_analytics() reworked the same way: connectivity, traffic
    density, road quality, and public transport are now convex combinations
    of the canonical bounded scores (road_density_score,
    junction_density_score, transit_accessibility, walkability) plus two
    genuinely distinct ABSOLUTE-scale signals (total road length in km, and
    absolute bus+rail count) that are deliberately kept separate from their
    area-normalized counterparts, each smoothed via _saturate().

v3.0 — Location-agnostic release.
  - Removed all hardcoded Chennai-only bounding-box restrictions. The API now
    analyzes ANY latitude/longitude the user selects on the map.
  - Progressive radius expansion (1x -> 5x) and an area-name centroid fallback
    ensure sparsely-mapped locations (e.g. peri-urban suburbs at the edge of
    table coverage) still return meaningful features instead of all zeros.
  - The AI reasoning layer (see llm_recommendation.py) reasons over a much
    broader set of business verticals derived from the full detected POI mix,
    instead of defaulting to Retail/FMCG/Dining.
  - commercial_density / competition_index reformulated as absolute,
    area-normalized, saturating-curve scores instead of "share of total local
    POI mix" ratios, which used to collapse toward zero for any location not
    dominated by a handful of specific categories (see _saturate() below).

v2.1 — Rebalanced weighting model (banking, offices, shopping, transit now
  drive the majority of commercial/footfall scoring; hotels split out of the
  transit bucket into their own category).
"""

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text
from database.connection import engine
import math
import logging
import os
try:
    from dotenv import load_dotenv
    load_dotenv()
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
except Exception:
    pass

try:
    from api.llm_recommendation import get_llm_recommendations
except ModuleNotFoundError:
    from llm_recommendation import get_llm_recommendations

logger = logging.getLogger(__name__)

app = FastAPI(title="Location Intelligence API", version="3.2")

default_origins = [
    "http://localhost:5173",
    "http://localhost:5176",
    "https://www.aculion.com",
    "https://aculion.com"
]
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
frontend_url_env = os.getenv("FRONTEND_URL", "")

allowed_origins_set = set(default_origins)
if allowed_origins_env:
    for orig in allowed_origins_env.split(","):
        if orig.strip():
            allowed_origins_set.add(orig.strip())
if frontend_url_env:
    for orig in frontend_url_env.split(","):
        if orig.strip():
            allowed_origins_set.add(orig.strip())

allowed_origins = sorted(list(allowed_origins_set))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _calculate_real_estate_score(poi_counts: dict, features: dict) -> int:
    """
    Calculate Real Estate Potential Score (0–100) combining Commercial,
    Residential, Road infrastructure, Transit infrastructure, and Real-estate activity.
    Normalized by Chennai-scale thresholds and weighted.
    """
    # 1. Commercial potential (C) - 30%
    raw_C = (
        poi_counts.get("office", 0) +
        poi_counts.get("commercial", 0) +
        poi_counts.get("shopping", 0) +
        poi_counts.get("banking_finance", 0)
    )
    C_norm = min(100.0, (raw_C / 250.0) * 100.0) if raw_C > 0 else 0.0

    # 2. Residential potential (R) - 25%
    raw_R = (
        poi_counts.get("residential", 0) +
        poi_counts.get("education", 0) +
        poi_counts.get("healthcare", 0)
    )
    R_norm = min(100.0, (raw_R / 200.0) * 100.0) if raw_R > 0 else 0.0

    # 3. Road infrastructure (D) - 20%
    # Combine road density (km/km²) and junction density (junctions/km²)
    road_density = features.get("road_density", 0.0)
    junction_density = features.get("junction_density", 0.0)
    road_density_norm = min(100.0, (road_density / 15.0) * 100.0) if road_density > 0 else 0.0
    junction_density_norm = min(100.0, (junction_density / 10.0) * 100.0) if junction_density > 0 else 0.0
    D_norm = 0.5 * road_density_norm + 0.5 * junction_density_norm

    # 4. Transit infrastructure (T) - 15%
    bus_count = features.get("bus_count", 0)
    rail_count = features.get("rail_count", 0)
    area_km2 = features.get("area_km2", 3.14)
    transit_density = (bus_count + rail_count) / area_km2 if area_km2 > 0 else 0.0
    T_norm = min(100.0, (transit_density / 10.0) * 100.0) if transit_density > 0 else 0.0

    # 5. Real-estate market activity (M) - 10%
    raw_M = poi_counts.get("real_estate", 0)
    real_estate_density = raw_M / area_km2 if area_km2 > 0 else 0.0
    M_norm = min(100.0, (real_estate_density / 3.0) * 100.0) if real_estate_density > 0 else 0.0

    # Weighted Formula
    score = 0.30 * C_norm + 0.25 * R_norm + 0.20 * D_norm + 0.15 * T_norm + 0.10 * M_norm
    return int(round(score))


def _deg_radii(lat: float, radius_m: float):
    """Convert radius in metres to approximate degree offsets."""
    lat_rad = math.radians(lat)
    cos_lat = math.cos(lat_rad)
    r_lat = radius_m / 111_000.0
    r_lng = radius_m / (111_000.0 * cos_lat) if cos_lat > 0 else r_lat
    return r_lat, r_lng


def _circle_area_km2(radius_m: float) -> float:
    return math.pi * (radius_m / 1000.0) ** 2


def _clamp(v, lo=0, hi=100):
    return max(lo, min(hi, v))


def _safe_pct(part, total):
    return round((part / total) * 100, 1) if total > 0 else 0.0


def _saturate(x: float, k: float) -> float:
    """
    Canonical density -> 0-100 score transform used EVERYWHERE a raw count,
    density, or ratio needs to become a bounded sub-score.

        score(x) = 100 * (1 - e^(-x / k))

    Replaces two brittle patterns that used to live throughout this module:
      1. "share of total POI mix" ratios (count / total_pois * 100), which
         collapse toward zero for any location whose POI mix isn't dominated
         by the specific categories being measured — even if that location
         has a healthy absolute number of those POIs.
      2. hard linear caps (min(x * const, 100)), which create a "cliff":
         a location just below the cap threshold and one just above it can
         score wildly differently for a negligible real difference, and every
         location beyond the threshold is indistinguishable at a flat 100.

    Properties, all satisfied by construction:
      - score(0)  = 0           -> genuinely no data reads as 0, honestly.
      - strictly increasing     -> more presence is never penalized.
      - score(k)  ~ 63.2        -> reaching the half-saturation density k
                                    already earns a solid majority score.
      - score(3k) ~ 95.0        -> diminishing returns past that, no
                                    discontinuous plateau at a hard cap.
      - continuous & C-infinity -> no cliffs; nearby inputs give nearby
                                    scores.

    k is the half-saturation constant: the density/count at which a location
    earns ~63/100. Different metrics/categories use DIFFERENT k values,
    calibrated to that metric's own typical/expected max, so "63" always
    means "reached this category's own realistic reference density" and
    never borrows a threshold from an unrelated metric or category.
    """
    if x <= 0 or k <= 0:
        return 0.0
    return 100.0 * (1.0 - math.exp(-x / k))


def _expand(x: float, gamma: float = 0.65) -> float:
    """
    Monotonic power-curve rescale, used ONLY on compounded KPIs (currently
    overall_score) where a plain weighted average of several _saturate()
    sub-scores stacks two layers of compression on top of each other.

    PROBLEM THIS SOLVES:
    overall_score is a convex combination of sub-scores (commercial_density,
    transit_accessibility, poi_density_score, competition_index, ...) that
    are THEMSELVES already saturating curves over raw densities. Real-world
    raw densities are usually well below each sub-score's calibrated k, so
    each sub-score often lands in the 20-50 range on its own. A weighted
    AVERAGE of several such 20-50 values can never exceed the average of its
    inputs — so overall_score inherits the same compressed range and
    clusters under 40 even for genuinely decent locations. This is not a
    bug in any one formula; it's the mathematical consequence of averaging
    multiple already-compressed curves.

        expand(x) = 100 * (x / 100) ** gamma,   0 < gamma < 1

    Properties (same discipline as _saturate() — no ad hoc clip):
      - expand(0)   = 0     -> genuinely no signal still reads 0.
      - expand(100) = 100   -> a maximal input still reads 100.
      - strictly increasing & continuous -> preserves ranking; no cliffs.
      - bounded in [0,100] BY CONSTRUCTION.
      - gamma < 1 lifts every value ABOVE the identity line except at the
        two fixed endpoints, with the LARGEST lift in the low-to-mid range
        (raw ~20-50, where most real locations currently cluster) and
        almost no lift near the top (where genuinely exceptional locations
        already sit) — it stretches out the compressed middle instead of
        inflating already-high scores.

    gamma=0.65 reference points: raw 30 -> ~45.7, raw 40 -> ~55.1,
    raw 50 -> ~63.7, raw 60 -> ~71.7, raw 80 -> ~86.5.
    """
    if x <= 0:
        return 0.0
    x = _clamp(x)
    return 100.0 * (x / 100.0) ** gamma


# ---------------------------------------------------------------------------
# Score -> text label mapping (for text-based KPI cards)
#
# Every KPI in this module is built from the SAME _saturate() curve, so it
# has exactly two non-arbitrary landmarks, independent of which metric or
# category we're looking at:
#
#   score(k)  = 100*(1 - e^-1) ≈ 63.2   <- "half-saturation": the metric has
#                                           caught up to its typical reference
#                                           density (63.2 falls out of e^-1,
#                                           it is not a chosen round number)
#   score(3k) = 100*(1 - e^-3) ≈ 95.0   <- "near-saturated": diminishing
#                                           returns from here on (falls out
#                                           of e^-3)
#
# Text labels are anchored on these two universal landmarks (63.2 and 95.0)
# plus two evenly-spaced intermediate bands below them, so "Solid" means the
# same underlying thing (crossed half-saturation) on every KPI card, not a
# per-card guess.
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# 4-tier label system (revised):
#   > 80  Exceptional
#   > 60  Strong
#   > 40  Developing
#   > 20  Emerging
#   <= 20 No Data (score too low for a qualitative label)
# ---------------------------------------------------------------------------
_LABEL_BANDS = [
    (80.0, "Exceptional"),
    (60.0, "Strong"),
    (40.0, "Developing"),
    (20.0, "Emerging"),
]

# Adaptive label text: per-KPI descriptions for each tier
_KPI_ADAPTIVE_LABELS: dict[str, dict[str, str]] = {
    "overall_score": {
        "Exceptional": "Exceptional Location",
        "Strong": "Strong Location",
        "Developing": "Developing Location",
        "Emerging": "Emerging Location",
    },
    "accessibility": {
        "Exceptional": "Excellent Accessibility",
        "Strong": "Well Connected",
        "Developing": "Moderately Accessible",
        "Emerging": "Limited Accessibility",
    },
    "commercial_potential": {
        "Exceptional": "Major Commercial Hub",
        "Strong": "Strong Commercial Presence",
        "Developing": "Developing Commercial Zone",
        "Emerging": "Emerging Commercial Area",
    },
    "transit_connectivity": {
        "Exceptional": "Outstanding Transit Access",
        "Strong": "Well Connected Transit",
        "Developing": "Moderate Transit Access",
        "Emerging": "Basic Transit Coverage",
    },
    "footfall_potential": {
        "Exceptional": "Exceptional Footfall",
        "Strong": "High Footfall",
        "Developing": "Moderate Footfall",
        "Emerging": "Growing Footfall",
    },
    "building_density": {
        "Exceptional": "Highly Urbanized",
        "Strong": "Dense Development",
        "Developing": "Moderate Development",
        "Emerging": "Sparse Development",
    },
    "residential_density": {
        "Exceptional": "Highly Residential",
        "Strong": "Dense Residential Area",
        "Developing": "Moderate Residential Presence",
        "Emerging": "Low Residential Presence",
    },
    "green_coverage": {
        "Exceptional": "Excellent Green Coverage",
        "Strong": "Good Green Coverage",
        "Developing": "Moderate Green Coverage",
        "Emerging": "Limited Green Coverage",
    },
}

# Threshold displayed on the card (what tier boundary the score crossed)
_TIER_THRESHOLDS = {
    "Exceptional": 80,
    "Strong": 60,
    "Developing": 40,
    "Emerging": 20,
}


def _score_to_tier(score: float) -> str | None:
    """
    Returns the tier name for a score:
      > 80  -> Exceptional
      > 60  -> Strong
      > 40  -> Developing
      > 0   -> Emerging  (any non-zero score shows a card)
      == 0 or None -> None (hidden on frontend)
    """
    if score is None or score <= 0:
        return None
    for threshold, label in _LABEL_BANDS:
        if score > threshold:
            return label
    # score is > 0 but <= 20 — still show as Emerging
    return "Emerging"


def _score_to_label(score: float) -> str:
    """Legacy single-string label (used by _confidence_note and ai_confidence card)."""
    tier = _score_to_tier(score)
    return tier if tier else "No Data"


def _confidence_note(ai_confidence: float) -> str | None:
    """
    ai_confidence is a DATA-QUALITY meta-score (how much reliable spatial
    data underlies this analysis), not a location-quality score. When it's
    low, every other KPI's text label should carry a caveat so a sparse-data
    location doesn't get reported with false certainty (e.g. "Solid" sounds
    authoritative even if it's Solid-on-thin-data).
    """
    if ai_confidence is None:
        return None
    if ai_confidence < 40:
        return "Limited underlying data — interpret with caution"
    if ai_confidence < 65:
        return "Moderate data coverage"
    return None


def label_kpis(kpis: dict) -> dict:
    """
    Builds the kpi_labels payload. Each KPI entry now contains:
      - value       : raw 0-100 numeric score
      - tier        : tier name (Exceptional/Strong/Developing/Emerging) or None
      - label       : adaptive qualitative description for that specific KPI
      - threshold   : the tier boundary the score crossed (90/60/40/20)
    Cards with tier==None (score <= 20) are hidden on the frontend.
    """
    ai_conf = kpis.get("ai_confidence")
    note = _confidence_note(ai_conf)

    labeled = {}
    for key, value in kpis.items():
        if key == "ai_confidence":
            continue
        tier = _score_to_tier(value) if value is not None else None
        # Adaptive label: KPI-specific text, or fallback to tier name
        adaptive_map = _KPI_ADAPTIVE_LABELS.get(key, {})
        adaptive_label = adaptive_map.get(tier, tier) if tier else None
        labeled[key] = {
            "value": value,
            "tier": tier,
            "label": adaptive_label,
            "threshold": _TIER_THRESHOLDS.get(tier) if tier else None,
        }

    # ai_confidence gets its own simple entry
    ai_tier = _score_to_tier(ai_conf) if ai_conf is not None else None
    labeled["ai_confidence"] = {
        "value": ai_conf,
        "tier": ai_tier,
        "label": ai_tier,
        "threshold": _TIER_THRESHOLDS.get(ai_tier) if ai_tier else None,
    }

    return {
        "kpi_labels": labeled,
        "data_confidence_note": note,
    }


# Aggregate mapping to keep density score calculation alive for all new categories
_NEW_CATEGORIES_LIST = [
    "Shopping", "Mall", "Department Store", "Supermarket", "Retail", "Fashion", "Clothes", "Shoes",
    "Entertainment", "Theatre", "Cinema", "Stadium", "Attraction", "Tourism",
    "Fitness", "Fitness Centre", "Sports Centre", "Jewellery",
    "Education", "School", "College", "University", "Kindergarten", "Language School",
    "Residential", "Apartment",
    "Food & Nightlife", "Restaurant", "Cafe", "Fast Food", "Pub", "Bar", "Ice Cream", "Food Court",
    "Commercial", "Commercial Zone", "IT Park / Office",
    "Automotive", "Car Repair", "Motorcycle", "Tyres", "Car",
    "Banking & Finance", "Bank", "ATM", "Banking",
    "Healthcare", "Hospital", "Clinic", "Doctors", "Dentist", "Pharmacy", "Veterinary",
    "Technology", "Computer", "Electronics", "Mobile Phone",
    "Hospitality", "Hotel", "Motel", "Hostel", "Guest House",
    "Real Estate", "Home Furnishing", "Furniture", "Government", "Government Office",
    "Others"
]
EXPECTED_MAX_DENSITY = {c: 10 for c in _NEW_CATEGORIES_LIST}
EXPECTED_MAX_DENSITY.update({
    "Restaurants": 15, "Shopping": 8, "Schools": 5,
    "Hospitals": 3, "Banks": 8, "Parks": 5,
    "BusStops": 20, "Clinics": 8,
    "Libraries": 3, "Hotels": 5, "Entertainment": 6,
    "Offices": 10, "Government": 4
})

# ---------------------------------------------------------------------------
# Half-saturation constants (k) for _saturate(), one per raw metric.
# Each is (old_cap_or_expected_max) / 3, so a location AT the old cap/typical
# max now scores ~95/100 instead of a flat 100, and one at HALF that value
# scores ~63/100 instead of a near-zero mix-share artifact.
# ---------------------------------------------------------------------------
_K_RESTAURANT = EXPECTED_MAX_DENSITY["Restaurants"] / 3       # 5.00  /km²
_K_HOTEL = EXPECTED_MAX_DENSITY["Hotels"] / 3                 # 1.67  /km²
_K_ENTERTAINMENT = EXPECTED_MAX_DENSITY["Entertainment"] / 3  # 2.00  /km²
_K_SHOPPING = EXPECTED_MAX_DENSITY["Shopping"] / 3            # 2.67  /km²
_K_BANK = EXPECTED_MAX_DENSITY["Banks"] / 3                   # 2.67  /km²
_K_OFFICE = EXPECTED_MAX_DENSITY["Offices"] / 3               # 3.33  /km²
_K_BUS = EXPECTED_MAX_DENSITY["BusStops"] / 3                 # 6.67  /km²
_K_COMPETITION = 20.0 / 3                                     # old cap: raw=20
_K_TRANSIT = 10.0 / 3                                         # old cap: raw=10
_K_POI_DENSITY = 20.0 / 3                                     # old cap: poi_density=20
_K_ROAD_DENSITY = 0.20 / 3                                    # old cap: road_density=0.2
_K_JUNCTION_DENSITY = 10.0 / 3                                # old cap: junction_density=10
_K_CONFIDENCE_POIS = 40.0 / 3                                 # old cap: total_pois=40
_K_CONFIDENCE_ROAD_M = 1000.0 / 3                             # old: binary flag at >0m; now graded, anchored at 1 km
_K_CONFIDENCE_TRANSIT = 10.0 / 3                               # old cap: bus_count=10
_K_ROAD_LENGTH_KM = 50.0 / 3                                  # old cap: road_length_m/1000 = 50 (km)
_K_TRANSIT_ABS_COUNT = 11.67 / 3                               # old cap: (bus+metro) = 11.67


# ---------------------------------------------------------------------------
# POI category density legend — FIXED set of 17 main business verticals.
#
# Every fine-grained sub-category returned by the SQL layer (_POI_CAT_SQL's
# cat_group, e.g. "Mall", "Department Store", "Cafe", "Bank", "ATM", ...) is
# folded into exactly ONE of these 17 canonical buckets before density is
# computed. Anything not listed here (Government, unclassified "Others") is
# intentionally excluded from the legend — it is not one of the requested
# 17 categories.
#
# Each bucket gets its OWN half-saturation constant (k), calibrated from a
# realistic "typical max density" (POIs per km²) for THAT specific vertical,
# not a borrowed threshold from some other category. This means "reached
# 63/100" always means "hit this vertical's own reference density".
# ---------------------------------------------------------------------------
POI_LEGEND_CATEGORIES = [
    "real_estate",
    "fitness",
    "food_dining",
    "shopping",
    "home_furnishing",
    "fashion",
    "office",
    "electronics",
    "retail",
    "commercial",
    "automotive",
    "healthcare",
    "banking_finance",
    "residential",
    "education",
    "entertainment",
    "travel_tourism",
]

# Fine-grained cat_group (as produced by _POI_CAT_SQL / poi_counts keys)
# -> one of the 17 legend buckets above.
MAIN_CATEGORY_MAP = {
    # real_estate
    "Real Estate": "real_estate",

    # fitness
    "Fitness": "fitness",
    "Fitness Centre": "fitness",
    "Sports Centre": "fitness",

    # food_dining
    "Food & Nightlife": "food_dining",
    "Restaurant": "food_dining",
    "Restaurants": "food_dining",
    "Cafe": "food_dining",
    "Fast Food": "food_dining",
    "Pub": "food_dining",
    "Bar": "food_dining",
    "Ice Cream": "food_dining",
    "Food Court": "food_dining",

    # shopping
    "Shopping": "shopping",
    "Mall": "shopping",
    "Department Store": "shopping",
    "Supermarket": "shopping",
    "Jewellery": "shopping",

    # home_furnishing
    "Home Furnishing": "home_furnishing",
    "Furniture": "home_furnishing",

    # fashion
    "Fashion": "fashion",
    "Clothes": "fashion",
    "Shoes": "fashion",

    # office
    "IT Park / Office": "office",
    "Offices": "office",

    # electronics
    "Technology": "electronics",
    "Computer": "electronics",
    "Electronics": "electronics",
    "Mobile Phone": "electronics",

    # retail
    "Retail": "retail",

    # commercial
    "Commercial": "commercial",
    "Commercial Zone": "commercial",

    # automotive
    "Automotive": "automotive",
    "Car Repair": "automotive",
    "Motorcycle": "automotive",
    "Tyres": "automotive",
    "Car": "automotive",

    # healthcare
    "Healthcare": "healthcare",
    "Hospital": "healthcare",
    "Hospitals": "healthcare",
    "Clinic": "healthcare",
    "Clinics": "healthcare",
    "Doctors": "healthcare",
    "Dentist": "healthcare",
    "Pharmacy": "healthcare",
    "Veterinary": "healthcare",

    # banking_finance
    "Banking & Finance": "banking_finance",
    "Bank": "banking_finance",
    "Banks": "banking_finance",
    "ATM": "banking_finance",
    "Banking": "banking_finance",

    # residential
    "Residential": "residential",
    "Apartment": "residential",

    # education
    "Education": "education",
    "School": "education",
    "Schools": "education",
    "College": "education",
    "University": "education",
    "Kindergarten": "education",
    "Language School": "education",

    # entertainment
    "Entertainment": "entertainment",
    "Theatre": "entertainment",
    "Cinema": "entertainment",
    "Stadium": "entertainment",

    # travel_tourism
    "Hospitality": "travel_tourism",
    "Hotel": "travel_tourism",
    "Hotels": "travel_tourism",
    "Motel": "travel_tourism",
    "Hostel": "travel_tourism",
    "Guest House": "travel_tourism",
    "Attraction": "travel_tourism",
    "Tourism": "travel_tourism",

    # Explicitly NOT mapped (excluded from the 17-category legend):
    #   "Government", "Government Office", "BusStops", "Others", "Parks",
    #   "Libraries"
}

# Display label shown to the user for each legend key.
POI_LEGEND_LABELS = {
    "real_estate": "Real Estate",
    "fitness": "Fitness",
    "food_dining": "Food & Dining",
    "shopping": "Shopping",
    "home_furnishing": "Home Furnishing",
    "fashion": "Fashion",
    "office": "Office",
    "electronics": "Electronics",
    "retail": "Retail",
    "commercial": "Commercial",
    "automotive": "Automotive",
    "healthcare": "Healthcare",
    "banking_finance": "Banking & Finance",
    "residential": "Residential",
    "education": "Education",
    "entertainment": "Entertainment",
    "travel_tourism": "Travel & Tourism",
}

# Independently calibrated "typical max density" (POIs per km²) per legend
# category — NOT reused from EXPECTED_MAX_DENSITY above, which was tuned for
# the old fine-grained sub-categories. Each of these 17 numbers reflects a
# realistic reference density for that specific vertical on its own:
#   - residential / food_dining are the densest verticals in most urban POI
#     data (many small eateries, many houses/apartments per km²).
#   - office / commercial / banking_finance / shopping are mid-density
#     commercial verticals.
#   - real_estate / home_furnishing / travel_tourism / fitness / automotive
#     are lower-density, more specialized verticals — a handful nearby is
#     already meaningful.
EXPECTED_MAX_DENSITY_MAIN = {
    "real_estate": 4,
    "fitness": 4,
    "food_dining": 18,
    "shopping": 8,
    "home_furnishing": 4,
    "fashion": 6,
    "office": 10,
    "electronics": 6,
    "retail": 8,
    "commercial": 8,
    "automotive": 6,
    "healthcare": 6,
    "banking_finance": 8,
    "residential": 14,
    "education": 5,
    "entertainment": 6,
    "travel_tourism": 5,
}

# One half-saturation constant (k) per legend category, each = its own
# expected_max / 3 (same universal calibration rule used everywhere else in
# this module: score(k) ~= 63.2, score(3k) ~= 95.0 — see _saturate()).
K_MAIN = {cat: EXPECTED_MAX_DENSITY_MAIN[cat] / 3.0 for cat in POI_LEGEND_CATEGORIES}


# ---------------------------------------------------------------------------
# Feature Engineering
# ---------------------------------------------------------------------------

def compute_features(poi_counts: dict, transit_counts: dict, landuse_areas: dict,
                     road_len_m: float, junction_count: int,
                     radius_m: float) -> dict:
    area_km2 = _circle_area_km2(radius_m)
    area_m2 = math.pi * radius_m ** 2

    total_pois = sum(poi_counts.values())
    total_lu = sum(landuse_areas.values())

    poi_density = round(total_pois / area_km2, 2) if total_pois > 0 else 0.0

    road_density = round(road_len_m / area_m2 * 1000, 4) if road_len_m > 0 else 0.0
    junction_density = round(junction_count / area_km2, 2) if junction_count > 0 else 0.0

    # --- Road proxy for locations at the edge of roads_master coverage ---
    # When roads_master has no rows within the search radius (road_len_m == 0)
    # but POIs ARE present, we know roads must exist (POIs imply accessibility
    # by definition — nothing gets built with zero road access). Synthesize a
    # conservative road_density / junction_density from POI density so that
    # walkability and the KPI layer aren't falsely zeroed for a location that
    # simply falls in a gap in the roads table.
    if road_len_m == 0 and total_pois > 0:
        proxy_road_len_m = total_pois * 500.0   # ~1 POI implies ~0.5 km of local road, peri-urban assumption
        road_density = round(proxy_road_len_m / area_m2 * 1000, 4)
        junction_density = round(total_pois / area_km2 * 0.3, 2)   # ~30% of POIs sit near a junction

    bus_count = transit_counts.get("bus", 0)
    metro_count = 0  # Completely remove metro stations
    rail_count = transit_counts.get("rail", 0)
    transit_raw = (bus_count * 1.0 + rail_count * 2.0) / area_km2
    transit_accessibility = round(_saturate(transit_raw, _K_TRANSIT), 1)

    restaurant_count = poi_counts.get("food_dining", 0)
    hotel_count = poi_counts.get("travel_tourism", 0)
    office_count = poi_counts.get("office", 0) + poi_counts.get("commercial", 0)
    bank_count = poi_counts.get("banking_finance", 0)
    shopping_count = poi_counts.get("shopping", 0)

    restaurant_density = round(restaurant_count / area_km2, 2) if restaurant_count > 0 else 0.0
    hospitality_density = round(hotel_count / area_km2, 2) if hotel_count > 0 else 0.0
    office_density = round(office_count / area_km2, 2) if office_count > 0 else 0.0
    bank_density = round(bank_count / area_km2, 2) if bank_count > 0 else 0.0
    shopping_density = round(shopping_count / area_km2, 2) if shopping_count > 0 else 0.0

    restaurant_density_norm = _clamp(round(restaurant_density / EXPECTED_MAX_DENSITY["Restaurants"] * 100)) if restaurant_count > 0 else 0
    hospitality_density_norm = _clamp(round(hospitality_density / EXPECTED_MAX_DENSITY["Hotels"] * 100)) if hotel_count > 0 else 0
    office_density_norm = _clamp(round(office_density / EXPECTED_MAX_DENSITY["Offices"] * 100)) if office_count > 0 else 0

    # --- commercial_density: a weighted average of PER-CATEGORY ABSOLUTE
    # saturating densities, NOT a share of the total local POI mix. Scores
    # each category on its own area-normalized density via _saturate (so "6
    # banks in a 3.14 km² circle" always means the same thing, anywhere),
    # then takes a weighted average of those already-bounded 0-100 sub-scores.
    # A location only scores low here if its absolute densities are genuinely
    # low — never because some unrelated category dominates the local mix.
    entertainment_count = poi_counts.get("entertainment", 0)
    bus_stops_count = poi_counts.get("BusStops", 0)
    entertainment_density = round(entertainment_count / area_km2, 2) if entertainment_count > 0 else 0.0
    bus_stop_density = round(bus_stops_count / area_km2, 2) if bus_stops_count > 0 else 0.0

    _COMM_WEIGHTS = {
        "restaurant": 0.10, "hotel": 0.10, "entertainment": 0.20,
        "shopping": 3.25, "bank": 3.2, "office": 4.2, "bus": 1.30,
    }
    _COMM_TOTAL_W = sum(_COMM_WEIGHTS.values())

    commercial_density = round((
        _COMM_WEIGHTS["restaurant"]    * _saturate(restaurant_density, _K_RESTAURANT) +
        _COMM_WEIGHTS["hotel"]         * _saturate(hospitality_density, _K_HOTEL) +
        _COMM_WEIGHTS["entertainment"] * _saturate(entertainment_density, _K_ENTERTAINMENT) +
        _COMM_WEIGHTS["shopping"]      * _saturate(shopping_density, _K_SHOPPING) +
        _COMM_WEIGHTS["bank"]          * _saturate(bank_density, _K_BANK) +
        _COMM_WEIGHTS["office"]        * _saturate(office_density, _K_OFFICE) +
        _COMM_WEIGHTS["bus"]           * _saturate(bus_stop_density, _K_BUS)
    ) / _COMM_TOTAL_W, 1)

    residential_area = landuse_areas.get("residential", 0)
    residential_density = round(residential_area / total_lu * 100, 1) if total_lu > 0 else 0.0

    green_area = landuse_areas.get("greenfield", 0) + landuse_areas.get("park", 0)
    green_cover_ratio = round(green_area / total_lu * 100, 1) if total_lu > 0 else 0.0

    # --- competition_index: same fix as commercial_density — an absolute,
    # area-normalized density run through the saturating curve, instead of a
    # raw count scaled and hard-capped at 100.
    competition_density = (
        poi_counts.get("shopping", 0) + bank_count + office_count * 0.5
    ) / area_km2
    competition_index = round(_saturate(competition_density, _K_COMPETITION), 1)

    # --- poi_density_score / road_density_score / junction_density_score:
    # canonical, ONE-TIME saturating normalization of these raw metrics, so
    # every KPI downstream reuses the SAME bounded 0-100 sub-score instead of
    # re-deriving its own ad hoc min(x*const, 100) clip on the same raw
    # number. These are now included in the returned dict (previously
    # computed here but never returned, so downstream KPIs couldn't reach
    # them and silently fell back to re-clipping raw values instead).
    poi_density_score = round(_saturate(poi_density, _K_POI_DENSITY), 1)
    road_density_score = round(_saturate(road_density, _K_ROAD_DENSITY), 1)
    junction_density_score = round(_saturate(junction_density, _K_JUNCTION_DENSITY), 1)

    # --- walkability: a convex combination (weights sum to 1.0) of three
    # already-bounded 0-100 sub-scores. Bounded in [0,100] and monotonic in
    # each input BY CONSTRUCTION — no clamp needed as a safety net.
    walkability = round(
        0.40 * road_density_score +
        0.30 * poi_density_score +
        0.30 * transit_accessibility
    , 1)

    lu_values = [v for v in landuse_areas.values() if v > 0]
    if len(lu_values) > 1 and total_lu > 0:
        probs = [v / total_lu for v in lu_values]
        entropy = -sum(p * math.log(p) for p in probs if p > 0)
        max_entropy = math.log(len(lu_values))
        land_use_mix = round((entropy / max_entropy) * 100, 1) if max_entropy > 0 else 0.0
    else:
        land_use_mix = 0.0

    population_proxy = round(residential_area * 0.0002, 0)

    building_area = landuse_areas.get("construction", 0) + landuse_areas.get("commercial", 0)
    building_density = _clamp(round(building_area / total_lu * 100, 1), 0, 100) if total_lu > 0 else 0.0

    # Full per-category counts/densities passed through unmodified so the LLM
    # layer (and any downstream consumer) can reason over the ENTIRE detected
    # POI mix, not just a handful of hardcoded verticals.
    category_counts = {k: v for k, v in poi_counts.items() if k not in ("other", "others")}
    category_densities = {
        k: (round(v / area_km2, 2) if v > 0 else 0.0)
        for k, v in category_counts.items()
    }

    return {
        "poi_density": poi_density,
        "poi_density_score": poi_density_score,
        "road_density": road_density,
        "road_density_score": road_density_score,
        "junction_density": junction_density,
        "junction_density_score": junction_density_score,
        "transit_accessibility": transit_accessibility,
        "commercial_density": commercial_density,
        "residential_density": residential_density,
        "green_cover_ratio": green_cover_ratio,
        "competition_index": competition_index,
        "walkability": walkability,
        "land_use_mix": land_use_mix,
        "population_proxy": population_proxy,
        "building_density": building_density,
        "total_pois": total_pois,
        "bus_count": bus_count,
        "metro_count": metro_count,
        "rail_count": rail_count,
        "road_length_m": round(road_len_m, 1),
        "area_km2": round(area_km2, 4),
        "restaurant_count": restaurant_count,
        "hotel_count": hotel_count,
        "office_count": office_count,
        "bank_count": bank_count,
        "shopping_count": shopping_count,
        "restaurant_density": restaurant_density,
        "hospitality_density": hospitality_density,
        "office_density": office_density,
        "bank_density": bank_density,
        "shopping_density": shopping_density,
        "restaurant_density_norm": restaurant_density_norm,
        "hospitality_density_norm": hospitality_density_norm,
        "office_density_norm": office_density_norm,
        "category_counts": category_counts,
        "category_densities": category_densities,
    }


# ---------------------------------------------------------------------------
# KPI Score Computation
# ---------------------------------------------------------------------------

def compute_kpis(features: dict, poi_counts: dict, road_len_m: float) -> dict:
    """
    Every KPI here is a CONVEX COMBINATION (non-negative weights summing to
    exactly 1.0) of sub-scores already bounded in [0,100] by construction —
    either _saturate()-derived, or a genuine percentage of a physical total.
    This guarantees each KPI stays in [0,100] analytically. The remaining
    _clamp() calls are a defensive safety net against floating-point drift,
    not load-bearing logic.
    """
    f = features

    # --- overall_score -----------------------------------------------------
    # Step 1: raw convex combination, same discipline as before (weights sum
    # to 1.0, every input already bounded [0,100]). Weight has been nudged
    # away from building_density / land_use_mix (both lean on synthesized
    # fallback land-use data — more noise than signal at most locations) and
    # toward the metrics carrying the most direct POI/transit evidence.
    # Weights: 0.30 + 0.24 + 0.14 + 0.12 + 0.08 + 0.06 + 0.04 + 0.02 = 1.00
    _overall_raw = (
        f["commercial_density"]    * 0.30 +
        f["transit_accessibility"] * 0.24 +
        f["poi_density_score"]     * 0.14 +
        f["walkability"]           * 0.12 +
        f["residential_density"]   * 0.08 +
        f["competition_index"]     * 0.06 +
        f["building_density"]      * 0.04 +
        f["land_use_mix"]          * 0.02
    )

    # Step 2: expand. overall_score is a convex combination of sub-scores
    # that are THEMSELVES saturating curves (commercial_density,
    # transit_accessibility, poi_density_score, competition_index) — two
    # compounded layers of compression, which structurally caps a plain
    # weighted average well below 100 even for strong locations. _expand()
    # corrects this with one more bounded, monotonic, endpoint-preserving
    # transform (same _saturate-style discipline — no ad hoc clip), so the
    # card actually uses the 0-100 range meaningfully instead of clustering
    # under 40. See _expand() docstring for the full reasoning.
    overall_score = round(_expand(_overall_raw, gamma=0.65), 1)

    # Weights: 0.45 + 0.35 + 0.20 = 1.00
    accessibility = round(
        f["transit_accessibility"] * 0.45 +
        f["walkability"]           * 0.35 +
        f["road_density_score"]    * 0.20
    , 1)

    # Weights: 0.50 + 0.20 + 0.10 + 0.10 + 0.10 = 1.00
    commercial_potential = round(
        f["commercial_density"]    * 0.50 +
        f["transit_accessibility"] * 0.20 +
        f["competition_index"]     * 0.10 +
        f["residential_density"]   * 0.10 +
        f["poi_density_score"]     * 0.10
    , 1)

    # residential_density is already a genuine percentage of land-use area
    # (bounded [0,100] by definition); clamp is a pure safety net.
    residential_density_score = _clamp(round(f["residential_density"], 1))

    # Weights: 0.60 + 0.25 + 0.15 = 1.00
    transit_connectivity = round(
        f["transit_accessibility"]  * 0.60 +
        f["junction_density_score"] * 0.25 +
        f["road_density_score"]     * 0.15
    , 1)

    green_coverage = _clamp(round(f["green_cover_ratio"], 1))
    building_density_score = _clamp(round(f["building_density"], 1))
    # Weights: 0.35 + 0.30 + 0.20 + 0.15 = 1.00
    footfall_potential = round(
        f["commercial_density"]    * 0.35 +
        f["transit_accessibility"] * 0.30 +
        f["walkability"]           * 0.20 +
        f["poi_density_score"]     * 0.15
    , 1)

    # --- ai_confidence: a DATA-QUALITY / certainty meta-score (how much
    # reliable underlying data this analysis rests on), NOT a location
    # quality score — kept structurally separate from the other KPIs above.
    #
    # Reformulated as a convex combination of three smooth saturating
    # signals. The old formula gave a fixed +10 bonus for metro_count > 0,
    # but metro_count is permanently hardcoded to 0 elsewhere in this module
    # (metro stations intentionally excluded from scoring) — so that term
    # was dead weight that could never fire. It's replaced here by folding
    # transit signal (bus + rail) into one smooth term.
    # Weights: 0.55 + 0.25 + 0.20 = 1.00
    ai_confidence = round(
        0.55 * _saturate(f["total_pois"], _K_CONFIDENCE_POIS) +
        0.25 * _saturate(road_len_m, _K_CONFIDENCE_ROAD_M) +
        0.20 * _saturate(f["bus_count"] + f["rail_count"] * 2, _K_CONFIDENCE_TRANSIT)
    , 1)

    return {
        "overall_score": overall_score,
        "accessibility": accessibility,
        "commercial_potential": commercial_potential,
        "residential_density": residential_density_score,
        "transit_connectivity": transit_connectivity,
        "footfall_potential": footfall_potential,
        "ai_confidence": ai_confidence,
    }



# Deterministic recommendation engine removed in v3.0 in favor of pure LLM recommendations.
# The LLM layer (llm_recommendation.py) is now the single source of truth for
# top_recommendations, audience profile, and SWOT content, and reasons over the
# FULL category_counts/category_densities breakdown rather than a fixed list
# of verticals, so it adapts to whatever POI mix is present at any location.


# ---------------------------------------------------------------------------
# Explanation Panel Generation
# ---------------------------------------------------------------------------

def generate_explanation(features: dict, kpis: dict) -> dict:
    has_data = (
        features["total_pois"] > 0 or
        features["road_length_m"] > 0 or
        features["transit_accessibility"] > 0 or
        features["commercial_density"] > 0 or
        features["residential_density"] > 0
    )
    if not has_data:
        return {
            "positive": [],
            "negative": [],
            "summary": "No spatial data is available within the selected radius. All values are zero.",
        }

    positive = []
    negative = []

    if kpis["transit_connectivity"] >= 65:
        positive.append("Strong transit node connectivity")
    elif kpis["transit_connectivity"] > 0:
        negative.append("Limited public transport access")

    if features["commercial_density"] >= 50:
        positive.append("Excellent commercial zone density (banking, retail & office-led)")
    elif features["commercial_density"] >= 30:
        positive.append("Moderate commercial activity")
    elif features["total_pois"] > 0:
        negative.append("Low commercial density")

    if features.get("bank_count", 0) > 0:
        positive.append(f"Banking presence nearby ({features['bank_count']} branch(es)/ATM(s))")

    if features.get("office_count", 0) >= 3:
        positive.append(f"Notable office/IT-park cluster ({features['office_count']} location(s))")

    if features["walkability"] >= 60:
        positive.append("High pedestrian walkability")
    elif features["walkability"] > 0:
        negative.append("Moderate walkability index")

    if features["land_use_mix"] >= 55:
        positive.append("Balanced land use mix")
    elif features["land_use_mix"] > 0:
        negative.append("Limited land use diversity")

    if features["competition_index"] > 0:
        if features["competition_index"] <= 40:
            positive.append("Low competitor saturation (Blue Ocean)")
        elif features["competition_index"] >= 70:
            negative.append("High competitor saturation in area")
        else:
            negative.append("Moderate competition level")

    if features["green_cover_ratio"] >= 15:
        positive.append("Good green space and park access")
    elif features["green_cover_ratio"] > 0:
        negative.append("Limited green space coverage")

    if features["transit_accessibility"] >= 60:
        positive.append("Excellent transit and bus/metro access")

    if features["metro_count"] > 0:
        positive.append(f"Metro station nearby ({features['metro_count']} stop(s))")

    if features["residential_density"] >= 40:
        positive.append("Large residential population buffer")

    return {"positive": positive[:5], "negative": negative[:3], "summary": ""}


# ---------------------------------------------------------------------------
# POI Category Density Table (legend-driven, 17 fixed main categories)
# ---------------------------------------------------------------------------

def _relative_min_max_share(densities: dict) -> dict:
    """
    Min-max normalize a set of category densities to 0-100, RELATIVE TO EACH
    OTHER, for THIS ONE radial chart only.

    This is intentionally NOT used for bar length. Min-max always stretches
    the locally-largest value to 100%, so two very different locations — one
    genuinely thriving, one nearly empty — would render with an identically
    "full" bar for whatever their single most-common category happens to be.
    That makes locations visually indistinguishable from each other, which
    defeats the point of the chart.

    Use this ONLY as a secondary signal — e.g. to highlight/color the
    locally-dominant category within one chart — never as the bar length
    itself. Bar length should come from `absolute_score` below.
    """
    non_zero = {k: v for k, v in densities.items() if v > 0}
    if not non_zero:
        return {k: 0.0 for k in densities}
    d_min, d_max = min(non_zero.values()), max(non_zero.values())
    if d_max == d_min:
        # Every present category sits at the same density — no basis to rank
        # them against each other, so give them equal (full) relative share.
        return {k: (100.0 if v > 0 else 0.0) for k, v in densities.items()}
    return {
        k: (round((v - d_min) / (d_max - d_min) * 100, 1) if v > 0 else 0.0)
        for k, v in densities.items()
    }


def _aggregate_to_main_categories(poi_counts: dict) -> dict:
    """
    Directly map the 17 legend categories to their counts.
    """
    main_counts = {cat: 0 for cat in POI_LEGEND_CATEGORIES}
    for cat in POI_LEGEND_CATEGORIES:
        main_counts[cat] = poi_counts.get(cat, 0)
    return main_counts


def build_poi_distribution(poi_counts: dict, radius_m: float) -> list:
    """
    Builds the POI category density legend using EXACTLY the 17 required
    main verticals (POI_LEGEND_CATEGORIES) — never the raw fine-grained
    sub-categories.

    Each row carries:
      - `absolute_score` (0-100): density for that bucket run through
        _saturate() using THAT bucket's own independently calibrated k
        (K_MAIN[bucket] = EXPECTED_MAX_DENSITY_MAIN[bucket] / 3). This is
        comparable ACROSS locations — "Healthcare = 70" means the same
        real-world healthcare density anywhere, using a formula tuned
        specifically for healthcare POIs, not borrowed from another
        category. USE THIS for radial/bar chart LENGTH.

      - `relative_share` (0-100): min-max normalized only within these 17
        buckets at THIS location, for THIS one chart. Useful for
        highlighting which vertical locally dominates (color intensity,
        sort order), but never for bar length — see
        _relative_min_max_share() for why.

    `weighted_score` is kept for backward compatibility with existing
    frontend code that may already read it, and is now just an alias for
    `absolute_score`.

    The returned list always has exactly len(POI_LEGEND_CATEGORIES) rows, in
    the same fixed order every time, so the frontend legend is stable.
    """
    area_km2 = _circle_area_km2(radius_m)

    main_counts = _aggregate_to_main_categories(poi_counts)
    total = sum(main_counts.values())

    # First pass: compute density per bucket (needed before either
    # normalization can run).
    densities = {
        cat: (round(count / area_km2, 2) if count > 0 else 0.0)
        for cat, count in main_counts.items()
    }

    relative_shares = _relative_min_max_share(densities)

    result = []
    for cat in POI_LEGEND_CATEGORIES:
        count = main_counts[cat]
        density = densities[cat]
        percentage = round(count / total * 100, 1) if total > 0 else 0.0

        # Each bucket's OWN calibration constant — see K_MAIN above.
        k_cat = K_MAIN[cat]
        absolute_score = round(_saturate(density, k_cat), 1) if count > 0 else 0.0

        result.append({
            "category": cat,
            "label": POI_LEGEND_LABELS[cat],
            "count": count,
            "density": density,
            "percentage": percentage,
            "absolute_score": absolute_score,
            "relative_share": relative_shares.get(cat, 0.0),
            "weighted_score": absolute_score,  # kept as an alias for backward compatibility
        })

    return result


# ---------------------------------------------------------------------------
# Road Analytics Scores
# ---------------------------------------------------------------------------

def compute_road_analytics(features: dict) -> dict:
    """
    Reworked to reuse the canonical bounded sub-scores computed once in
    compute_features() (road_density_score, junction_density_score,
    transit_accessibility, walkability) via convex combinations, instead of
    re-deriving separate min(raw*const,100) clips on the same raw metrics
    with yet another set of ad hoc constants. Two genuinely distinct
    ABSOLUTE-scale signals — total road length in km, and absolute bus+rail
    count — are kept deliberately separate from their area-normalized
    counterparts (road_density_score / transit_accessibility), since "50 km
    of road nearby" and "50 km of road per km²" are different facts; each is
    smoothed via the same _saturate() curve rather than a hard cap.
    """
    f = features

    # Weights: 0.50 + 0.30 + 0.20 = 1.00
    connectivity = round(
        0.50 * f["road_density_score"] +
        0.30 * f["junction_density_score"] +
        0.20 * f["transit_accessibility"]
    , 1)

    # Weights: 0.55 + 0.25 + 0.20 = 1.00
    accessibility = round(
        f["transit_accessibility"] * 0.55 +
        f["road_density_score"]    * 0.25 +
        f["walkability"]           * 0.20
    , 1)

    walkability = round(f["walkability"], 1)

    # Weights: 0.60 + 0.40 = 1.00
    traffic_density = round(
        0.60 * f["road_density_score"] +
        0.40 * f["junction_density_score"]
    , 1)

    # road_quality reflects ABSOLUTE infrastructure size (km of road nearby),
    # not road_density (length/area) — a real, distinct signal.
    road_length_score = round(_saturate(f["road_length_m"] / 1000.0, _K_ROAD_LENGTH_KM), 1)
    # Weights: 0.50 + 0.50 = 1.00
    road_quality = round(
        0.50 * road_length_score +
        0.50 * f["junction_density_score"]
    , 1)

    # public_transport re-emphasizes transit (0.65) plus a smoothed ABSOLUTE
    # bus+rail count (0.35), distinct from transit_accessibility's
    # area-normalized density.
    transit_abs_score = round(_saturate(f["bus_count"] + f["rail_count"] * 2, _K_TRANSIT_ABS_COUNT), 1)
    # Weights: 0.65 + 0.35 = 1.00
    public_transport = round(
        f["transit_accessibility"] * 0.65 +
        transit_abs_score          * 0.35
    , 1)

    return {
        "connectivity": _clamp(connectivity),
        "accessibility": _clamp(accessibility),
        "walkability": _clamp(walkability),
        "trafficDensity": _clamp(traffic_density),
        "roadQuality": _clamp(road_quality),
        "publicTransport": _clamp(public_transport),
    }


# ---------------------------------------------------------------------------
# Main Analyze Endpoint
# ---------------------------------------------------------------------------

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "location-service"
    }

@app.get("/")
def home():
    return {"message": "Location Intelligence API v3.2 — Running"}


# ---------------------------------------------------------------------------
# Spatial data fetcher — used by _analyze_location_internal
# ---------------------------------------------------------------------------

_POI_CAT_SQL = """
    SELECT
        COALESCE(main_category, 'other') AS cat_group,
        COUNT(*) AS cnt
    FROM public.poi_master
    WHERE {where_clause}
    GROUP BY cat_group;
"""


def _fetch_spatial_data(conn, lat: float, lng: float, r_lat: float):
    """
    Run all spatial sub-queries for a given (lat, lng, r_lat).
    Roads and transit are searched at progressively wider radii (up to 10x)
    because those tables have geographic gaps — if the query point sits just
    outside the roads_master/transit_master bbox we still want road metrics.
    """
    params = {"lat": lat, "lng": lng, "r_lat": r_lat}
    where_radial = (
        "ST_DWithin("
        "    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326),"
        "    ST_SetSRID(ST_MakePoint(:lng, :lat), 4326),"
        "    :r_lat"
        ")"
    )

    poi_rows = conn.execute(
        text(_POI_CAT_SQL.format(where_clause=where_radial)), params
    ).fetchall()

    # --- Transit: expand up to 10x radius to cover table coverage gaps ---
    transit_rows = []
    for tr_mult in [1.0, 2.0, 5.0, 10.0]:
        tr_r = r_lat * tr_mult
        transit_rows = conn.execute(text("""
            SELECT transit_type, COUNT(osm_id) AS cnt
            FROM public.transit_master
            WHERE ST_DWithin(geometry, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), :r)
            GROUP BY transit_type;
        """), {"lat": lat, "lng": lng, "r": tr_r}).fetchall()
        if transit_rows:
            break

    # --- Landuse: expand up to 10x radius to cover table coverage gaps ---
    landuse_rows = []
    for lu_mult in [1.0, 2.0, 5.0, 10.0]:
        lu_r = r_lat * lu_mult
        landuse_rows = conn.execute(text("""
            SELECT landuse_category, COALESCE(SUM(area), 0) AS total_area
            FROM public.landuse_master
            WHERE ST_DWithin(geometry, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), :r)
            GROUP BY landuse_category;
        """), {"lat": lat, "lng": lng, "r": lu_r}).fetchall()
        if landuse_rows:
            break


    # --- Roads: expand up to 10x radius to cover table coverage gaps ---
    road_len_m = 0.0
    junction_count = 0
    for rd_mult in [1.0, 2.0, 5.0, 10.0]:
        rd_r = r_lat * rd_mult
        road_row = conn.execute(text("""
            SELECT COALESCE(SUM(ST_Length(geometry::geography)), 0) AS road_len
            FROM public.roads_master
            WHERE ST_DWithin(geometry, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), :r);
        """), {"lat": lat, "lng": lng, "r": rd_r}).fetchone()
        jc = conn.execute(text("""
            SELECT COUNT(*) FROM public.roads_master
            WHERE ST_DWithin(geometry, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), :r);
        """), {"lat": lat, "lng": lng, "r": rd_r}).scalar() or 0
        if road_row and float(road_row[0]) > 0:
            road_len_m = float(road_row[0])
            junction_count = int(jc)
            break

    bus_count = conn.execute(text("""
        SELECT COUNT(*) FROM public.transit_master
        WHERE transit_type = 'bus'
        AND ST_DWithin(geometry, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), :r_lat);
    """), params).scalar() or 0

    heatmap_rows = conn.execute(text("""
        SELECT latitude, longitude FROM public.poi_master
        WHERE ST_DWithin(
            ST_SetSRID(ST_MakePoint(longitude, latitude), 4326),
            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), :r_lat
        )
        ORDER BY RANDOM() LIMIT 60;
    """), params).fetchall()

    pins_rows = conn.execute(text("""
        SELECT place AS name, main_category, sub_category, latitude, longitude
        FROM public.poi_master
        WHERE ST_DWithin(
            ST_SetSRID(ST_MakePoint(longitude, latitude), 4326),
            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), :r_lat
        )
        LIMIT 30;
    """), params).fetchall()

    return {
        "poi_rows": poi_rows,
        "transit_rows": transit_rows,
        "landuse_rows": landuse_rows,
        "road_len_m": road_len_m,
        "junction_count": junction_count,
        "bus_count": int(bus_count),
        "heatmap_rows": heatmap_rows,
        "pins_rows": pins_rows,
    }


def _fetch_spatial_data_by_area(conn, area_name: str):
    """
    Fallback: pull all POI / transit / landuse / road data whose `area` label
    (in poi_master) matches `area_name`. Used when no spatial rows are found
    even at a large radius, so at least the area-level summary is correct.
    The centroid of the matching POIs is used as the reference point.
    """
    logger.info("[analyze] Falling back to area-name lookup for area='%s'", area_name)

    centre_row = conn.execute(text("""
        SELECT AVG(latitude) AS clat, AVG(longitude) AS clng
        FROM public.poi_master
        WHERE LOWER(area) = LOWER(:area) AND area IS NOT NULL AND area != '';
    """), {"area": area_name}).fetchone()

    if not centre_row or centre_row[0] is None:
        logger.warning("[analyze] Area-name fallback found no rows for area='%s'", area_name)
        return None, None, None

    clat, clng = float(centre_row[0]), float(centre_row[1])
    r_lat, _ = _deg_radii(clat, 3000)

    data = _fetch_spatial_data(conn, clat, clng, r_lat)
    total_pois = sum(int(r[1]) for r in data["poi_rows"])
    logger.info(
        "[analyze] Area-name fallback centroid=(%.5f, %.5f) radius=3000m, POIs=%d",
        clat, clng, total_pois,
    )
    return data, clat, clng


def _analyze_location_internal(latitude: float, longitude: float, radius: int) -> dict:
    try:
        with engine.connect() as conn:
            # Step 1: detect the area name (nearest POI label, always works)
            area_row = conn.execute(text("""
                SELECT area
                FROM public.poi_master
                WHERE area IS NOT NULL AND area != ''
                ORDER BY ST_Distance(
                    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
                    ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                )
                LIMIT 1;
            """), {"lat": latitude, "lng": longitude}).fetchone()
            detected_area = area_row[0] if area_row else "Unknown"
            logger.info("[analyze] Closest area detected: %s", detected_area)

            # Step 2: progressive radius expansion (1x -> 5x), stop at >= 5 POIs
            RADIUS_MULTIPLIERS = [1.0, 1.5, 2.0, 3.0, 5.0]
            MIN_POIS_THRESHOLD = 5
            data = None
            effective_radius = radius

            for mult in RADIUS_MULTIPLIERS:
                eff_r = int(radius * mult)
                r_lat, _ = _deg_radii(latitude, eff_r)
                candidate = _fetch_spatial_data(conn, latitude, longitude, r_lat)
                total_poi_count = sum(int(r[1]) for r in candidate["poi_rows"])
                logger.info(
                    "[analyze] radius=%dm mult=%.1f POIs=%d road_len=%.0fm",
                    eff_r, mult, total_poi_count, candidate["road_len_m"],
                )
                if total_poi_count >= MIN_POIS_THRESHOLD or candidate["road_len_m"] > 0:
                    data = candidate
                    effective_radius = eff_r
                    break

            # Step 3: if still nothing, fall back to area-name bounding box
            area_fallback_used = False
            if data is None or sum(int(r[1]) for r in data["poi_rows"]) < MIN_POIS_THRESHOLD:
                fb_data, clat, clng = _fetch_spatial_data_by_area(conn, detected_area)
                if fb_data is not None:
                    data = fb_data
                    effective_radius = 3000
                    area_fallback_used = True
                    logger.info("[analyze] Using area-name fallback data (centroid)")

            if data is None:
                data = {
                    "poi_rows": [], "transit_rows": [], "landuse_rows": [],
                    "road_len_m": 0.0, "junction_count": 0, "bus_count": 0,
                    "heatmap_rows": [], "pins_rows": [],
                }

            poi_rows = data["poi_rows"]
            transit_rows = data["transit_rows"]
            landuse_rows = data["landuse_rows"]
            road_len_m = data["road_len_m"]
            junction_count = data["junction_count"]
            bus_rows = data["bus_count"]
            heatmap_rows = data["heatmap_rows"]
            pins_rows = data["pins_rows"]

            logger.info(
                "[analyze] Final — POI groups: %d, transit: %d, landuse: %d, road_len: %.0f m "
                "(radius=%dm, area_fallback=%s)",
                len(poi_rows), len(transit_rows), len(landuse_rows), road_len_m,
                effective_radius, area_fallback_used,
            )

            # Query real estate values within the active connection context
            re_rows = []
            try:
                re_rows = conn.execute(text('''
                    SELECT
                        re."Source",
                        re."Area",
                        re."Area_Tamil",
                        re."Category",
                        re."Tier",
                        re."Price_Low_INR_per_sqft",
                        re."Price_High_INR_per_sqft"
                    FROM public.chennai_real_estate_values re
                    WHERE LOWER(re."Area") = LOWER(:area)
                    ORDER BY re."Area", re."Category", re."Tier";
                '''), {"area": detected_area}).fetchall()
            except Exception as re_err:
                logger.error("[analyze] Error querying real estate: %s", re_err)


        poi_counts = {}
        for row in poi_rows:
            cat, cnt = row[0], int(row[1])
            if cat in ("other", "others", "Other", "Others", None):
                continue
            poi_counts[cat] = poi_counts.get(cat, 0) + cnt

        poi_counts["BusStops"] = poi_counts.get("BusStops", 0) + int(bus_rows)

        transit_counts = {row[0]: int(row[1]) for row in transit_rows}
        landuse_areas = {row[0]: float(row[1]) for row in landuse_rows}

        # --- Landuse fallback: ensure zoning is never empty by synthesizing from POIs ---
        if sum(landuse_areas.values()) == 0:
            synthesized = {}
            for cat, cnt in poi_counts.items():
                if cnt <= 0:
                    continue
                cat_lower = cat.lower()
                if "residential" in cat_lower:
                    synthesized["residential"] = synthesized.get("residential", 0.0) + cnt * 1200.0
                elif "education" in cat_lower:
                    synthesized["education"] = synthesized.get("education", 0.0) + cnt * 2000.0
                elif "fitness" in cat_lower or "travel_tourism" in cat_lower:
                    synthesized["recreation"] = synthesized.get("recreation", 0.0) + cnt * 1500.0
                elif "office" in cat_lower or "commercial" in cat_lower or "banking_finance" in cat_lower:
                    synthesized["commercial"] = synthesized.get("commercial", 0.0) + cnt * 800.0
                elif "shopping" in cat_lower or "retail" in cat_lower or "fashion" in cat_lower or "electronics" in cat_lower or "home_furnishing" in cat_lower:
                    synthesized["retail"] = synthesized.get("retail", 0.0) + cnt * 500.0
                elif "food_dining" in cat_lower:
                    synthesized["mixed"] = synthesized.get("mixed", 0.0) + cnt * 400.0
                elif "healthcare" in cat_lower:
                    synthesized["mixed"] = synthesized.get("mixed", 0.0) + cnt * 600.0
                else:
                    synthesized["mixed"] = synthesized.get("mixed", 0.0) + cnt * 300.0
            
            if not synthesized:
                # Absolute fallback baseline mix if no POIs are present either
                synthesized = {
                    "residential": 6000.0,
                    "commercial": 3000.0,
                    "recreation": 1000.0
                }
            landuse_areas = {k: round(v, 2) for k, v in synthesized.items()}

        logger.info(
            "[analyze] Parsed totals — POIs: %d, transit types: %d, landuse cats: %d, road_len: %.1f m",
            sum(poi_counts.values()), len(transit_counts), len(landuse_areas), road_len_m
        )


        features = compute_features(poi_counts, transit_counts, landuse_areas,
                                    road_len_m, int(junction_count), effective_radius)

        kpis = compute_kpis(features, poi_counts, road_len_m)
        kpi_labels = label_kpis(kpis)

        llm_recommendation = get_llm_recommendations(
            features=features,
            kpis=kpis,
            area_label=detected_area,
        )
        top_recommendations = []
        for domain in llm_recommendation.get("best_advertising_domains", []):
            top_recommendations.append({
                "category": domain.get("category"),
                "score": domain.get("score", 50.0),
                "confidence": domain.get("score", 50.0),
                "reason": domain.get("rationale")
            })

        explanation = generate_explanation(features, kpis)

        poi_distribution = build_poi_distribution(poi_counts, effective_radius)

        total_lu = sum(landuse_areas.values())
        lu_display_map = {
            "residential": "Residential", "commercial": "Commercial",
            "industrial": "Industrial", "retail": "Retail",
            "education": "Education", "school": "Education",
            "university": "Education", "recreation": "Recreation",
            "park": "Recreation", "greenfield": "Recreation",
            "mixed": "Mixed Use", "mixed_use": "Mixed Use",
            "construction": "Specialized Uses",
        }
        lu_merged: dict = {}
        for raw_cat, area in landuse_areas.items():
            display = lu_display_map.get(raw_cat.lower(), "Specialized Uses")
            lu_merged[display] = lu_merged.get(display, 0) + area


        land_use_distribution = (
            [{"name": k, "value": round(v / total_lu * 100, 1)} for k, v in lu_merged.items() if v > 0]
            if total_lu > 0 else []
        )

        road_analytics = compute_road_analytics(features)

        heatmap_points = [
            {"lat": float(r[0]), "lng": float(r[1]), "intensity": 0.75}
            for r in heatmap_rows if r[0] and r[1]
        ]
        if heatmap_points:
            heatmap_points.append({"lat": latitude, "lng": longitude, "intensity": 0.95})

        def _map_type(main_cat: str, sub_cat: str) -> str:
            if main_cat == 'food_dining' or sub_cat in ['restaurant', 'fast_food', 'cafe', 'bar', 'pub', 'food_court', 'ice_cream']:
                return "Restaurant"
            if sub_cat in ['hotel', 'motel', 'guest_house', 'hostel']:
                return "Hotel"
            if main_cat in ['shopping', 'electronics', 'retail', 'fashion', 'home_furnishing'] or sub_cat in ['supermarket', 'convenience', 'department_store', 'wholesale', 'furniture', 'cosmetics', 'clothes', 'mobile_phone', 'bag', 'shoes', 'gadget_shop', 'appliance', 'computer']:
                return "Shopping"
            if main_cat == 'banking_finance' or sub_cat in ['bank', 'atm', 'banking', 'bureau_de_change']:
                return "Bank"
            if main_cat == 'education' or sub_cat in ['school', 'university', 'kindergarten', 'college', 'driving_school', 'language_school', 'music_school']:
                return "School"
            if main_cat == 'healthcare' or sub_cat in ['hospital', 'clinic', 'dentist', 'doctors', 'pharmacy', 'veterinary']:
                return "Hospital"
            if sub_cat in ['park', 'playground', 'sports_centre', 'stadium', 'fitness_centre']:
                return "Park"
            if main_cat == 'office' or sub_cat in ['it_park___office', 'commercial_zone', 'estate_agent', 'company_hub']:
                return "Office"
            if main_cat == 'entertainment' or sub_cat in ['cinema', 'theatre', 'entertainment_fitness', 'museum']:
                return "Entertainment"
            if main_cat == 'travel_tourism' or sub_cat in ['viewpoint', 'attraction', 'tourism']:
                return "Entertainment"
            if sub_cat in ['bus_station', 'railway_station', 'subway_entrance']:
                return "Transit"
            if main_cat == 'real_estate' or sub_cat in ['real_estate', 'estate_agent']:
                return "Real Estate"
            if main_cat == 'government' or sub_cat in ['government_office', 'government']:
                return "Government"
            return "POI"

        poi_locations = []
        for r in pins_rows:
            name = r[0] or f"{r[1].capitalize()} Node"
            poi_type = _map_type(r[1] or "", r[2] or "")
            poi_locations.append({
                "name": name,
                "type": poi_type,
                "lat": float(r[3]),
                "lng": float(r[4]),
            })

        # Format the pre-fetched 5 nearest real estate areas and their corresponding records
        real_estate_records = []
        try:
            for r in re_rows:
                real_estate_records.append({
                    "source": r[0],
                    "area": r[1],
                    "area_tamil": r[2],
                    "category": r[3],
                    "tier": r[4],
                    "price_low": int(r[5]) if r[5] is not None else 0,
                    "price_high": int(r[6]) if r[6] is not None else 0,
                })
        except Exception as re_err:
            logger.error("[analyze] Error parsing pre-fetched real estate values: %s", re_err)


        raw_data = {
            "poi_counts": poi_counts,
            "transit_counts": transit_counts,
            "landuse_areas": landuse_areas,
            "road_length_m": road_len_m,
            "junction_count": junction_count,
            "detected_area": detected_area,
            "radius_m": effective_radius,
            "coordinates": {
                "latitude": latitude,
                "longitude": longitude
            }
        }

        return {
            "latitude": latitude,
            "longitude": longitude,
            "radius": effective_radius,
            "area": detected_area,
            "features": features,
            "kpis": kpis,
            "kpi_labels": kpi_labels,
            "top_recommendations": top_recommendations,
            "llm_recommendation": llm_recommendation,
            "explanation": explanation,
            "poi_distribution": poi_distribution,
            "land_use_distribution": land_use_distribution,
            "road_analytics": road_analytics,
            "heatmap_points": heatmap_points,
            "poi_locations": poi_locations,
            "real_estate": real_estate_records,
            "real_estate_score": _calculate_real_estate_score(poi_counts, features),
            "raw_data": raw_data,
        }


    except Exception as e:
        logger.error("[analyze_location] Database error: %s", e, exc_info=True)
        raise HTTPException(
            status_code=503,
            detail=f"Spatial database query failed: {str(e)}"
        )


@app.get("/api/v1/analyze")
def analyze_location(
    latitude: float = Query(..., ge=-90, le=90, description="Latitude of analysis point"),
    longitude: float = Query(..., ge=-180, le=180, description="Longitude of analysis point"),
    radius: int = Query(1000, ge=100, le=5000, description="Radius in metres"),
):
    # No city/region restriction — any valid latitude/longitude is analyzed
    # dynamically against whatever spatial data exists for that area.
    return _analyze_location_internal(latitude, longitude, radius)


@app.get("/api/v1/real-estate-score")
def get_real_estate_score(
    latitude: float = Query(..., ge=-90, le=90, description="Latitude"),
    longitude: float = Query(..., ge=-180, le=180, description="Longitude"),
    radius: int = Query(1000, ge=100, le=5000, description="Radius in metres"),
):
    try:
        res = _analyze_location_internal(latitude, longitude, radius)
        return {
            "area": res["area"],
            "real_estate_score": res["real_estate_score"]
        }
    except Exception as e:
        logger.error("[real_estate_score] Error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/geocode")
def geocode_location(q: str):
    """
    Resolve a free-text place name to coordinates.

    Looks up known landmark shortcuts first (fast path for common searches),
    then falls back to a database lookup against any area/place name on
    record. No city is hardcoded as the only supported region — if the
    database has POIs for a place, it resolves; otherwise a 404 is returned.
    """
    q_clean = q.strip().lower()

    landmark_shortcuts = {
        "t nagar": (13.0418, 80.2337),
        "anna nagar": (13.0850, 80.2101),
        "velachery": (12.9791, 80.2212),
        "adyar": (13.0033, 80.2550),
        "omr": (12.9156, 80.2312),
        "guindy": (13.0067, 80.2206),
        "porur": (13.0382, 80.1565),
        "tambaram": (12.9229, 80.1275),
    }

    for key, coords in landmark_shortcuts.items():
        if key in q_clean:
            return {"latitude": coords[0], "longitude": coords[1]}

    try:
        with engine.connect() as conn:
            row = conn.execute(text("""
                SELECT AVG(latitude) AS latitude, AVG(longitude) AS longitude
                FROM public.poi_master
                WHERE LOWER(area) = LOWER(:q) OR LOWER(place) = LOWER(:q)
                LIMIT 1;
            """), {"q": q}).fetchone()
            if row and row[0] is not None and row[1] is not None:
                return {"latitude": float(row[0]), "longitude": float(row[1])}

            row_fuzzy = conn.execute(text("""
                SELECT AVG(latitude) AS latitude, AVG(longitude) AS longitude
                FROM public.poi_master
                WHERE LOWER(area) LIKE :q_fuzzy OR LOWER(place) LIKE :q_fuzzy
                LIMIT 1;
            """), {"q_fuzzy": f"%{q.lower()}%"}).fetchone()
            if row_fuzzy and row_fuzzy[0] is not None and row_fuzzy[1] is not None:
                return {"latitude": float(row_fuzzy[0]), "longitude": float(row_fuzzy[1])}

            raise HTTPException(status_code=404, detail=f"Location '{q}' not found.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[geocode] error: {e}")
        raise HTTPException(status_code=400, detail="Location geocoding failed.")


@app.get("/api/v1/area/detect")
def detect_area(latitude: float, longitude: float):
    try:
        with engine.connect() as conn:
            area_row = conn.execute(text("""
                SELECT area
                FROM public.poi_master
                WHERE area IS NOT NULL AND area != ''
                ORDER BY ST_Distance(
                    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
                    ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                )
                LIMIT 1;
            """), {"lat": latitude, "lng": longitude}).fetchone()
            return {"area": area_row[0] if area_row else "Unknown"}
    except Exception as e:
        logger.error(f"[detect_area] error: {e}")
        return {"area": "Unknown"}


# ---------------------------------------------------------------------------
# Recommendation Engine Endpoint (billboards)
# ---------------------------------------------------------------------------

class RecommendationRequest(BaseModel):
    brand: str
    city: str
    objective: str
    budget: float
    audience: str
    duration: str
    campaignType: str
    radiusPreference: int
    latitude: float = None
    longitude: float = None


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


@app.post("/api/v1/recommend")
@app.post("/recommend")
def recommend_billboards(req: RecommendationRequest):
    # NOTE: this endpoint still uses name-keyword heuristics + hash(name)%15
    # in place of real per-billboard spatial features. Per the rollout plan,
    # this should be migrated to call compute_features()/compute_kpis() per
    # billboard location (same pipeline as /api/v1/analyze) BEFORE wiring in
    # get_llm_recommendations() here. Left unchanged in this pass.
    try:
        with engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT billboard_name, latitude, longitude, city
                FROM public.billboards
                WHERE LOWER(city) = LOWER(:city);
            """), {"city": req.city}).fetchall()

            if not rows:
                return {
                    "success": False,
                    "message": f"No billboards found in city {req.city}.",
                    "recommendations": []
                }

            recommendations = []
            for row in rows:
                name, lat, lng = row[0], float(row[1]), float(row[2])

                score = 55.0
                reasons = []

                name_lower = name.lower()
                brand_lower = req.brand.lower()
                audience_lower = req.audience.lower()
                objective_lower = req.objective.lower()

                if any(x in name_lower for x in ["mall", "t nagar", "phoenix", "avenue", "forum", "vr", "shopping"]):
                    reasons.extend([
                        "High shopping activity",
                        "Strong retail shop density",
                        "Premium consumer catchment area"
                    ])
                    score += 25
                elif any(x in name_lower for x in ["tidel", "omr", "sipcot", "sholinganallur", "kandanchavadi", "airport", "industrial"]):
                    reasons.extend([
                        "IT park proximity",
                        "Strong white-collar tech audience",
                        "High vehicle commuter volume"
                    ])
                    score += 25
                else:
                    reasons.extend([
                        "High vehicle commuter volume",
                        "Continuous traffic flows",
                        "General commercial exposure"
                    ])

                if "awareness" in objective_lower or "reach" in objective_lower:
                    if any(x in name_lower for x in ["mount road", "central", "egmore", "cmbt", "junction"]):
                        score += 15
                        reasons.append("Arterial road traffic exposure yielding maximum brand awareness reach")

                if "t nagar" in name_lower:
                    reasons.extend([
                        "High banking density",
                        "Strong shopping activity",
                        "Excellent metro connectivity",
                        "High residential population",
                        "Strong commercial ecosystem"
                    ])

                unique_reasons = []
                for r in reasons:
                    if r not in unique_reasons:
                        unique_reasons.append(r)

                categories = ["Retail"]
                if "electronics" in brand_lower or "tech" in brand_lower:
                    categories.append("Electronics")
                if "food" in brand_lower or "dining" in brand_lower:
                    categories.append("F&B")
                if "fashion" in brand_lower:
                    categories.append("Fashion")
                if "auto" in brand_lower:
                    categories.append("Automotive")

                distance = 0.0
                if req.latitude is not None and req.longitude is not None:
                    distance = haversine_distance(req.latitude, req.longitude, lat, lng)
                else:
                    distance = float((hash(name) % 4000) + 1200)

                comm = int(max(40, min(99, score + (hash(name) % 15))))
                foot = int(max(45, min(99, score - 5 + (hash(name) % 15))))
                tran = int(max(50, min(99, score + 2 - (hash(name) % 10))))
                res = int(max(35, min(99, 90 - (hash(name) % 30) if "mall" in name_lower or "t nagar" in name_lower else 55)))

                final_score = int(max(10, min(99, (comm + foot + tran + res) // 4)))

                recommendations.append({
                    "name": name,
                    "latitude": lat,
                    "longitude": lng,
                    "score": final_score,
                    "commercial_potential": comm,
                    "footfall_potential": foot,
                    "transit_score": tran,
                    "residential_score": res,
                    "reasons": unique_reasons[:5],
                    "distance": round(distance, 1),
                    "categories": categories
                })

            recommendations.sort(key=lambda x: x["score"], reverse=True)
            return {
                "success": True,
                "recommendations": recommendations[:5]
            }

    except Exception as e:
        logger.error("[recommend] Error calculating recommendations: %s", e)
        raise HTTPException(
            status_code=500,
            detail=f"Recommendation query engine failed: {str(e)}"
        )


# ---------------------------------------------------------------------------
# Supabase Authentication + Admin & Traffic Integration Endpoints
# ---------------------------------------------------------------------------
import os
import json
import httpx
import asyncio
from typing import List, Optional
from fastapi import Request, Header, Query, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

class AdminCreateUserRequest(BaseModel):
    email: str
    password: str
    owner_name: str
    company_name: str
    role: str = "Media Owner (Billboard Operator)"
    # Brand Advertiser fields
    brand_user_name: Optional[str] = None
    campaign_title: Optional[str] = None
    industry_category: Optional[str] = None
    phone_number: Optional[str] = None
    target_coverage_range: Optional[str] = None


async def verify_admin(authorization: str = Header(None)) -> str:
    """
    Authenticates bearer token with Supabase and checks admin permission in admins table.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header.")
    
    token = authorization.split("Bearer ")[1]
    supabase_url = os.getenv("SUPABASE_URL", "https://buqtshfptmqieaqcghfx.supabase.co")
    
    # 1. Fetch user profile from Supabase Auth
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{supabase_url}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": os.getenv("SUPABASE_KEY")}
        )
        if res.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Supabase authentication token.")
        
        user_data = res.json()
        user_id = user_data.get("id")
        user_email = user_data.get("email", "")

    # 2. Bypass check for developer admin
    if user_email.lower() == "developer@aculion.com":
        return user_id

    # 3. Check if user is in public.admins table
    with engine.connect() as conn:
        admin_row = conn.execute(
            text("SELECT 1 FROM public.admins WHERE id = :admin_id"),
            {"admin_id": user_id}
        ).fetchone()
        if not admin_row:
            raise HTTPException(status_code=403, detail="Access denied: Administrator privileges required.")
            
    return user_id

@app.post("/api/v1/admin/create-user")
async def admin_create_user(req: AdminCreateUserRequest, admin_id: str = Depends(verify_admin)):
    """
    Secure endpoint for admins to create owner/brand users.
    Calls Supabase Auth Admin API and inserts corresponding profile details.
    """
    supabase_url = os.getenv("SUPABASE_URL", "https://buqtshfptmqieaqcghfx.supabase.co")
    supabase_key = os.getenv("SUPABASE_KEY") # service-role key
    
    if not supabase_key:
        raise HTTPException(status_code=500, detail="Supabase service role key is not configured on backend.")

    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{supabase_url}/auth/v1/admin/users",
            headers={
                "apikey": supabase_key,
                "Authorization": f"Bearer {supabase_key}",
                "Content-Type": "application/json"
            },
            json={
                "email": req.email,
                "password": req.password,
                "email_confirm": True,
                "user_metadata": {
                    "owner_name": req.owner_name,
                    "company_name": req.company_name,
                    "role": req.role
                }
            }
        )
        
        if res.status_code >= 400:
            logger.error(f"Supabase user creation failed: {res.text}")
            detail = res.json().get("msg", "Failed to create user in Supabase.")
            raise HTTPException(status_code=res.status_code, detail=detail)
            
        user_data = res.json()
        new_uuid = user_data.get("id")

        # IMPORTANT: The DB trigger `on_auth_user_created` ALWAYS inserts into
        # billboard_owners when any new user is added to auth.users.
        # For Brand Advertisers, we must:
        #   1. Delete the auto-created billboard_owners row
        #   2. Insert the correct row into brand_partners
        with engine.begin() as conn:
            if req.role == "Brand Advertiser":
                # Step 1: Remove the auto-created billboard_owners row from the trigger
                conn.execute(
                    text("DELETE FROM public.billboard_owners WHERE id = :uid"),
                    {"uid": new_uuid}
                )
                # Step 2: Insert the brand details into brand_partners
                conn.execute(
                    text("""
                        INSERT INTO public.brand_partners (
                            id, campaign_title, company_name, brand_user_name,
                            contact_email, industry_category, phone_number, target_coverage_range
                        ) VALUES (
                            :id, :campaign_title, :company_name, :brand_user_name,
                            :contact_email, :industry_category, :phone_number, :target_coverage_range
                        ) ON CONFLICT (id) DO UPDATE SET
                            campaign_title = EXCLUDED.campaign_title,
                            company_name = EXCLUDED.company_name,
                            brand_user_name = EXCLUDED.brand_user_name,
                            industry_category = EXCLUDED.industry_category,
                            phone_number = EXCLUDED.phone_number,
                            target_coverage_range = EXCLUDED.target_coverage_range;
                    """),
                    {
                        "id": new_uuid,
                        "campaign_title": req.campaign_title or req.company_name or "New Campaign",
                        "company_name": req.company_name,
                        "brand_user_name": req.brand_user_name or req.owner_name,
                        "contact_email": req.email,
                        "industry_category": req.industry_category or "Retail & FMCG",
                        "phone_number": req.phone_number or "+91 98765 00000",
                        "target_coverage_range": req.target_coverage_range or "Chennai Network"
                    }
                )
            else:
                # Media Owner — the trigger already inserted into billboard_owners.
                # Just UPDATE with the correct company_name and role from the request.
                conn.execute(
                    text("""
                        INSERT INTO public.billboard_owners (
                            id, owner_name, company_name, email, role
                        ) VALUES (
                            :id, :owner_name, :company_name, :email, 'owner'
                        ) ON CONFLICT (id) DO UPDATE SET
                            owner_name = EXCLUDED.owner_name,
                            company_name = EXCLUDED.company_name,
                            email = EXCLUDED.email;
                    """),
                    {
                        "id": new_uuid,
                        "owner_name": req.owner_name,
                        "company_name": req.company_name,
                        "email": req.email
                    }
                )

        return {"success": True, "user": user_data}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    logger.info(f"Starting Location Service on port {port}...")
    uvicorn.run("api.main:app", host="0.0.0.0", port=port, reload=False)
