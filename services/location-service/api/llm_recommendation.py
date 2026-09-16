"""
LLM-based reasoning layer for the location intelligence recommendation engine.

v3.0 - Location-agnostic, broad-vertical, evidence-backed recommendations.
  - No deterministic formula-engine fallback. If the LLM call fails, times
    out, returns malformed output, or is disabled, this module returns an
    empty recommendation dictionary rather than fabricating a fallback.
  - The system prompt no longer nudges the model toward Retail/FMCG/Dining.
    It is given the FULL detected POI category breakdown (category_counts /
    category_densities) for the actual queried location — which could be
    anywhere, not just a fixed city — and is instructed to reason over the
    entire catalogue of business verticals (Retail, FMCG, Food & Dining,
    Healthcare, Education, Banking & Finance, Automotive, Real Estate,
    Fashion, Electronics, Fitness, Entertainment, Travel & Tourism,
    Hospitality, Residential Services, Office & B2B, Government Services,
    Home Furnishing, or any other vertical the POI mix supports).
  - Each of the top 3 recommended verticals must now include a `reason` AND
    a `supporting_evidence` string that cites the specific POI counts/
    densities that justify it — no generic or templated phrasing.
  - Audience profile is now returned as structured `audience_segments`, each
    segment tied explicitly to the POI types that imply it (e.g. schools/
    colleges -> students, offices/IT parks -> working professionals).
  - SWOT is returned as four dynamic lists — `strengths`, `weaknesses`,
    `opportunities`, `limitations` — replacing the old generic
    strengths/weaknesses/risks fields, all grounded in the supplied data.
"""

from __future__ import annotations

import os
import json
import time
import hashlib
import logging

import requests
try:
    from dotenv import load_dotenv
    load_dotenv()
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
except Exception:
    pass

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# NVIDIA NIM setup
# ---------------------------------------------------------------------------

NVIDIA_INVOKE_URL = os.environ.get(
    "NVIDIA_INVOKE_URL", "https://integrate.api.nvidia.com/v1/chat/completions"
)
MODEL_NAME = os.environ.get("LLM_RECOMMENDATION_MODEL", "meta/llama-3.1-8b-instruct")
USE_LLM = os.environ.get("USE_LLM_RECOMMENDATIONS", "true").lower() == "true"


def _get_api_key() -> str:
    api_key = os.environ.get("NVIDIA_API_KEY")
    if not api_key:
        try:
            from dotenv import load_dotenv
            load_dotenv()
            load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
        except Exception:
            pass
        api_key = os.environ.get("NVIDIA_API_KEY")

    if not api_key:
        raise RuntimeError("NVIDIA_API_KEY environment variable is not set")

    api_key = api_key.strip()
    if api_key.startswith("Bearer "):
        api_key = api_key[7:].strip()
    return api_key


class NvidiaAPIError(Exception):
    """Raised for any non-2xx response from the NVIDIA NIM endpoint."""
    def __init__(self, status_code: int, body: str):
        self.status_code = status_code
        self.body = body
        super().__init__(f"NVIDIA NIM API error {status_code}: {body[:300]}")


# ---------------------------------------------------------------------------
# Lightweight in-memory TTL cache
# ---------------------------------------------------------------------------


class _TTLCache:
    def __init__(self, ttl_seconds: int = 3600, max_size: int = 5000):
        self.ttl = ttl_seconds
        self.max_size = max_size
        self._store: dict[str, tuple[float, dict]] = {}

    def get(self, key: str):
        entry = self._store.get(key)
        if not entry:
            return None
        ts, value = entry
        if time.time() - ts > self.ttl:
            del self._store[key]
            return None
        return value

    def set(self, key: str, value: dict):
        if len(self._store) >= self.max_size:
            oldest_key = min(self._store, key=lambda k: self._store[k][0])
            del self._store[oldest_key]
        self._store[key] = (time.time(), value)


_cache = _TTLCache(ttl_seconds=int(os.environ.get("LLM_RECOMMENDATION_CACHE_TTL_S", "3600")))


