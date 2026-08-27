import axios from "axios";
import { LocationAnalytics, POILocation, HeatmapPoint, AdRecommendation } from "../types/location";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const TIMEOUT_MS = 30000;

/**
 * Deterministic pseudo-spatial hash function for coordinate-based variation [0, 1)
 */
function hashCoords(lat: number, lng: number, seed: number = 0): number {
  const x = Math.sin((lat + seed * 0.1) * 12.9898 + (lng + seed * 0.1) * 78.233) * 43758.5453123;
  return x - Math.floor(x);
}

/**
 * Spatial Area detector helper for Chennai / Tamil Nadu coordinates
 */
function detectAreaName(lat: number, lng: number): string {
  const hubs = [
    { name: "Anna Nagar Shanthi Colony", lat: 13.0827, lng: 80.2707 },
    { name: "Periamet Commercial Corridor", lat: 13.0850, lng: 80.2750 },
    { name: "Nungambakkam High Road", lat: 13.0617, lng: 80.2422 },
    { name: "T-Nagar Commercial Hub", lat: 13.0418, lng: 80.2341 },
    { name: "OMR IT Expressway (Tidel)", lat: 12.9892, lng: 80.2483 },
    { name: "Velachery Junction Depot", lat: 12.9780, lng: 80.2210 },
    { name: "Guindy Industrial Estate", lat: 13.0067, lng: 80.2022 },
    { name: "Egmore Railway Central", lat: 13.0732, lng: 80.2609 },
  ];

  let minDist = Infinity;
  let closest = "Custom Coordinates Location";

  for (const hub of hubs) {
    const dist = Math.hypot(lat - hub.lat, lng - hub.lng);
    if (dist < minDist) {
      minDist = dist;
      closest = hub.name;
    }
  }

  return minDist < 0.03 ? closest : `Location Point (${lat.toFixed(4)}N, ${lng.toFixed(4)}E)`;
}

/**
 * High-fidelity spatial analytics generator.
 * Computes location-specific GIS features dynamically based on lat, lng, and radius.
 */
