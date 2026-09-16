import axios from "axios";
import { LocationAnalytics } from "@/types";

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8080";
const TIMEOUT_MS = 30000;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
export const locationService = {
  /**
   * Fetch spatial analytics for a given lat/lng/radius from the FastAPI backend.
   * All data originates from the Supabase/PostGIS database.
   *
   * Throws on any HTTP error (including 503 when the DB is unavailable) so
   * React Query can surface the error state — the caller must NOT fall back
   * to synthetic data.
   */
  analyzeLocation: async (
    latitude: number,
    longitude: number,
    radius: number,
    _billboardId?: string
  ): Promise<LocationAnalytics> => {
    const response = await axios.get(`${API_BASE}/api/location/v1/analyze`, {
      params: { latitude, longitude, radius },
      timeout: TIMEOUT_MS,
    });
    return response.data as LocationAnalytics;
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
    const response = await axios.post(`${API_BASE}/api/v1/recommend`, params, {
      timeout: TIMEOUT_MS,
    });
    return response.data;
  },
};
