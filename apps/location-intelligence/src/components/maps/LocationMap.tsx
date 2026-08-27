"use client";

import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { HeatmapPoint, POILocation, Billboard } from "@/types";
import { ZoomIn, ZoomOut, Maximize2, Search, Layers } from "lucide-react";

// ---------------------------------------------------------------------------
// Tile URL helpers
// ---------------------------------------------------------------------------
const CARTO_KEY = (import.meta as any).env?.VITE_CARTO_API_KEY || "";

const TILE_URLS: Record<string, string> = {
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  dark: `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${CARTO_KEY}`,
  light: `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${CARTO_KEY}`,
};

interface LocationMapProps {
  latitude: number;
  longitude: number;
  radius: number;
  poiLocations: POILocation[];
  heatmapPoints: HeatmapPoint[];
  isMapPickingActive: boolean;
  onLocationPicked: (lat: number, lng: number) => void;
  selectedLat: number;
  selectedLng: number;
  billboards: Billboard[];
  onAnalyzeSite: (lat: number, lng: number) => void;
}

export default function LocationMap({
  latitude,
  longitude,
  radius,
  poiLocations,
  heatmapPoints,
  isMapPickingActive,
  onLocationPicked,
  selectedLat,
  selectedLng,
  billboards,
  onAnalyzeSite,
}: LocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<Record<string, any>>({});

  // Base style
  const [mapType, setMapType] = useState<"satellite" | "dark">("dark");

  // Category layer visibility
  const [layerViz, setLayerViz] = useState({
    pois: true,
    heatmap: true,
    transit: true,
    radius: true,
    markers: true,
    billboards: true,
  });

  // ── Expose global analysis handler for Leaflet popups ──
  useEffect(() => {
    (window as any).analyzeBillboard = (id: string, lat: number, lng: number) => {
      onAnalyzeSite(lat, lng);
    };
    return () => {
      delete (window as any).analyzeBillboard;
    };
  }, [onAnalyzeSite]);

  // Layer panel toggle
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);

  const [leafletReady, setLeafletReady] = useState(false);
  const [L, setL] = useState<any>(null);

  // ── Load Leaflet dynamically ──
  useEffect(() => {
    import("leaflet").then((mod) => {
      setL(mod.default || mod);
      setLeafletReady(true);
    });
  }, []);

  // ── Listen for chat view actions to center map ──
  useEffect(() => {
    const handleChatViewOnMap = (e: any) => {
      const { latitude, longitude } = e.detail;
      if (mapRef.current) {
        mapRef.current.setView([latitude, longitude], 15);
      }
    };
    window.addEventListener("chat-view-on-map", handleChatViewOnMap);
    return () => {
      window.removeEventListener("chat-view-on-map", handleChatViewOnMap);
    };
  }, []);

  // ── Sync callback Ref to prevent stale closures ──
  const onLocationPickedRef = useRef(onLocationPicked);
  useEffect(() => {
    onLocationPickedRef.current = onLocationPicked;
  }, [onLocationPicked]);

  const isMapPickingActiveRef = useRef(isMapPickingActive);
  useEffect(() => {
    isMapPickingActiveRef.current = isMapPickingActive;
  }, [isMapPickingActive]);

  // ── Dom Click Capture for Location Picking (Capture Phase) ──
  useEffect(() => {
    if (!leafletReady || !mapRef.current || !mapContainerRef.current) return;
    const container = mapContainerRef.current;

    const handleDomClick = (e: MouseEvent) => {
      if (!isMapPickingActiveRef.current) return;

      const map = mapRef.current;
      const latlng = map.mouseEventToLatLng(e);
      console.log("DOM Click captured in pick mode:", latlng.lat, latlng.lng);

      e.stopPropagation();
      e.preventDefault();

      if (typeof onLocationPickedRef.current === "function") {
        onLocationPickedRef.current(latlng.lat, latlng.lng);
      }
    };

    container.addEventListener("click", handleDomClick, true);
    return () => {
      container.removeEventListener("click", handleDomClick, true);
    };
  }, [leafletReady]);

  // ── Initialise Map ──
  useEffect(() => {
    if (!leafletReady || !L || !mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [selectedLat || 13.0827, selectedLng || 80.2707],
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });
    mapRef.current = map;

    // Default tile
    layersRef.current.tile = L.tileLayer(TILE_URLS.dark, { subdomains: "abcd", maxZoom: 20 }).addTo(map);

    // Layer groups
    layersRef.current.poiGroup = L.layerGroup().addTo(map);
    layersRef.current.heatGroup = L.layerGroup().addTo(map);
    layersRef.current.transitGroup = L.layerGroup().addTo(map);
    layersRef.current.radiusGroup = L.layerGroup().addTo(map);
    layersRef.current.markerGroup = L.layerGroup().addTo(map);
    layersRef.current.billboardGroup = L.layerGroup().addTo(map);

    // Click handler for candidate picking (using Ref to avoid stale closure issues)
    map.on("click", (e: any) => {
      console.log("Map clicked inside Leaflet:", e.latlng.lat, e.latlng.lng);
      if (!isMapPickingActiveRef.current) {
        console.log("Map picking is NOT active. Click ignored.");
        return;
      }
      if (typeof onLocationPickedRef.current === "function") {
        onLocationPickedRef.current(e.latlng.lat, e.latlng.lng);
      } else {
        console.warn("onLocationPickedRef.current is not a function:", onLocationPickedRef.current);
      }
    });

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafletReady]);

  // ── Swap Base Tile Layer (reactive to mapType) ──
  useEffect(() => {
    if (!mapRef.current || !L) return;
    if (layersRef.current.tile) {
      mapRef.current.removeLayer(layersRef.current.tile);
    }
    layersRef.current.tile = L.tileLayer(TILE_URLS[mapType], { subdomains: "abcd", maxZoom: 20 }).addTo(mapRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapType, leafletReady]);

  // ── Layer Visibility Toggle ──
  useEffect(() => {
    if (!mapRef.current || !L) return;
    const groups: Record<string, string> = {
      pois: "poiGroup",
      heatmap: "heatGroup",
      transit: "transitGroup",
      radius: "radiusGroup",
      markers: "markerGroup",
      billboards: "billboardGroup",
    };
    Object.entries(groups).forEach(([key, groupKey]) => {
      const group = layersRef.current[groupKey];
      if (!group) return;
      if (layerViz[key as keyof typeof layerViz]) {
        if (!mapRef.current.hasLayer(group)) mapRef.current.addLayer(group);
      } else {
        if (mapRef.current.hasLayer(group)) mapRef.current.removeLayer(group);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerViz, leafletReady]);

  // ── Center map view only when the finalized analyzed coordinates change ──
  useEffect(() => {
    if (!leafletReady || !mapRef.current) return;
    mapRef.current.setView([latitude, longitude], mapRef.current.getZoom(), { animate: true });
  }, [latitude, longitude, leafletReady]);

  // ── Main Update Effect ──
  useEffect(() => {
    if (!mapRef.current || !L) return;
    const map = mapRef.current;

    const targetLat = selectedLat || latitude;
    const targetLng = selectedLng || longitude;
    console.log("LocationMap update effect: targetLat=", targetLat, "targetLng=", targetLng, "selectedLat=", selectedLat, "latitude=", latitude);

    // ── Markers ──
    layersRef.current.markerGroup?.clearLayers();

    // Blue candidate marker (custom map pin with keyframe glow/scale pulse animation)
    const blueIcon = L.divIcon({
      className: "bg-transparent border-0",
      html: `
        <div class="blue-picker-pin" style="
          position: relative;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: pinGlow 2s infinite ease-in-out;
          transform-origin: bottom center;
        ">
          <svg viewBox="0 0 24 24" width="32" height="32" style="display: block;">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#0055ff" />
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 30],
      popupAnchor: [0, -30],
    });
    L.marker([selectedLat || latitude, selectedLng || longitude], { icon: blueIcon })
      .bindPopup("<b>🎯 Candidate Location</b><br/><small>Click anywhere to select a new point.</small>")
      .addTo(layersRef.current.markerGroup);

    // ── Static Billboards ──
    layersRef.current.billboardGroup?.clearLayers();

    // Red billboard marker icon (using SVG representing the map pin)
    const redBillboardIcon = L.divIcon({
      className: "bg-transparent border-0",
      html: `
        <div style="
          position: relative;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.45));
          cursor: pointer;
          transition: transform 0.2s ease;
        " onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'">
          <svg viewBox="0 0 24 24" width="28" height="28" style="display: block;">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#ef4444" />
          </svg>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 26],
      popupAnchor: [0, -26],
    });

    billboards.forEach((bb) => {
      if (!bb.latitude || !bb.longitude) return;

      const campaignHtml = bb.campaign
        ? `
          <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 10px;">
            <div style="font-weight: 700; color: #3b82f6;">Campaign: ${bb.campaign.name}</div>
            <div style="color: #a1a1aa; margin-top: 1px;">Owner: ${bb.campaign.owner}</div>
            <div style="margin-top: 2px;">
              <span style="
                padding: 1px 5px; 
                border-radius: 4px; 
                background: ${bb.campaign.status === "Running" ? "rgba(16, 185, 129, 0.15)" :
          bb.campaign.status === "Upcoming" ? "rgba(245, 158, 11, 0.15)" :
            "rgba(148, 163, 184, 0.15)"
        };
                color: ${bb.campaign.status === "Running" ? "#34d399" :
          bb.campaign.status === "Upcoming" ? "#fbbf24" :
            "#94a3b8"
        };
                font-size: 8px;
                font-weight: 800;
                text-transform: uppercase;
                display: inline-block;
              ">${bb.campaign.status}</span>
            </div>
          </div>
        `
        : "";

      L.marker([bb.latitude, bb.longitude], { icon: redBillboardIcon })
        .bindPopup(`
          <div style="min-width: 170px; font-family: inherit; font-size: 11px;">
            <div style="font-weight: 800; color: #ffffff; font-size: 12px; margin-bottom: 2px;">📍 ${bb.name}</div>
            <div style="color: #60a5fa; font-weight: 600; font-size: 9px; text-transform: uppercase; tracking-wider">${bb.category} Billboard</div>
            <div style="color: #71717a; font-family: monospace; font-size: 9px; margin-top: 1px;">ID: ${bb.id}</div>
            
            ${campaignHtml}
            
            <button onclick="window.analyzeBillboard?.('${bb.id}', ${bb.latitude}, ${bb.longitude})" style="
              margin-top: 8px;
              width: 100%;
              padding: 5px 8px;
              background: #0055ff;
              color: white;
              border: none;
              border-radius: 8px;
              font-weight: 700;
              cursor: pointer;
              font-size: 9.5px;
              text-align: center;
              transition: background 0.2s ease;
            " onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#0055ff'">
              Analyze Billboard Site
            </button>
          </div>
        `)
        .addTo(layersRef.current.billboardGroup);
    });

    // ── Radius Circle ──
    layersRef.current.radiusGroup?.clearLayers();
    L.circle([targetLat, targetLng], {
      radius,
      color: "rgba(59,130,246,0.5)",
      fillColor: "rgba(59,130,246,0.05)",
      weight: 1.5,
      dashArray: "5 4",
      interactive: false,
    }).addTo(layersRef.current.radiusGroup);

    // ── POI Markers (overview) ──
    layersRef.current.poiGroup?.clearLayers();
    const typeColors: Record<string, string> = {
      Restaurant: "#f59e0b", Hospital: "#ef4444", School: "#3b82f6",
      Shopping: "#ec4899", Bank: "#10b981", Transit: "#8b5cf6",
      Hotel: "#06b6d4", Entertainment: "#f97316", Government: "#64748b",
    };
    poiLocations.forEach((poi) => {
      const c = typeColors[poi.type] || "#94a3b8";
      const poiIcon = L.divIcon({
        className: "bg-transparent border-0",
        html: `<div style="width:10px;height:10px;background:${c};border:1.5px solid rgba(255,255,255,0.8);border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
        iconSize: [10, 10], iconAnchor: [5, 5],
      });
      L.marker([poi.lat, poi.lng], { icon: poiIcon })
        .bindPopup(`<b>${poi.name}</b><br/><small>${poi.type}</small>`)
        .addTo(layersRef.current.poiGroup);
    });

    // ── Heatmap ──
    layersRef.current.heatGroup?.clearLayers();
    heatmapPoints.forEach((pt) => {
      const intensity = pt.intensity ?? 0.5;
      const color = intensity > 0.8 ? "#ef4444"
        : intensity > 0.6 ? "#f97316"
          : intensity > 0.4 ? "#fbbf24"
            : "#4ade80";
      L.circle([pt.lat, pt.lng], {
        radius: Math.max(80, radius * 0.12),
        fillColor: color,
        fillOpacity: Math.min(0.65, intensity * 0.8),
        stroke: false,
        interactive: false,
      }).addTo(layersRef.current.heatGroup);
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude, radius, poiLocations, heatmapPoints, selectedLat, selectedLng,
    leafletReady, billboards]);

  // ── Helpers ──
  const zoom = (dir: "in" | "out") => {
    if (mapRef.current) dir === "in" ? mapRef.current.zoomIn() : mapRef.current.zoomOut();
  };
  const fullscreen = () => {
    if (!mapContainerRef.current) return;
    if (!document.fullscreenElement) mapContainerRef.current.requestFullscreen?.();
    else document.exitFullscreen?.();
  };



  const toggleLayer = (key: keyof typeof layerViz) => {
    setLayerViz((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const LAYER_LABELS: { key: keyof typeof layerViz; label: string }[] = [
    { key: "markers", label: "Candidate Marker" },
    { key: "billboards", label: "Static Billboards" },
    { key: "radius", label: "Radius Circle" },
    { key: "heatmap", label: "Density Heatmap" },
  ];

  return (
    <div className="relative w-full h-[520px] rounded-2xl overflow-hidden border border-border shadow-xl group">
      <div
        ref={mapContainerRef}
        className={`w-full h-full z-10 ${isMapPickingActive ? "map-pick-mode" : ""}`}
      />
      <style>{`
        .leaflet-container.map-pick-mode,
        .leaflet-container.map-pick-mode * {
          cursor: crosshair !important;
        }
      `}</style>

      {/* Base layer switcher (top right) */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
        <div className="bg-card/95 backdrop-blur-md p-1 rounded-xl border border-border flex gap-1 shadow-lg text-[9px] font-bold">
          {(["satellite", "dark"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setMapType(t)}
              className={`px-2 py-1 rounded capitalize transition-all ${mapType === t
                  ? "bg-primary text-primary-foreground font-black"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Layer toggle panel button */}
        <button
          onClick={() => setLayerPanelOpen((v) => !v)}
          className="p-2 bg-card/95 backdrop-blur-md rounded-xl border border-border hover:bg-secondary text-foreground shadow-lg transition-colors flex items-center gap-1.5 text-[10px] font-bold"
        >
          <Layers size={13} /> Layers
        </button>

        {/* Layer panel */}
        {layerPanelOpen && (
          <div className="bg-card/98 backdrop-blur-md border border-border rounded-xl shadow-xl p-3 space-y-2 w-44">
            <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">Toggle Layers</span>
            {LAYER_LABELS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={layerViz[key]}
                  onChange={() => toggleLayer(key)}
                  className="rounded border-border accent-primary h-3.5 w-3.5"
                />
                {label}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* ── Zoom controls (left) ── */}
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-2">
        {[{ icon: ZoomIn, fn: () => zoom("in") }, { icon: ZoomOut, fn: () => zoom("out") }, { icon: Maximize2, fn: fullscreen }].map(({ icon: Icon, fn }, i) => (
          <button key={i} onClick={fn}
            className="p-2 bg-card/90 backdrop-blur-md rounded-xl border border-border hover:bg-secondary text-foreground shadow-lg transition-colors">
            <Icon size={13} />
          </button>
        ))}
      </div>

      {/* ── Legend (bottom right) ── */}
      <div className="absolute bottom-3 right-3 z-20 bg-card/95 backdrop-blur-md p-3 rounded-xl border border-border shadow-lg text-[9px] w-36">
        <div className="font-bold border-b border-border/50 pb-1 mb-1.5 text-muted-foreground uppercase tracking-wider">Legend</div>
        <div className="space-y-1.5 font-semibold">
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" width="10" height="10" className="shrink-0">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#0055ff" />
            </svg>
            <span className="text-foreground">Candidate Pin</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" width="10" height="10" className="shrink-0">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#ef4444" />
            </svg>
            <span className="text-foreground">Static Billboard</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shrink-0" />
            <span className="text-foreground">Low density</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0" />
            <span className="text-foreground">High density</span>
          </div>
        </div>
      </div>

      {/* ── Analysis radius indicator (bottom left) ── */}
      <div className="absolute bottom-3 left-3 z-20 bg-card/90 backdrop-blur-md px-3 py-2 rounded-xl border border-border shadow-lg text-[9px] text-foreground">
        <span className="text-muted-foreground font-bold uppercase tracking-wider block">Analysis Radius</span>
        <span className="font-black text-primary font-mono text-sm">{radius}m</span>
      </div>
    </div>
  );
}