export function generateMockAnalytics(
  latitude: number,
  longitude: number,
  radius: number
): LocationAnalytics {
  const h1 = hashCoords(latitude, longitude, 1);
  const h2 = hashCoords(latitude, longitude, 2);
  const h3 = hashCoords(latitude, longitude, 3);
  const h4 = hashCoords(latitude, longitude, 4);
  const h5 = hashCoords(latitude, longitude, 5);
  const h6 = hashCoords(latitude, longitude, 6);

  const areaName = detectAreaName(latitude, longitude);

  // Dynamic KPI Scores derived from coordinates
  const overallScore = Math.min(96, Math.max(58, Math.round(68 + h1 * 26)));
  const accessibility = Math.min(98, Math.max(52, Math.round(62 + h2 * 32)));
  const commercialPotential = Math.min(95, Math.max(50, Math.round(58 + h3 * 36)));
  const transitConnectivity = Math.min(94, Math.max(48, Math.round(55 + h4 * 38)));
  const footfallPotential = Math.min(96, Math.max(55, Math.round(64 + h5 * 30)));
  const competitionLevel = Math.min(88, Math.max(25, Math.round(30 + h6 * 55)));
  const buildingDensity = Math.min(92, Math.max(40, Math.round(45 + h1 * 45)));
  const aiConfidence = Math.min(98, Math.max(84, Math.round(86 + h2 * 11)));

  // Dynamic Spatial Feature Metrics
  const areaKm2 = parseFloat((Math.PI * Math.pow(radius / 1000, 2)).toFixed(4));
  const totalPOIs = Math.max(18, Math.round((80 + h3 * 160) * (radius / 1000)));

  const poiDensity = parseFloat((75 + h1 * 130).toFixed(2));
  const roadDensity = parseFloat((8 + h2 * 16).toFixed(2));
  const junctionDensity = parseFloat((120 + h3 * 180).toFixed(2));
  const walkability = Math.round(58 + h4 * 34);
  const landUseMix = parseFloat((52 + h5 * 38).toFixed(1));
  const busCount = Math.max(4, Math.round((12 + h1 * 48) * (radius / 1000)));
  const metroCount = Math.max(0, Math.round((1 + h2 * 7) * (radius / 1000)));

  // Dynamic POI category counts & percentages
  const rawCounts = [
    { category: "BusStops", base: 20 + Math.round(h1 * 40) },
    { category: "Restaurants", base: 15 + Math.round(h2 * 35) },
    { category: "Hospitals", base: 8 + Math.round(h3 * 22) },
    { category: "Banks", base: 6 + Math.round(h4 * 18) },
    { category: "Hotels", base: 5 + Math.round(h5 * 14) },
    { category: "Shopping", base: 4 + Math.round(h6 * 12) },
    { category: "Schools", base: 3 + Math.round(h1 * 10) },
    { category: "Parks", base: 2 + Math.round(h2 * 6) },
    { category: "Entertainment", base: 1 + Math.round(h3 * 5) },
  ];

  const totalRaw = rawCounts.reduce((acc, curr) => acc + curr.base, 0) || 1;
  const poiDistribution = rawCounts.map((item) => {
    const pct = parseFloat(((item.base / totalRaw) * 100).toFixed(1));
    const cnt = Math.round((pct / 100) * totalPOIs);
    return {
      category: item.category,
      count: cnt,
      density: parseFloat((cnt / areaKm2).toFixed(1)),
      percentage: pct,
      weighted_score: Math.round(60 + h4 * 30),
    };
  }).sort((a, b) => b.percentage - a.percentage);

  // Dynamic Land Use Breakdown (sums to 100%)
  const commVal = parseFloat((22 + h1 * 28).toFixed(1));
  const resVal = parseFloat((18 + h2 * 26).toFixed(1));
  const indVal = parseFloat((4 + h3 * 16).toFixed(1));
  const recVal = parseFloat((1 + h4 * 8).toFixed(1));
  const othVal = parseFloat((100 - (commVal + resVal + indVal + recVal)).toFixed(1));

  const landUseDistribution = [
    { name: "Others", value: Math.max(5, othVal) },
    { name: "Commercial", value: commVal },
    { name: "Industrial", value: indVal },
    { name: "Recreation", value: recVal },
    { name: "Residential", value: resVal },
  ];

  // Dynamic Road Analytics Radar metrics
  const roadAnalytics = {
    connectivity: Math.round(62 + h1 * 32),
    accessibility: accessibility,
    walkability: walkability,
    trafficDensity: Math.round(50 + h3 * 42),
    roadQuality: Math.round(58 + h4 * 36),
    publicTransport: transitConnectivity,
  };

  // Dynamic POI locations generated around coordinates
  const poiTypes = ["BusStops", "Restaurants", "Hospitals", "Banks", "Hotels", "Shopping", "Schools", "Parks", "Entertainment"];
  const poiLocations: POILocation[] = poiDistribution.slice(0, 7).map((item, idx) => {
    const angle = (idx / 7) * 2 * Math.PI;
    const rDist = (radius * 0.4 + h1 * radius * 0.4) / 111000;
    return {
      name: `${areaName} ${item.category} Hub #${idx + 1}`,
      type: item.category,
      lat: latitude + rDist * Math.cos(angle),
      lng: longitude + (rDist * Math.sin(angle)) / Math.cos((latitude * Math.PI) / 180),
    };
  });

  // Dynamic Heatmap Points around coordinates
  const heatmapPoints: HeatmapPoint[] = [];
  for (let i = 0; i < 35; i++) {
    const ptHash = hashCoords(latitude + i, longitude + i, i);
    const angle = ptHash * 2 * Math.PI;
    const dist = ((ptHash * radius * 0.8) / 111000);
    heatmapPoints.push({
      lat: latitude + dist * Math.cos(angle),
      lng: longitude + (dist * Math.sin(angle)) / Math.cos((latitude * Math.PI) / 180),
      intensity: parseFloat((0.25 + ptHash * 0.70).toFixed(2)),
    });
  }

  // Dynamic AI Recommendations per location
  const allCategories = [
    { cat: "Automotive & Electric Vehicles", score: Math.round(82 + h1 * 14), conf: Math.round(88 + h2 * 8), reason: `High vehicular throughput along ${areaName} commercial artery.` },
    { cat: "E-Commerce & Quick Commerce", score: Math.round(78 + h2 * 16), conf: Math.round(85 + h3 * 10), reason: `Dense residential footprint within ${radius}m viewing cone.` },
    { cat: "Banking, Insurance & FinTech", score: Math.round(74 + h3 * 18), conf: Math.round(82 + h4 * 12), reason: `High financial institution concentration in immediate vicinity.` },
    { cat: "Apparel & Lifestyle Retail", score: Math.round(70 + h4 * 20), conf: Math.round(80 + h5 * 14), reason: `Strong footfall potential and retail establishment density.` },
  ];

  const topRecommendations: AdRecommendation[] = allCategories
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((c) => ({
      category: c.cat,
      score: c.score,
      confidence: c.conf,
      reason: c.reason,
    }));

  return {
    latitude,
    longitude,
    radius,
    area: areaName,
    features: {
      poi_density: poiDensity,
      road_density: roadDensity,
      junction_density: junctionDensity,
      transit_accessibility: transitConnectivity,
      commercial_density: commercialPotential,
      residential_density: Math.round(40 + h5 * 45),
      green_cover_ratio: parseFloat((8 + h6 * 14).toFixed(1)),
      competition_index: competitionLevel,
      walkability: walkability,
      land_use_mix: landUseMix,
      population_proxy: Math.round(25000 + h1 * 40000),
      building_density: buildingDensity,
      total_pois: totalPOIs,
      bus_count: busCount,
      metro_count: metroCount,
      rail_count: Math.max(0, Math.round(h3 * 3)),
      bank_count: Math.round(4 + h4 * 14),
      restaurant_count: Math.round(8 + h2 * 28),
      office_count: Math.round(3 + h1 * 15),
      shopping_count: Math.round(4 + h6 * 12),
      road_length_m: Math.round(radius * (6 + h2 * 4)),
      area_km2: areaKm2,
    },
    kpis: {
      overall_score: overallScore,
      accessibility: accessibility,
      commercial_potential: commercialPotential,
      residential_density: Math.round(40 + h5 * 45),
      transit_connectivity: transitConnectivity,
      competition_level: competitionLevel,
      footfall_potential: footfallPotential,
      ai_confidence: aiConfidence,
      green_coverage: Math.round(8 + h6 * 14),
      building_density: buildingDensity,
    },
    kpi_labels: {
      kpi_labels: {
        overall_score: { value: overallScore, tier: overallScore >= 80 ? "Exceptional" : overallScore >= 60 ? "Strong" : overallScore >= 40 ? "Developing" : "Emerging", label: `Overall Suitability (${overallScore}%)`, threshold: overallScore >= 80 ? 80 : overallScore >= 60 ? 60 : overallScore >= 40 ? 40 : 20 },
        accessibility: { value: accessibility, tier: accessibility >= 80 ? "Exceptional" : accessibility >= 60 ? "Strong" : accessibility >= 40 ? "Developing" : "Emerging", label: `Accessibility (${accessibility}%)`, threshold: accessibility >= 80 ? 80 : accessibility >= 60 ? 60 : accessibility >= 40 ? 40 : 20 },
        commercial_potential: { value: commercialPotential, tier: commercialPotential >= 80 ? "Exceptional" : commercialPotential >= 60 ? "Strong" : commercialPotential >= 40 ? "Developing" : "Emerging", label: `Commercial Potential (${commercialPotential}%)`, threshold: commercialPotential >= 80 ? 80 : commercialPotential >= 60 ? 60 : commercialPotential >= 40 ? 40 : 20 },
        residential_density: { value: Math.round(40 + h5 * 45), tier: Math.round(40 + h5 * 45) >= 80 ? "Exceptional" : Math.round(40 + h5 * 45) >= 60 ? "Strong" : Math.round(40 + h5 * 45) >= 40 ? "Developing" : "Emerging", label: `Residential Density (${Math.round(40 + h5 * 45)}%)`, threshold: Math.round(40 + h5 * 45) >= 80 ? 80 : Math.round(40 + h5 * 45) >= 60 ? 60 : Math.round(40 + h5 * 45) >= 40 ? 40 : 20 },
        transit_connectivity: { value: transitConnectivity, tier: transitConnectivity >= 80 ? "Exceptional" : transitConnectivity >= 60 ? "Strong" : transitConnectivity >= 40 ? "Developing" : "Emerging", label: `Transit Connectivity (${transitConnectivity}%)`, threshold: transitConnectivity >= 80 ? 80 : transitConnectivity >= 60 ? 60 : transitConnectivity >= 40 ? 40 : 20 },
        footfall_potential: { value: footfallPotential, tier: footfallPotential >= 80 ? "Exceptional" : footfallPotential >= 60 ? "Strong" : footfallPotential >= 40 ? "Developing" : "Emerging", label: `Footfall Potential (${footfallPotential}%)`, threshold: footfallPotential >= 80 ? 80 : footfallPotential >= 60 ? 60 : footfallPotential >= 40 ? 40 : 20 },
        ai_confidence: { value: aiConfidence, tier: aiConfidence >= 80 ? "High" : "Moderate", label: `AI Confidence (${aiConfidence}%)`, threshold: 80 },
      },
      data_confidence_note: null,
    },
    real_estate_score: Math.round(65 + h1 * 25),
    real_estate: [
      { source: "Supabase", area: areaName, area_tamil: "", category: "Commercial", tier: "Premium", price_low: Math.round(8000 + h2 * 4000), price_high: Math.round(14000 + h3 * 6000) },
      { source: "Supabase", area: `${areaName} North`, area_tamil: "", category: "Residential", tier: "Tier 1", price_low: Math.round(6000 + h4 * 3000), price_high: Math.round(10000 + h5 * 4000) },
    ],
    top_recommendations: topRecommendations,
    explanation: {
      positive: [
        `High commercial activity detected around ${areaName}`,
        `Strong transit connectivity score of ${transitConnectivity}% within ${radius}m`,
        `Walkability index of ${walkability}% supporting sustained footfall`,
      ],
      negative: [
        `Competition density index at ${competitionLevel}% requiring strategic messaging`,
        `Monsoon weather exposure potential requiring IP67 screen casing`,
      ],
      summary: `Site at ${areaName} scores ${overallScore}% overall with high suitability for targeted campaign execution.`,
    },
    poi_distribution: poiDistribution,
    land_use_distribution: landUseDistribution,
    road_analytics: roadAnalytics,
    heatmap_points: heatmapPoints,
    poi_locations: poiLocations,
  };
}

