"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";

import {
  Bell,
  MapPin,
  Play,
  ChevronDown,
} from "lucide-react";

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8080";

interface HeaderProps {
  latitude: number;
  longitude: number;
  radius: number;
  onAnalyze: (lat: number, lng: number, rad: number) => void;
  isMapPickingActive: boolean;
  setIsMapPickingActive: (active: boolean) => void;
  area?: string;
  onMenuClick?: () => void;
}

export default function Header({
  latitude,
  longitude,
  radius,
  onAnalyze,
  isMapPickingActive,
  setIsMapPickingActive,
  area,
  onMenuClick,
}: HeaderProps) {
  // Inputs
  const [latVal, setLatVal] = useState<string>(latitude.toString());
  const [lngVal, setLngVal] = useState<string>(longitude.toString());
  const [radVal, setRadVal] = useState<number>(radius);
  const [detectedArea, setDetectedArea] = useState("");
  const [areaSearch, setAreaSearch] = useState("");

  // Sync typed query when coordinates analysis updates detected area name
  useEffect(() => {
    if (detectedArea && detectedArea !== "Unknown") {
      setAreaSearch(detectedArea);
    } else if (area) {
      setAreaSearch(area);
    }
  }, [detectedArea, area]);

  // Auto-detect area name based on coordinates
  useEffect(() => {
    const lat = parseFloat(latVal);
    const lng = parseFloat(lngVal);
    if (!isNaN(lat) && !isNaN(lng)) {
      const delayDebounce = setTimeout(() => {
        axios.get(`${API_BASE}/api/location/v1/area/detect`, {
          params: { latitude: lat, longitude: lng }
        }).then(res => {
          setDetectedArea(res.data.area);
        }).catch(() => {
          setDetectedArea("Unknown");
        });
      }, 300);
      return () => clearTimeout(delayDebounce);
    }
  }, [latVal, lngVal]);

  // Sync inputs with parent state
  useEffect(() => {
    setLatVal(latitude.toString());
  }, [latitude]);

  useEffect(() => {
    setLngVal(longitude.toString());
  }, [longitude]);

  useEffect(() => {
    setRadVal(radius);
  }, [radius]);

  const handleAnalyzeClick = async () => {
    // If a different area search name was typed by the user, geocode it first!
    if (areaSearch && areaSearch !== detectedArea && areaSearch !== area) {
      try {
        const res = await axios.get(`${API_BASE}/api/location/v1/geocode`, {
          params: { q: areaSearch }
        });
        const { latitude: newLat, longitude: newLng } = res.data;
        setLatVal(newLat.toString());
        setLngVal(newLng.toString());
        onAnalyze(newLat, newLng, radVal);
        return;
      } catch (err: any) {
        console.error("Geocoding failed", err);
        const detail = err.response?.data?.detail || "Location not found. Try T Nagar, Anna Nagar, Velachery, Adyar, OMR, Guindy, Porur, or Tambaram.";
        alert(detail);
        return;
      }
    }

    const lat = parseFloat(latVal);
    const lng = parseFloat(lngVal);
    if (!isNaN(lat) && !isNaN(lng)) {
      onAnalyze(lat, lng, radVal);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleAnalyzeClick();
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-[#0d1222]/95 backdrop-blur-md px-5 py-3 shrink-0 shadow-md">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 w-full">

        {/* Left Side: Brand Logo */}
        <div className="flex items-center gap-3 hover:opacity-90 transition-opacity cursor-pointer shrink-0">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none">Aculion</span>
            <h1 className="text-sm font-black text-white tracking-tight leading-none mt-1">
              Intelligence
            </h1>
          </div>
        </div>

        {/* Middle/Main: Map inputs in a prominent, full-width row that covers side area */}
        <div className="flex flex-wrap items-center gap-2.5 bg-background/50 p-1.5 border border-border/80 rounded-xl flex-1 w-full">
          {/* Lat Input */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-background/90 border border-border rounded-lg flex-1 sm:flex-initial">
            <span className="text-xs font-black text-blue-400 tracking-wider uppercase">LAT</span>
            <input
              type="number"
              step="any"
              value={latVal}
              onChange={(e) => setLatVal(e.target.value)}
              className="bg-transparent border-none text-sm w-22 focus:outline-none font-mono font-bold text-white p-0"
            />
          </div>

          {/* Lng Input */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-background/90 border border-border rounded-lg flex-1 sm:flex-initial">
            <span className="text-xs font-black text-blue-400 tracking-wider uppercase">LNG</span>
            <input
              type="number"
              step="any"
              value={lngVal}
              onChange={(e) => setLngVal(e.target.value)}
              className="bg-transparent border-none text-sm w-22 focus:outline-none font-mono font-bold text-white p-0"
            />
          </div>

          {/* Area Search Display (Expands to cover space gracefully) */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-background/90 border border-border rounded-lg flex-1 min-w-[200px]">
            <span className="text-xs font-black text-emerald-400 tracking-wider uppercase shrink-0">AREA</span>
            <input
              type="text"
              value={areaSearch}
              onChange={(e) => setAreaSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search area..."
              className="bg-transparent border-none text-sm font-bold text-white p-0 w-full focus:outline-none truncate"
            />
          </div>

          {/* Radius Selector */}
          <div className="relative flex-1 sm:flex-initial">
            <select
              value={radVal}
              onChange={(e) => {
                const val = Number(e.target.value);
                setRadVal(val);
                const currentLat = parseFloat(latVal);
                const currentLng = parseFloat(lngVal);
                if (!isNaN(currentLat) && !isNaN(currentLng)) {
                  onAnalyze(currentLat, currentLng, val);
                } else {
                  onAnalyze(latitude, longitude, val);
                }
              }}
              className="appearance-none bg-background/90 border border-border rounded-lg pl-3 pr-8 py-1.5 text-xs font-extrabold focus:outline-none hover:border-primary cursor-pointer w-full text-white"
            >
              <option value="500">500 m</option>
              <option value="1000">1.0 km</option>
              <option value="1500">1.5 km</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>



          {/* Map Pin Picker Trigger */}
          <button
            onClick={() => setIsMapPickingActive(!isMapPickingActive)}
            className={`flex items-center justify-center gap-1.5 px-4 py-1.5 border rounded-lg text-xs font-extrabold transition-all duration-200 shrink-0 ${
              isMapPickingActive
                ? "bg-primary border-primary text-primary-foreground animate-pulse shadow-md"
                : "border-border bg-background/90 hover:bg-secondary text-muted-foreground hover:text-white"
            }`}
            title="Click and select a point directly on the interactive map"
          >
            <MapPin size={14} className={isMapPickingActive ? "animate-bounce" : ""} />
            <span>Pick</span>
          </button>

          {/* Analyze CTA */}
          <button
            onClick={handleAnalyzeClick}
            className="flex items-center justify-center gap-2 px-6 py-1.5 bg-blue-600 text-white hover:bg-blue-500 rounded-lg text-xs font-black shadow-lg shadow-blue-500/25 hover:opacity-95 active:scale-95 transition-all duration-150 shrink-0"
          >
            <Play size={12} className="fill-current" />
            <span>Analyze</span>
          </button>
        </div>

      </div>
    </header>
  );
}
