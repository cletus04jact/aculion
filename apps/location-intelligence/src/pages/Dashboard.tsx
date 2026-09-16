import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { locationService } from "@/services/location.service";
import { LocationAnalytics, Billboard } from "@/types";
import { billboardService } from "@/services/billboard.service";
import Header from "@/components/layout/Header";
import KPICardsGrid from "@/components/cards/KPICardsGrid";
import POIDistributionChart from "@/components/charts/POIDistributionChart";
import LandUseChart from "@/components/charts/LandUseChart";
import RoadAnalyticsList from "@/components/charts/RoadAnalyticsList";
import RealEstateChart from "@/components/charts/RealEstateChart";
import LocationMap from "@/components/maps/LocationMap";
import AIRecommendationSidebar from "@/components/layout/AIRecommendationSidebar";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileDown, Share2, Bookmark, Bot, RefreshCw,
  Layers, MapPin, HelpCircle, FileSpreadsheet, X, Navigation
} from "lucide-react";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const isCustomId = true;

  // ── UI State ──
  const [isMapPickingActive, setIsMapPickingActive] = useState(true);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [aiReportGenerating, setAiReportGenerating] = useState(false);
  const [aiReportContent, setAiReportContent] = useState("");
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [gpsLoadingStage, setGpsLoadingStage] = useState("");
  const [gpsError, setGpsError] = useState<string | null>(null);

  // ── Candidate coordinate ──
  const [candidateLat, setCandidateLat] = useState(13.0827);
  const [candidateLng, setCandidateLng] = useState(80.2707);

  // ── Query parameters ──
  const [latitude, setLatitude] = useState(13.0827);
  const [longitude, setLongitude] = useState(80.2707);
  const [radius, setRadius] = useState(1000);

  // ── Analytics query — refetches whenever latitude/longitude/radius changes ──
  const {
    data: analytics,
    isLoading: isAnalyticsLoading,
    refetch: refetchAnalytics,
    isRefetching: isAnalyticsRefetching,
  } = useQuery<LocationAnalytics>({
    queryKey: ["analytics", latitude, longitude, radius],
    queryFn: () => locationService.analyzeLocation(latitude, longitude, radius, undefined),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // ── Fetch all registered billboards ──
  const {
    data: billboards = [],
  } = useQuery<Billboard[]>({
    queryKey: ["billboards"],
    queryFn: billboardService.getBillboards,
    staleTime: 5 * 60 * 1000,
  });

  // Sync selected billboard by URL param ID
  useEffect(() => {
    if (id && billboards.length > 0) {
      const selected = billboards.find(b => b.id === id);
      if (selected) {
        handleAnalyze(selected.latitude, selected.longitude, radius);
      }
    }
  }, [id, billboards, radius]);



  // ── Analyze button handler (commits candidate → query coords) ──
  const handleAnalyze = (lat: number, lng: number, rad: number) => {
    setLatitude(lat);
    setLongitude(lng);
    setRadius(rad);
    setCandidateLat(lat);
    setCandidateLng(lng);
  };

  // ── Map click → candidate only (NO auto-fetch) ──
  const handleLocationPicked = (lat: number, lng: number) => {
    setCandidateLat(lat);
    setCandidateLng(lng);
  };

  const handleRefresh = () => refetchAnalytics();

  // ── Listen for chatbot analyze actions ──
  useEffect(() => {
    const handleChatAnalyzeSite = (e: any) => {
      const { latitude: lat, longitude: lng } = e.detail;
      handleAnalyze(lat, lng, radius);
    };
    window.addEventListener("chat-analyze-site", handleChatAnalyzeSite);
    return () => {
      window.removeEventListener("chat-analyze-site", handleChatAnalyzeSite);
    };
  }, [radius]);

  const triggerAiReport = (customAnalytics?: LocationAnalytics, customLat?: number, customLng?: number) => {
    const data = customAnalytics || analytics;
    if (!data) return;
    const reportLat = customLat !== undefined ? customLat : latitude;
    const reportLng = customLng !== undefined ? customLng : longitude;

    setActiveModal("ai");
    setAiReportGenerating(true);
    setAiReportContent("");
    setTimeout(() => {
      const top = data.top_recommendations || [];
      const k = data.kpis || { overall_score: 0, commercial_potential: 0, transit_connectivity: 0 };
      const f = data.features || { poi_density: 0, walkability: 0, transit_accessibility: 0, commercial_density: 0, competition_index: 0, total_pois: 0, area_km2: 0 };
      const noData = top.length === 0 && k.overall_score === 0;
      const summaryNote = data.explanation?.summary
        ? `\n> ⚠️ ${data.explanation.summary}\n`
        : "";
      setAiReportGenerating(false);
      setAiReportContent(
        `### Location Intelligence Assessment Report\n` +
        `**Analysis Point**: Lat ${reportLat.toFixed(5)}, Lng ${reportLng.toFixed(5)} | Radius: ${radius}m\n` +
        `**Mode**: Custom Coordinates Evaluation\n` +
        summaryNote +
        `\n#### Overall Suitability: ${k.overall_score}/100\n` +
        (noData
          ? `No spatial data was found within the selected radius. All KPI values are 0. Please select a location with GIS data in the database.\n`
          : `This site scores ${k.overall_score}% overall — driven by ${k.commercial_potential}% commercial potential and ${k.transit_connectivity}% transit connectivity.\n`) +
        `\n#### Top Recommended Ad Categories\n` +
        (top.length > 0
          ? top.map((r, i) => `${i + 1}. **${r.category}** (Score: ${r.score}, Confidence: ${r.confidence}%)\n   → ${r.reason}`).join("\n")
          : "_No recommendations — insufficient spatial data at this location._") +
        `\n\n#### Key Feature Metrics\n` +
        `- POI Density: ${f.poi_density}/km² within ${radius}m radius\n` +
        `- Walkability Index: ${f.walkability}%\n` +
        `- Transit Accessibility: ${f.transit_accessibility}\n` +
        `- Commercial Density: ${f.commercial_density}%\n` +
        `- Competition Index: ${f.competition_index}\n\n` +
        (data.explanation?.positive && data.explanation.positive.length > 0
          ? `#### Positive Signals\n` + data.explanation.positive.map((p) => `✓ ${p}`).join("\n")
          : "") +
        (data.explanation?.negative && data.explanation.negative.length > 0
          ? `\n\n#### Risk Factors\n` + data.explanation.negative.map((n) => `✗ ${n}`).join("\n")
          : "")
      );
    }, 1800);
  };

  const handleAnalyzeCurrentLocation = async () => {
    setIsGpsLoading(true);
    setGpsError(null);
    setGpsLoadingStage("Locating...");

    const getGpsCoordinates = (): Promise<{ lat: number; lng: number }> => {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation is not supported by your browser."));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          },
          (error) => {
            let msg = "GPS access denied or unavailable.";
            if (error.code === error.PERMISSION_DENIED) {
              msg = "GPS permission denied.";
            } else if (error.code === error.POSITION_UNAVAILABLE) {
              msg = "GPS position unavailable.";
            } else if (error.code === error.TIMEOUT) {
              msg = "GPS request timed out.";
            }
            reject(new Error(msg));
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      });
    };

    let targetLat = candidateLat;
    let targetLng = candidateLng;

    try {
      const coords = await getGpsCoordinates();
      targetLat = coords.lat;
      targetLng = coords.lng;
    } catch (err: any) {
      console.warn("GPS lookup failed. Using selected map location.", err.message);
      // We gracefully continue with the current candidate coordinates.
    }

    setGpsLoadingStage("Analyzing...");
    try {
      const data = await locationService.analyzeLocation(targetLat, targetLng, radius);
      
      setLatitude(targetLat);
      setLongitude(targetLng);
      setCandidateLat(targetLat);
      setCandidateLng(targetLng);

      queryClient.setQueryData(["analytics", targetLat, targetLng, radius], data);

      triggerAiReport(data, targetLat, targetLng);
    } catch (err: any) {
      console.error(err);
      const detail = err.response?.data?.detail || err.message || "Location intelligence analysis failed.";
      setGpsError(detail);
    } finally {
      setIsGpsLoading(false);
      setGpsLoadingStage("");
    }
  };

  // ── Skeleton loader ──
  if (isAnalyticsLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-background text-foreground w-full">
        <div className="flex-1 flex flex-col">
          <Header
            latitude={candidateLat} longitude={candidateLng} radius={radius}
            onAnalyze={handleAnalyze}
            isMapPickingActive={isMapPickingActive}
            setIsMapPickingActive={setIsMapPickingActive}
            area={(analytics as any)?.area}
            onMenuClick={() => window.dispatchEvent(new CustomEvent("open-sidebar"))}
          />
          <div className="flex-1 p-6 space-y-5 animate-pulse">
            <div className="grid grid-cols-7 gap-3">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="h-[118px] bg-card/40 border border-border/60 rounded-2xl" />
              ))}
            </div>
            <div className="grid grid-cols-10 gap-5">
              <div className="col-span-7 h-[520px] bg-card/40 border border-border/60 rounded-2xl" />
              <div className="col-span-3 h-[520px] bg-card/40 border border-border/60 rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex h-screen bg-background text-foreground items-center justify-center">
        <div className="text-center space-y-3">
          <HelpCircle className="h-10 w-10 text-rose-400 mx-auto" />
          <h3 className="text-sm font-bold">Analytics Unavailable</h3>
          <p className="text-xs text-muted-foreground max-w-xs">
            Could not load spatial analytics. Check that the FastAPI server is running.
          </p>
          <button onClick={() => refetchAnalytics()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground w-full flex-col">
      <Header
        latitude={candidateLat}
        longitude={candidateLng}
        radius={radius}
        onAnalyze={handleAnalyze}
        isMapPickingActive={isMapPickingActive}
        setIsMapPickingActive={setIsMapPickingActive}
        area={analytics?.area}
        onMenuClick={() => window.dispatchEvent(new CustomEvent("open-sidebar"))}
      />

      <div className="flex-1 overflow-y-auto min-h-0 w-full">
        <div className="flex flex-col xl:flex-row min-h-full w-full">
          {/* ── Main Single Dashboard Column ── */}
          <main className="flex-1 p-5 space-y-5 max-w-[1600px] mx-auto w-full">
            {/* 1. KPI Cards — 8 dynamic cards */}
            <KPICardsGrid analytics={analytics} />

            {/* 2. Map + Asset Summary */}
            <div className="grid grid-cols-10 gap-5">
              {/* Map (7/10) */}
              <div className="col-span-10 lg:col-span-7">
                <LocationMap
                  latitude={latitude}
                  longitude={longitude}
                  radius={radius}
                  poiLocations={analytics.poi_locations}
                  heatmapPoints={analytics.heatmap_points}
                  isMapPickingActive={isMapPickingActive}
                  onLocationPicked={handleLocationPicked}
                  selectedLat={candidateLat}
                  selectedLng={candidateLng}
                  billboards={billboards}
                  onAnalyzeSite={(lat, lng) => handleAnalyze(lat, lng, radius)}
                />
              </div>

              {/* Asset Summary (3/10) */}
              <div className="col-span-10 lg:col-span-3">
                <div
                  style={{ backgroundColor: "#0050fc" }}
                  className="p-5 rounded-2xl border border-white/10 flex flex-col h-[520px] text-foreground"
                >
                  <div className="space-y-4 flex-1">
                    <div className="border-b border-white/10 pb-3">
                      <span className="text-[9px] font-extrabold uppercase tracking-widest text-white-300/70 block">Selected Asset</span>
                      <h2 className="text-sm font-extrabold text-white mt-0.5 truncate">
                        {analytics?.area || "Custom Coordinates"}
                      </h2>
                      <span className="text-[9px] font-mono text-blue-200/50">
                        ID: CUSTOM
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2.5 text-xs">
                        <MapPin size={13} className="text-blue-300 shrink-0" />
                        <div>
                          <span className="text-[8px] font-bold text-blue-200/60 uppercase block">Candidate Coords</span>
                          <span className="font-mono text-white font-semibold text-[11px]">
                            {candidateLat.toFixed(5)}N, {candidateLng.toFixed(5)}E
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 text-xs">
                        <Layers size={13} className="text-blue-300 shrink-0" />
                        <div>
                          <span className="text-[8px] font-bold text-blue-200/60 uppercase block">Analysis Radius</span>
                          <span className="font-mono text-white font-semibold">{radius}m</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 p-3 rounded-xl text-[10px]">
                      <span className="text-[8px] font-extrabold uppercase text-blue-200/60 block mb-1">Executive Notes</span>
                      <p className="text-blue-100/80 leading-relaxed">
                        Custom evaluation mode. Click any location on the map and press Analyze to compute spatial features for that point.
                      </p>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={handleAnalyzeCurrentLocation}
                        disabled={isGpsLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-blue-600 hover:bg-white/95 disabled:bg-white/50 active:scale-95 transition-all duration-150 rounded-xl text-[11px] font-black uppercase tracking-wider shadow-md shadow-white/5 disabled:opacity-50"
                      >
                        {isGpsLoading ? (
                          <>
                            <RefreshCw size={12} className="animate-spin shrink-0" />
                            <span>{gpsLoadingStage}</span>
                          </>
                        ) : (
                          <>
                            <Navigation size={12} className="fill-current shrink-0" />
                            <span>Analyze Current Location</span>
                          </>
                        )}
                      </button>
                      {gpsError && (
                        <p className="text-[10px] text-rose-300 font-bold text-center mt-1.5 leading-snug animate-pulse">
                          ⚠️ {gpsError}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Analysis status row */}
                  <div className="bg-white/5 border border-white/10 p-3 rounded-xl text-[10px] flex items-center justify-between mt-3">
                    <div>
                      <span className="text-[8px] font-bold text-blue-200/60 block">DATA SOURCE</span>
                      <span className="text-[10px] text-emerald-400 font-extrabold">SPATIAL DB</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] font-bold text-blue-200/60 block">STATUS</span>
                      <span className={`text-[10px] font-extrabold ${isAnalyticsRefetching ? "text-amber-400 animate-pulse" : "text-emerald-400"}`}>
                        {isAnalyticsRefetching ? "REFRESHING..." : "LIVE ANALYSIS"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Analytics Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="glassmorphism p-5 rounded-2xl border border-border space-y-3">
                <div>
                  <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">POI Category Density</h3>
                  <p className="text-[9px] text-muted-foreground mt-0.5">
                    {analytics.features.total_pois} POIs within {radius}m · {analytics.features.area_km2} km² area
                  </p>
                </div>
                <POIDistributionChart data={analytics.poi_distribution} />
              </div>

              {/* Land Use */}
              <div className="glassmorphism p-5 rounded-2xl border border-border space-y-3">
                <div>
                  <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Zoning & Land Use</h3>
                  <p className="text-[9px] text-muted-foreground mt-0.5">
                    Land use mix entropy: {analytics.features.land_use_mix}%
                  </p>
                </div>
                <LandUseChart data={analytics.land_use_distribution} />
              </div>

              {/* Road Radar */}
              <div className={`glassmorphism p-5 rounded-2xl border border-border space-y-3 ${
                !(analytics.real_estate && analytics.real_estate.length > 0) ? "lg:col-span-2" : ""
              }`}>
                <div>
                  <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Road & Transit Infrastructure</h3>
                  <p className="text-[9px] text-muted-foreground mt-0.5">
                    Road network: {(analytics.features.road_length_m / 1000).toFixed(1)} km · Junctions: {analytics.features.junction_density}/km²
                  </p>
                </div>
                <RoadAnalyticsList data={analytics.road_analytics} />
              </div>

              {/* Real Estate price ranges */}
              {analytics.real_estate && analytics.real_estate.length > 0 && (
                <div className="glassmorphism p-5 rounded-2xl border border-border space-y-3">
                  <div>
                    <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Real Estate Prices</h3>
                    <p className="text-[9px] text-muted-foreground mt-0.5">
                      Property values in ₹ per sq.ft. for query surroundings
                    </p>
                  </div>
                  <RealEstateChart data={analytics.real_estate} />
                </div>
              )}
            </div>


            {/* 4. Feature Insights + Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Feature Explorer */}
              <div className="glassmorphism p-5 rounded-2xl border border-border space-y-4">
                <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Feature Explorer</h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: "POI Density", value: `${analytics.features.poi_density}/km²`, color: "text-blue-400" },
                    { label: "Road Density", value: `${analytics.features.road_density} km/km²`, color: "text-cyan-400" },
                    { label: "Transit Score", value: `${analytics.features.transit_accessibility}`, color: "text-violet-400" },
                    { label: "Walkability", value: `${analytics.features.walkability}%`, color: "text-emerald-400" },
                    { label: "Commercial Mix", value: `${analytics.features.commercial_density}%`, color: "text-amber-400" },
                    { label: "Land Use Mix", value: `${analytics.features.land_use_mix}%`, color: "text-orange-400" },
                    { label: "Building Density", value: `${analytics.features.building_density}%`, color: "text-sky-400" },
                    { label: "Bus Stops", value: `${analytics.features.bus_count}`, color: "text-indigo-400" },
                    { label: "Rail Stations", value: `${analytics.features.rail_count}`, color: "text-purple-400" },
                  ].map((item) => (
                    <div key={item.label} className="bg-background/40 border border-border/50 rounded-xl p-2.5">
                      <span className="text-[8px] font-bold text-muted-foreground uppercase block">{item.label}</span>
                      <span className={`text-sm font-black font-mono ${item.color}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Operations */}
              <div className="glassmorphism p-5 rounded-2xl border border-border space-y-4">
                <div>
                  <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Quick Operations</h3>
                  <p className="text-[9px] text-muted-foreground mt-0.5">Export, share, or generate AI synthesis reports.</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Export CSV", icon: FileSpreadsheet, color: "text-emerald-400", action: () => setActiveModal("export") },
                    { label: "Print PDF", icon: FileDown, color: "text-rose-400", action: () => window.print() },
                    { label: "Share URL", icon: Share2, color: "text-blue-400", action: () => setActiveModal("share") },
                    { label: "Bookmark", icon: Bookmark, color: "text-amber-400", action: () => setActiveModal("save") },
                    { label: "AI Synthesis", icon: Bot, color: "text-blue-500", action: () => triggerAiReport() },
                    { label: "Refresh", icon: RefreshCw, color: "text-teal-400", action: handleRefresh, spin: isAnalyticsRefetching },
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      onClick={btn.action}
                      disabled={isAnalyticsRefetching && btn.label === "Refresh"}
                      className="flex flex-col items-center justify-center p-3 border border-border bg-background/50 hover:bg-secondary rounded-xl gap-2 group transition-all duration-200 disabled:opacity-50"
                    >
                      <btn.icon className={`h-5 w-5 ${btn.color} group-hover:scale-110 transition-transform ${(btn as any).spin ? "animate-spin" : ""}`} />
                      <span className="text-[11px] font-bold">{btn.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </main>

          {/* ── Right AI Recommendation Sidebar ── */}
          <AIRecommendationSidebar analytics={analytics} />
        </div>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setActiveModal(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            <motion.div
              initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
              className="relative bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl text-foreground text-xs"
            >
              <button onClick={() => setActiveModal(null)}
                className="absolute top-4 right-4 p-1 rounded-lg border border-border hover:bg-secondary text-muted-foreground">
                <X size={14} />
              </button>

              {activeModal === "export" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <FileSpreadsheet size={18} />
                    <h3 className="text-sm font-extrabold uppercase tracking-wider">Export Analysis</h3>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Export spatial analytics for <span className="font-semibold text-foreground">Custom Coordinates</span> as CSV.
                  </p>
                  <div className="flex justify-end gap-3">
                    <button onClick={() => setActiveModal(null)} className="px-3.5 py-1.5 border border-border hover:bg-secondary rounded-lg font-bold">Cancel</button>
                    <button onClick={() => { setActiveModal(null); alert("CSV export triggered!"); }}
                      className="px-4 py-1.5 bg-emerald-500 hover:opacity-90 text-zinc-950 font-extrabold rounded-lg">Download</button>
                  </div>
                </div>
              )}

              {activeModal === "share" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-blue-400">
                    <Share2 size={18} />
                    <h3 className="text-sm font-extrabold uppercase tracking-wider">Share Analysis Link</h3>
                  </div>
                  <div className="bg-background/70 border border-border p-2.5 rounded-xl font-mono text-[10px] text-primary select-all break-all">
                    {typeof window !== "undefined" ? window.location.href : ""}
                  </div>
                  <div className="flex justify-end">
                    <button onClick={() => { navigator.clipboard?.writeText(window.location.href); setActiveModal(null); }}
                      className="px-4 py-1.5 bg-primary text-primary-foreground font-extrabold rounded-lg">Copy Link</button>
                  </div>
                </div>
              )}

              {activeModal === "save" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-amber-400">
                    <Bookmark size={18} />
                    <h3 className="text-sm font-extrabold uppercase tracking-wider">Bookmark Location</h3>
                  </div>
                  <p className="text-muted-foreground text-[11px]">Bookmark this analysis profile for future reference.</p>
                  <div className="flex justify-end gap-3">
                    <button onClick={() => setActiveModal(null)} className="px-3.5 py-1.5 border border-border hover:bg-secondary rounded-lg font-bold">Cancel</button>
                    <button onClick={() => { setActiveModal(null); alert("Bookmarked!"); }}
                      className="px-4 py-1.5 bg-amber-500 text-zinc-950 font-extrabold rounded-lg">Confirm</button>
                  </div>
                </div>
              )}

              {activeModal === "ai" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-blue-500">
                    <Bot size={18} className={aiReportGenerating ? "animate-spin" : ""} />
                    <h3 className="text-sm font-extrabold uppercase tracking-wider">AI Synthesis Report</h3>
                  </div>
                  {aiReportGenerating ? (
                    <div className="py-8 flex flex-col items-center gap-3">
                      <Layers className="h-6 w-6 text-primary animate-spin" />
                      <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider animate-pulse">
                        Generating spatial intelligence report...
                      </span>
                    </div>
                  ) : (
                    <div className="max-h-[320px] overflow-y-auto bg-background/50 border border-border/80 p-3.5 rounded-xl text-[11px] leading-relaxed text-muted-foreground whitespace-pre-line">
                      {aiReportContent}
                    </div>
                  )}
                  <div className="flex justify-end pt-1 border-t border-border/40">
                    <button onClick={() => setActiveModal(null)} disabled={aiReportGenerating}
                      className="px-4 py-1.5 bg-primary text-primary-foreground font-bold rounded-lg disabled:opacity-50">Close</button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