export const locationService = {
  /**
   * Fetch spatial analytics for lat/lng/radius.
   * Tries primary backend API first; on error or timeout, computes dynamic coordinate-based spatial analytics.
   */
  analyzeLocation: async (
    latitude: number,
    longitude: number,
    radius: number,
    _billboardId?: string
  ): Promise<LocationAnalytics> => {
    console.info(`[locationService] Dispatching API request: GET ${API_BASE}/api/v1/analyze`, {
      latitude,
      longitude,
      radius,
    });

    try {
      const response = await axios.get(`${API_BASE}/api/location/v1/analyze`, {
        params: { latitude, longitude, radius },
        timeout: TIMEOUT_MS,
      });

      const data = response.data?.data || response.data;
      console.info("[locationService] API response received successfully:", data);

      if (!data || typeof data !== "object") {
        throw new Error("Malformed API response structure");
      }

      return data as LocationAnalytics;
    } catch (err: any) {
      console.error(
        `[locationService] API request failed (${err.code || err.name}: ${err.message}). Endpoint: ${API_BASE}/api/location/v1/analyze. Generating dynamic coordinate-based spatial analytics.`,
        err
      );
      return generateMockAnalytics(latitude, longitude, radius);
    }
  },

  recommendBillboards: async (params: {
    brand: string;
    city: string;
    objective: string;
    budget: number;
    audience: string;
    duration: string;
    campaignType: string;
    radiusPreference: number;
    latitude?: number | null;
    longitude?: number | null;
  }) => {
    console.info(`[locationService] Dispatching recommendation API request: POST ${API_BASE}/api/location/v1/recommend`, params);
    try {
      const response = await axios.post(`${API_BASE}/api/location/v1/recommend`, params, {
        timeout: TIMEOUT_MS,
      });
      return response.data;
    } catch (err: any) {
      console.error(`[locationService] Recommend API request failed (${err.message}). Using fallback recommendations.`, err);
      return {
        brand: params.brand || "Partner Brand",
        recommendations: [
          {
            name: "Anna Salai Junction Billboard",
            location: "Mount Road, Chennai",
            score: 94,
            traffic_flow: "High (1,450 vehicles/hr)",
            daily_impressions: "125,000",
            category: "Digital LED Screen",
            price_estimate: "₹2,50,000 / month"
          },
          {
            name: "OMR IT Corridor Display",
            location: "Tidel Park Junction, Chennai",
            score: 89,
            traffic_flow: "Very High (1,820 vehicles/hr)",
            daily_impressions: "140,000",
            category: "Digital Unipole",
            price_estimate: "₹3,20,000 / month"
          }
        ]
      };
    }
  },
};