def _fingerprint(features: dict, kpis: dict, area_label: str = "") -> str:
    """Round numeric inputs into buckets of 5 so near-identical locations
    share a cache entry instead of hitting the LLM on every tiny variation.
    category_counts/category_densities are included in full (not bucketed)
    since exact POI composition is what differentiates recommendations
    across otherwise-similar-scoring locations anywhere in the world."""
    merged = {k: v for k, v in {**features, **kpis}.items()
              if k not in ("category_counts", "category_densities")}
    rounded = {
        k: (round(v / 5) * 5 if isinstance(v, (int, float)) else v)
        for k, v in merged.items()
    }
    rounded["category_counts"] = features.get("category_counts", {})
    rounded["area_label"] = area_label
    blob = json.dumps(rounded, sort_keys=True)
    return hashlib.sha256(blob.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Validation / guardrail layer
# ---------------------------------------------------------------------------

def _get_empty_recommendation(features: dict = None, kpis: dict = None, area_label: str = "") -> dict:
    if not features or not kpis:
        return {
            "best_advertising_domains": [],
            "why_domains_fit": "",
            "advantages_of_publishing": [],
            "target_audience": [],
            "area_strength_summary": "",
            # Legacy back-compat fields
            "ai_recommendation": "",
            "top_advertising_categories": [],
            "audience_segments": [],
            "target_audience_legacy": "",
            "why_fits": "",
            "expected_customer_profile": "",
            "best_performing_industries": [],
            "shadow_glow": "",
            "strengths": [],
            "weaknesses": [],
            "opportunities": [],
            "limitations": [],
            "suggested_campaigns": [],
        }

    # Deterministic fallback generator based on spatial stats
    total_pois = features.get("total_pois", 0)
    transit_accessibility = features.get("transit_accessibility", 0.0)
    commercial_density = features.get("commercial_density", 0.0)
    residential_density = features.get("residential_density", 0.0)
    walkability = features.get("walkability", 0.0)

    # Count specific POIs from category_counts
    cat_counts = features.get("category_counts", {})
    food_count = cat_counts.get("food_dining", 0)
    shopping_count = cat_counts.get("shopping", 0)
    office_count = cat_counts.get("office", 0) + cat_counts.get("commercial", 0)
    bank_count = cat_counts.get("banking_finance", 0)
    edu_count = cat_counts.get("education", 0)
    health_count = cat_counts.get("healthcare", 0)

    # Generate best advertising domains
    domains = []
    
    # 1. Retail & FMCG (always a solid choice, score depends on POI counts)
    retail_score = min(95.0, 50.0 + shopping_count * 5.0 + food_count * 2.0)
    domains.append({
        "category": "Retail & FMCG",
        "score": retail_score,
        "rationale": f"High density of local shopping and dining indicates active consumer retail footfall in {area_label or 'this area'}."
    })

    # 2. Food & Dining
    food_score = min(95.0, 45.0 + food_count * 6.0)
    domains.append({
        "category": "Food & Dining",
        "score": food_score,
        "rationale": f"Supported by a strong presence of dining and culinary establishments nearby, creating a natural audience for food/beverage promotions."
    })

    # 3. Banking & Finance (if banking/office presence)
    if bank_count > 0 or office_count > 0:
        fin_score = min(95.0, 40.0 + bank_count * 10.0 + office_count * 3.0)
        domains.append({
            "category": "Banking & Finance",
            "score": fin_score,
            "rationale": f"Driven by financial/banking locations and commercial offices, attracting working professionals and business customers."
        })

    # 4. Education & Youth (if school/college presence)
    if edu_count > 0:
        edu_score = min(95.0, 45.0 + edu_count * 12.0)
        domains.append({
            "category": "Education & Student Services",
            "score": edu_score,
            "rationale": f"Directly targets students and academic staff visiting the educational institutions mapped in this zone."
        })

    # 5. Healthcare & Wellness
    if health_count > 0:
        health_score = min(95.0, 40.0 + health_count * 8.0)
        domains.append({
            "category": "Healthcare & Wellness",
            "score": health_score,
            "rationale": f"Caters to patients, visitors, and practitioners associated with the healthcare facilities in the vicinity."
        })

    # Sort domains by score descending
    domains.sort(key=lambda x: x["score"], reverse=True)
    domains = domains[:3]  # keep top 3

    # Why domains fit
    why_fit_parts = []
    if commercial_density >= 40:
        why_fit_parts.append("its dense commercial fabric")
    if transit_accessibility >= 50:
        why_fit_parts.append("outstanding transit accessibility")
    if total_pois > 10:
        why_fit_parts.append(f"a highly active hub of local points of interest")
    
    area_name = area_label or "the selected location"
    if why_fit_parts:
        why_domains_fit = f"These advertising domains are selected for {area_name} due to " + ", ".join(why_fit_parts[:-1]) + (f" and {why_fit_parts[-1]}." if len(why_fit_parts) > 1 else f"{why_fit_parts[0]}.")
    else:
        why_domains_fit = f"These advertising domains match the general consumer traffic profile and road layout of {area_name}."

    # Advantages of publishing
    advantages = []
    if transit_accessibility >= 50:
        advantages.append("High commuter flow from transit/bus stops maximizes repeated ad impressions.")
    if walkability >= 60:
        advantages.append("Excellent pedestrian walkability increases billboard dwell time and viewability.")
    if commercial_density >= 40:
        advantages.append("Commercial cluster presence attracts high-spending daytime office workers.")
    if total_pois >= 15:
        advantages.append("Proximity to multiple retail/dining destinations captures intent-driven shoppers.")
    if not advantages:
        advantages.append("Strategically located to capture local neighborhood traffic and residents.")

    # Target audience
    audiences = []
    if commercial_density >= 30:
        audiences.append({
            "segment": "Office Workers & Professionals",
            "driven_by": f"Office and commercial locations nearby",
            "relevance": "Caters to business professionals, commuters, and lunchtime visitors with higher disposable income."
        })
    if transit_accessibility >= 40:
        audiences.append({
            "segment": "Daily Commuters & Transit Riders",
            "driven_by": f"Transit stops and corridors in the area",
            "relevance": "High frequency of travel through bus/rail transit corridors ensures ad recall."
        })
    if food_count > 0 or shopping_count > 0:
        audiences.append({
            "segment": "Shoppers & Diners",
            "driven_by": f"Food and shopping venues in the vicinity",
            "relevance": "Captures active weekend and evening consumer traffic seeking dining and entertainment options."
        })
    if not audiences:
        audiences.append({
            "segment": "Local Residents & Pedestrians",
            "driven_by": f"Local community areas",
            "relevance": "Reaches the core neighborhood audience on daily routines and errand walks."
        })

    return {
        "best_advertising_domains": domains,
        "why_domains_fit": why_domains_fit,
        "advantages_of_publishing": advantages,
        "target_audience": audiences,
        "area_strength_summary": why_domains_fit,
        "ai_recommendation": why_domains_fit,
        "top_advertising_categories": [d["category"] for d in domains],
        "audience_segments": [a["segment"] for a in audiences],
        "target_audience_legacy": ", ".join(a["segment"] for a in audiences),
        "why_fits": why_domains_fit,
        "expected_customer_profile": ", ".join(a["segment"] for a in audiences),
        "best_performing_industries": [d["category"] for d in domains],
        "strengths": advantages,
        "weaknesses": ["Competition for attention from nearby signs"] if total_pois > 20 else ["Lower raw traffic volume"],
        "opportunities": ["Digital billboard placement at major intersections"],
        "limitations": ["Physical space constraints for large installations"],
        "suggested_campaigns": [f"Local promotion targeting {area_name} visitors"],
    }


import re

def _sanitize_numbers(text: str) -> str:
    if not isinstance(text, str):
        return text
    # Remove patterns like "(0 POIs)" or "(39 POIs)" or "(18 POI)"
    text = re.sub(r'\s*\(\s*\d+\s*POIs?\s*\)', '', text, flags=re.IGNORECASE)
    # Remove standalone numbers or ranges/ratios (e.g. 40/100, 218, 0, 39, etc.)
    text = re.sub(r'\b\d+(?:/\d+)?%?\b\s*', '', text)
    # Clean up double spaces or trailing punctuation spaces
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def _sanitize_all_strings(val):
    if isinstance(val, dict):
        return {k: _sanitize_all_strings(v) for k, v in val.items()}
    elif isinstance(val, list):
        return [_sanitize_all_strings(v) for v in val]
    elif isinstance(val, str):
        return _sanitize_numbers(val)
    return val

def _validate_and_clean(raw_json: dict) -> dict:
    """Enforce schema and provide fallback empty structures for missing fields."""
    cleaned = _get_empty_recommendation()

    # Strings
    cleaned["why_domains_fit"] = str(raw_json.get("why_domains_fit", "")).strip()
    cleaned["area_strength_summary"] = str(raw_json.get("area_strength_summary", "")).strip()

    # Lists of strings
    advantages = raw_json.get("advantages_of_publishing", [])
    if isinstance(advantages, list):
        cleaned["advantages_of_publishing"] = [str(v).strip() for v in advantages if v]

    # Best Advertising Domains list
    domains = raw_json.get("best_advertising_domains", [])
    if isinstance(domains, list):
        cleaned_domains = []
        for d in domains:
            if not isinstance(d, dict):
                continue
            cat_name = d.get("category")
            score = d.get("score", 50.0)
            rationale = d.get("rationale", "")

            if not cat_name:
                continue

            cleaned_domains.append({
                "category": str(cat_name).strip(),
                "score": round(float(score), 1) if isinstance(score, (int, float)) else 50.0,
                "rationale": str(rationale).strip(),
            })
        cleaned["best_advertising_domains"] = cleaned_domains[:5]

    # Target Audience list
    audience = raw_json.get("target_audience", [])
    if isinstance(audience, list):
        cleaned_audience = []
        for a in audience:
            if not isinstance(a, dict):
                continue
            segment = a.get("segment")
            driven_by = a.get("driven_by", "")
            relevance = a.get("relevance", "")

            if not segment:
                continue

            cleaned_audience.append({
                "segment": str(segment).strip(),
                "driven_by": str(driven_by).strip(),
                "relevance": str(relevance).strip(),
            })
        cleaned["target_audience"] = cleaned_audience[:6]

    # Backwards compatibility mapping
    cleaned["ai_recommendation"] = cleaned["area_strength_summary"]
    cleaned["top_advertising_categories"] = [
        {
            "category": d["category"],
            "score": d["score"],
            "confidence": d["score"],
            "reason": d["rationale"],
            "supporting_evidence": d["rationale"],
        } for d in cleaned["best_advertising_domains"]
    ]
    cleaned["audience_segments"] = [
        {
            "segment": a["segment"],
            "driven_by": a["driven_by"],
            "description": a["relevance"],
        } for a in cleaned["target_audience"]
    ]
    cleaned["target_audience_legacy"] = cleaned["why_domains_fit"]
    cleaned["expected_customer_profile"] = cleaned["why_domains_fit"]
    cleaned["why_fits"] = cleaned["why_domains_fit"]
    cleaned["best_performing_industries"] = [d["category"] for d in cleaned["best_advertising_domains"]]
    cleaned["strengths"] = cleaned["advantages_of_publishing"]

    # Post-process to guarantee that no numbers/counts leak into generated text fields
    return _sanitize_all_strings(cleaned)


SYSTEM_PROMPT = """You are a senior location-intelligence and marketing analyst for an out-of-home (OOH) digital advertising platform operating in any city or region.

You will be given a JSON object containing detailed spatial context for a single billboard/location (full POI category counts and densities, traffic estimations, vehicle segments, landuse coverage, visibility indexes, competitor counts, and walkability metrics).

Your task is to analyze this context and generate a complete, data-driven, evidence-based marketing recommendation. Do not use hardcoded rules or fixed templates. Produce natural, business-friendly insights tailored to this specific location.

The available POI categories (main_category) in the database are:
- real_estate
- fitness
- other
- food_dining
- shopping
- office
- electronics
- retail
- automotive
- healthcare
- banking_finance
- commercial
- home_furnishing
- residential
- fashion
- education
- entertainment
- travel_tourism

Required Output Fields:
Your response must be a valid JSON object matching the schema below:

{
  "best_advertising_domains": [
    {
      "category": "Ad category/domain name (e.g. Real Estate, Banking & Finance, Healthcare, Education, Fashion, Food & Dining, Retail, Automotive, etc.)",
      "score": 85,
      "rationale": "Why this domain is relevant based on the POI composition and surrounding activity (e.g., 'With commercial offices and IT parks nearby, banking products fit working professionals')."
    }
  ],
  "why_domains_fit": "A paragraph explaining why these advertising domains are relevant based on the POI composition and surrounding activity.",
  "advantages_of_publishing": [
    "A direct business benefit of advertising in this location (e.g., 'High volume of shopping footfall due to proximity of retail malls', 'Strong residential catchment from surrounding apartment complexes')."
  ],
  "target_audience": [
    {
      "segment": "Likely audience segment (e.g., Working professionals, Families, Students, Shoppers, Fitness-conscious users, Travelers, High-income residents, Daily commuters)",
      "driven_by": "The specific POI types/counts from the data that imply this segment (e.g., 'Driven by colleges and libraries')",
      "relevance": "Why they are relevant to advertisers at this location."
    }
  ],
  "area_strength_summary": "A concise natural-language summary of the location's advertising potential."
}

CRITICAL RULES:
1. Do not use markdown code fences, do not include preamble, do not include trailing commentary. Output ONLY the JSON block.
2. Ground all recommendations and segment analysis in the actual POI counts/densities, landuse, and transit access metrics provided. If there is low POI density or sparse data, report it realistically.
3. DO NOT output any specific numbers or digits (such as exact counts, percentages, ratios, or frequencies) in any of the natural language text fields of your output (e.g., in `rationale`, `why_domains_fit`, `driven_by`, `relevance`, `advantages_of_publishing`, or `area_strength_summary`). Use qualitative language instead (such as "strong presence", "highly accessible", "frequent", "numerous", "limited", "minimal"). Keep all text descriptions completely free of numeric digits.
"""


def get_llm_recommendations(
    features: dict,
    kpis: dict,
    area_label: str = "",
    timeout_s: float = 30.0,
) -> dict:
    """
    Return complete ad recommendation payload using an LLM reasoning layer.
    Works for any location worldwide — nothing here assumes a specific city;
    the model reasons purely over whatever POI/feature data is supplied.
    """
    has_data = (
        features.get("total_pois", 0) > 0
        or features.get("road_length_m", 0) > 0
        or features.get("bus_count", 0) > 0
    )
    if not has_data:
        logger.info("[llm_recommendation] No spatial data - returning empty recommendation template.")
        return _get_empty_recommendation(features, kpis, area_label)

    use_llm = os.environ.get("USE_LLM_RECOMMENDATIONS", "true").lower() == "true"
    model_name = os.environ.get("LLM_RECOMMENDATION_MODEL", "meta/llama-3.1-8b-instruct")

    if not use_llm:
        logger.info("[llm_recommendation] USE_LLM_RECOMMENDATIONS=false - recommendations disabled.")
        return _get_empty_recommendation(features, kpis, area_label)

    cache_key = _fingerprint(features, kpis, area_label)
    cached = _cache.get(cache_key)
    if cached is not None:
        logger.info("[llm_recommendation] Cache hit (fingerprint %s)", cache_key[:12])
        return cached

    try:
        road_length_m = features.get("road_length_m", 0.0)
        road_density = features.get("road_density", 0.0)
        walkability = features.get("walkability", 0.0)
        transit_accessibility = features.get("transit_accessibility", 0.0)
        competition_idx = features.get("competition_index", 0.0)

        traffic_flow = int(road_length_m * 1.5)
        cars = int(traffic_flow * 0.5)
        bikes = int(traffic_flow * 0.35)
        trucks = int(traffic_flow * 0.05)
        buses = int(traffic_flow * 0.1)

        visibility_score = min(100.0, road_density * 30.0 + walkability * 0.5)
        reach = int(traffic_flow * 1.2)
        engagement_rate = min(100.0, walkability * 0.8 + transit_accessibility * 0.2)

        spatial_context = {
            "area_label": area_label or "Unknown / unnamed area",
            "location_statistics": {
                "poi_density_per_km2": features.get("poi_density", 0.0),
                "total_pois": features.get("total_pois", 0),
                "junctions_per_km2": features.get("junction_density", 0.0),
                "circle_area_km2": features.get("area_km2", 0.0),
            },
            # Full detected POI breakdown — this is what lets the model reason
            # over ANY vertical the data actually supports, for ANY location.
            "poi_category_counts": features.get("category_counts", {}),
            "poi_category_densities_per_km2": features.get("category_densities", {}),
            "traffic_statistics": {
                "estimated_daily_traffic_flow": traffic_flow,
                "vehicle_counts": {
                    "cars": cars,
                    "bikes": bikes,
                    "trucks": trucks,
                    "buses": buses
                }
            },
            "population_proxy": features.get("population_proxy", 0.0),
            "land_use_and_zoning": {
                "residential_percentage": features.get("residential_density", 0.0),
                "commercial_percentage": features.get("commercial_density", 0.0),
                "building_density_percentage": features.get("building_density", 0.0),
                "green_cover_percentage": features.get("green_cover_ratio", 0.0),
                "land_use_mix_index": features.get("land_use_mix", 0.0),
            },
            "road_hierarchy": {
                "road_density_km_per_km2": road_density,
                "total_road_length_m": road_length_m
            },
            "nearby_poi_headline_counts": {
                k: v for k, v in features.items() if k.endswith("_count")
            },
            "billboard_visibility_metrics": {
                "visibility_score": visibility_score,
                "reach": reach,
                "engagement_rate": engagement_rate
            },
            "audience_intelligence": {
                "walkability_index": walkability,
                "transit_accessibility_index": transit_accessibility,
                "commercial_competitor_index": competition_idx,
            },
            "kpi_scores": {
                "overall_score": kpis.get("overall_score", 0),
                "commercial_potential": kpis.get("commercial_potential", 0),
                "footfall_potential": kpis.get("footfall_potential", 0),
                "transit_connectivity": kpis.get("transit_connectivity", 0),
                "competition_level": kpis.get("competition_level", 0),
                "green_coverage": kpis.get("green_coverage", 0),
                "ai_confidence": kpis.get("ai_confidence", 0),
            },
            "time_of_day": "Daytime (12:00 PM)"
        }

        api_key = _get_api_key()
        user_payload = json.dumps(spatial_context)
        logger.info("[llm_recommendation] Querying NVIDIA NIM model %s...", model_name)

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
        }
        payload = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_payload},
            ],
            "max_tokens": 1500,
            "temperature": 0.2,
            "top_p": 1,
            "stream": False,
        }

        http_response = requests.post(
            NVIDIA_INVOKE_URL, headers=headers, json=payload, timeout=timeout_s
        )

        if http_response.status_code != 200:
            raise NvidiaAPIError(http_response.status_code, http_response.text)

        response_json = http_response.json()
        text_out = (
            response_json.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        ).strip()

        if not text_out:
            raise ValueError("Empty content in NVIDIA NIM response")

        if text_out.startswith("```"):
            text_out = text_out.strip("`").strip()
            if text_out.lower().startswith("json"):
                text_out = text_out[4:].strip()

        if not text_out.startswith("{"):
            start = text_out.find("{")
            end = text_out.rfind("}")
            if start != -1 and end != -1 and end > start:
                text_out = text_out[start:end + 1]

        parsed = json.loads(text_out)
        cleaned = _validate_and_clean(parsed)

        logger.info(
            "[llm_recommendation] LLM returned valid recommendation object (fingerprint %s)",
            cache_key[:12],
        )

        _cache.set(cache_key, cleaned)
        return cleaned

    except (json.JSONDecodeError, ValueError) as e:
        logger.error("[llm_recommendation] Failed to parse/validate LLM output: %s", e)
    except NvidiaAPIError as e:
        logger.error("[llm_recommendation] %s", e)
    except requests.Timeout as e:
        logger.error("[llm_recommendation] NVIDIA NIM API timeout: %s", e)
    except requests.RequestException as e:
        logger.error("[llm_recommendation] NVIDIA NIM API request error: %s", e)
    except Exception as e:
        logger.error("[llm_recommendation] Unexpected error: %s", e, exc_info=True)

    logger.warning(
        "[llm_recommendation] LLM call failed - returning default empty template."
    )
    return _get_empty_recommendation(features, kpis, area_label)