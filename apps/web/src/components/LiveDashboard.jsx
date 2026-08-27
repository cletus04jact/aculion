import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import LocationIntelligence from '../pages/LocationIntelligence';
import lionLogo from '../assets/aculion_lion_logo.png';
import transparentLogo from '../assets/aculion_logo_transparent.png';
import { supabase } from '../services/supabase';
import { 
  AreaChart, 
  Area, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell
} from 'recharts';

// ── Static Mock Data ──
const LINE_DATA = [
  { time: '12 AM', value: 150 },
  { time: '02 AM', value: 90 },
  { time: '04 AM', value: 60 },
  { time: '06 AM', value: 240 },
  { time: '08 AM', value: 680 },
  { time: '10 AM', value: 1246 },
  { time: '12 PM', value: 950 },
  { time: '02 PM', value: 1100 },
  { time: '04 PM', value: 1480 },
  { time: '06 PM', value: 1600 },
  { time: '08 PM', value: 1200 },
  { time: '10 PM', value: 750 },
  { time: '12 AM', value: 350 }
];

const HISTORICAL_DAILY = [
  { name: '08:00 AM', Impressions: 4200, Occupancy: 85 },
  { name: '10:00 AM', Impressions: 8400, Occupancy: 88 },
  { name: '12:00 PM', Impressions: 6100, Occupancy: 84 },
  { name: '02:00 PM', Impressions: 7200, Occupancy: 86 },
  { name: '04:00 PM', Impressions: 9800, Occupancy: 90 },
  { name: '06:00 PM', Impressions: 12400, Occupancy: 95 },
  { name: '08:00 PM', Impressions: 10500, Occupancy: 92 },
  { name: '10:00 PM', Impressions: 5400, Occupancy: 86 }
];

const HISTORICAL_WEEKLY = [
  { name: 'Mon', Impressions: 38200, Occupancy: 82 },
  { name: 'Tue', Impressions: 42100, Occupancy: 85 },
  { name: 'Wed', Impressions: 45782, Occupancy: 89 },
  { name: 'Thu', Impressions: 41200, Occupancy: 84 },
  { name: 'Fri', Impressions: 49800, Occupancy: 95 },
  { name: 'Sat', Impressions: 35400, Occupancy: 78 },
  { name: 'Sun', Impressions: 31200, Occupancy: 72 }
];

const HISTORICAL_MONTHLY = [
  { name: 'Week 1', Impressions: 245000, Occupancy: 80 },
  { name: 'Week 2', Impressions: 278000, Occupancy: 85 },
  { name: 'Week 3', Impressions: 295000, Occupancy: 88 },
  { name: 'Week 4', Impressions: 312000, Occupancy: 92 }
];

const HISTORICAL_YEARLY = [
  { name: 'Jan', Impressions: 1120000, Occupancy: 78 },
  { name: 'Feb', Impressions: 1240000, Occupancy: 81 },
  { name: 'Mar', Impressions: 1350000, Occupancy: 83 },
  { name: 'Apr', Impressions: 1190000, Occupancy: 80 },
  { name: 'May', Impressions: 1450000, Occupancy: 87 },
  { name: 'Jun', Impressions: 1520000, Occupancy: 90 },
  { name: 'Jul', Impressions: 1610000, Occupancy: 92 },
  { name: 'Aug', Impressions: 1580000, Occupancy: 91 },
  { name: 'Sep', Impressions: 1390000, Occupancy: 85 },
  { name: 'Oct', Impressions: 1490000, Occupancy: 87 },
  { name: 'Nov', Impressions: 1680000, Occupancy: 93 },
  { name: 'Dec', Impressions: 1820000, Occupancy: 96 }
];

const DONUT_DATA = [
  { name: '0–15 sec', value: 22.1, color: '#3b82f6' },
  { name: '15–30 sec', value: 31.4, color: '#6366f1' },
  { name: '30–60 sec', value: 28.7, color: '#f59e0b' },
  { name: '60+ sec', value: 17.8, color: '#22c55e' }
];

// Heatmap grid (7 days x 12 time-slots)
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS_LABELS = ['12 AM', '04 AM', '08 AM', '12 PM', '04 PM', '08 PM', '12 AM'];

const HEATMAP_DATA = [
  [0.05, 0.08, 0.12, 0.22, 0.35, 0.48, 0.65, 0.72, 0.58, 0.32, 0.15, 0.08],
  [0.08, 0.05, 0.10, 0.25, 0.38, 0.52, 0.78, 0.85, 0.62, 0.35, 0.18, 0.10],
  [0.06, 0.07, 0.11, 0.24, 0.40, 0.55, 0.82, 0.95, 0.68, 0.38, 0.20, 0.12],
  [0.07, 0.06, 0.13, 0.26, 0.42, 0.50, 0.75, 0.88, 0.60, 0.34, 0.19, 0.09],
  [0.09, 0.08, 0.15, 0.30, 0.48, 0.65, 0.88, 0.92, 0.75, 0.42, 0.25, 0.15],
  [0.12, 0.10, 0.18, 0.35, 0.44, 0.48, 0.52, 0.58, 0.45, 0.30, 0.22, 0.18],
  [0.10, 0.08, 0.12, 0.20, 0.30, 0.35, 0.40, 0.45, 0.38, 0.25, 0.15, 0.10]
];

const getHeatmapColor = (val) => {
  if (val < 0.15) return '#101626';
  if (val < 0.30) return '#1e3a8a';
  if (val < 0.45) return '#2563eb';
  if (val < 0.60) return '#22c55e';
  if (val < 0.75) return '#d97706';
  if (val < 0.90) return '#ea580c';
  return '#dc2626';
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0f172a] border border-white/10 px-2 py-1 rounded text-[10px] shadow-xl">
        <span className="text-white/60 font-medium">{payload[0].payload.time || payload[0].payload.name}</span>
        <span className="mx-1">•</span>
        <span className="text-white font-semibold">{(payload[0].value || payload[0].Impressions || 0).toLocaleString()} Units</span>
      </div>
    );
  }
  return null;
};

export default function LiveDashboard({ 
  navigateTo, 
  selectedBillboard, 
  billboards = [], 
  user, 
  onSelectBillboard, 
  onAddNewMedia,
  onBackToProfile,
  baseDashboardPath = '/dashboard',
}) {
  // Derive initial active nav from URL path segment.
  // Works for both old /dashboard/<view> and new /<slug>/<bbCode>/dashboard/<view> patterns.
  const getNavFromPath = () => {
    const parts = window.location.pathname.split('/');
    const dashIdx = parts.indexOf('dashboard');
    const seg = dashIdx >= 0 ? (parts[dashIdx + 1] || '') : '';
    const map = {
      'traffic-overview':     'traffic',
      'location-overview':    'overview',
      'corridor-intelligence': 'corridor',
      'zone-comparison':      'zone',
      'historical-trends':    'historical',
      'alerts':               'alerts',
      'reports':              'reports',
      'data-export':          'export',
      'settings':             'settings',
      'live-view':            'live',
    };
    return map[seg] || 'live';
  };
  const [activeNav, setActiveNav] = useState(getNavFromPath);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mainMediaView, setMainMediaView] = useState('map');
  const [timeFilter, setTimeFilter] = useState('24H');
  
  const getSeed = () => {
    const str = selectedBillboard?.billboard_code || selectedBillboard?.id || 'default';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  };

  const getCorridors = () => {
    const loc = selectedBillboard?.location || selectedBillboard?.name || 'Main Junction';
    const cleanLoc = loc.split('–')[0].split(',')[0].trim();
    return [
      { name: `${cleanLoc} Main Ave (Northbound)`, speed: '42 km/h', flow: '680 veh/hr', dwell: '25s', peak: '08:00 AM - 10:00 AM', status: 'Low', badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
      { name: `${cleanLoc} Bypass (Eastbound)`, speed: '28 km/h', flow: '942 veh/hr', dwell: '48s', peak: '06:00 PM - 08:00 PM', status: 'Moderate', badge: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' },
      { name: `${cleanLoc} Connector (Southbound)`, speed: '14 km/h', flow: '1,204 veh/hr', dwell: '84s', peak: '05:30 PM - 07:30 PM', status: 'High', badge: 'bg-red-500/10 text-red-400 border border-red-500/20' },
      { name: `${cleanLoc} Loop Circle (Rotary)`, speed: '36 km/h', flow: '710 veh/hr', dwell: '15s', peak: '09:00 AM - 11:00 AM', status: 'Low', badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' }
    ];
  };

  const getZones = () => {
    const loc = selectedBillboard?.location || selectedBillboard?.name || 'Main Junction';
    const cleanLoc = loc.split('–')[0].split(',')[0].trim();
    return {
      zoneA: `${cleanLoc} Commercial Centre`,
      zoneB: `${cleanLoc} Retail Row`,
      zoneC: `${cleanLoc} Transit Junction Hub`
    };
  };

  // Real-time telemetry state connected to active sensors
  const [dbTrafficData, setDbTrafficData] = useState(null);
  const [livePeople, setLivePeople] = useState(0);
  const [liveVehicles, setLiveVehicles] = useState(0);
  const [liveDwell, setLiveDwell] = useState(0);
  const [isTrafficLoading, setIsTrafficLoading] = useState(true);

  // CCTV dynamic AI bounding boxes
  const [boxes, setBoxes] = useState([
    { id: 1, type: 'Vehicle', conf: 94, x: 22, y: 45, w: 18, h: 14, dx: 0.8, dy: 0.2 },
    { id: 2, type: 'Vehicle', conf: 89, x: 42, y: 52, w: 16, h: 12, dx: -0.6, dy: -0.15 },
    { id: 3, type: 'Person', conf: 91, x: 62, y: 28, w: 5, h: 12, dx: 0.1, dy: 0.15 },
    { id: 4, type: 'Vehicle', conf: 95, x: 74, y: 58, w: 20, h: 16, dx: -0.9, dy: -0.3 },
    { id: 5, type: 'Person', conf: 87, x: 12, y: 64, w: 6, h: 14, dx: -0.15, dy: 0.05 }
  ]);

  // System status and alerts
  const [alerts, setAlerts] = useState([]);

  // Reports configurations
  const [reportType, setReportType] = useState('weekly');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportsList, setReportsList] = useState([]);

  useEffect(() => {
    // Clear stale database traffic overview synchronously on billboard change
    localStorage.removeItem('aculion_traffic_overview');
    setDbTrafficData(null);
    setLiveVehicles(0);
    setLiveDwell(0);

    const code = selectedBillboard?.billboard_code || selectedBillboard?.id || 'BB';
    setReportsList([
      { id: `REP-${code}-01`, name: `${selectedBillboard?.name || 'Billboard'} Comprehensive Mobility & Reach Report`, format: 'PDF', date: '01 Jul 2025', size: '4.2 MB' },
      { id: `REP-${code}-02`, name: `${selectedBillboard?.name || 'Billboard'} Q2 Inventory Occupancy Summary`, format: 'XLSX', date: '30 Jun 2025', size: '1.8 MB' }
    ]);

    setAlerts([
      { id: 1, type: 'CRITICAL', title: 'Pedestrian density threshold exceeded', target: `${code} - Zone A`, time: '11:42 AM', active: true },
      { id: 2, type: 'WARNING', title: 'CCTV Node package latency spike (48ms)', target: `${code} - Camera Feed`, time: '11:38 AM', active: true },
      { id: 3, type: 'INFO', title: 'Weekly DOOH Occupancy report completed', target: `System Server Node`, time: '11:05 AM', active: true },
      { id: 4, type: 'CRITICAL', title: 'Hardware sensor temperature alert (64°C)', target: `${selectedBillboard?.name || 'Edge Box'} Processor Unit`, time: '10:50 AM', active: true }
    ]);

    async function fetchDbTrafficOverview() {
      setIsTrafficLoading(true);
      if (!selectedBillboard?.billboard_code) {
        setDbTrafficData(null);
        localStorage.removeItem('aculion_traffic_overview');
        setIsTrafficLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("traffic_overview")
          .select("*")
          .eq("billboard_code", selectedBillboard.billboard_code)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("[LiveDashboard] Error fetching traffic overview:", error);
          setDbTrafficData(null);
          localStorage.removeItem('aculion_traffic_overview');
          setIsTrafficLoading(false);
          return;
        }

        if (data) {
          setDbTrafficData(data);
          localStorage.setItem('aculion_traffic_overview', JSON.stringify(data));
          
          if (data.total_vehicles !== undefined && data.total_vehicles !== null) {
            setLiveVehicles(data.total_vehicles);
          }
          if (data.avg_exposure_time !== undefined && data.avg_exposure_time !== null) {
            setLiveDwell(Number(data.avg_exposure_time));
          }
        } else {
          setDbTrafficData(null);
          localStorage.removeItem('aculion_traffic_overview');
        }
      } catch (err) {
        console.error("[LiveDashboard] fetchDbTrafficOverview exception:", err);
        setDbTrafficData(null);
        localStorage.removeItem('aculion_traffic_overview');
      } finally {
        setIsTrafficLoading(false);
      }
    }

    fetchDbTrafficOverview();
  }, [selectedBillboard]);

  // Data Export configurations
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportingData, setExportingData] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Historical trends granularity
  const [historicalFilter, setHistoricalFilter] = useState('week');

  // Settings preferences
  const [settings, setSettings] = useState({
    refreshInterval: '5s',
    mapStyle: 'dark-gps',
    overlayBoxes: true,
    overlayLabels: true,
    notifications: true,
    timezone: 'Asia/Kolkata (IST)'
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Zone Comparison active zones
  const [activeZoneCompare, setActiveZoneCompare] = useState({
    zoneA: true,
    zoneB: true,
    zoneC: false
  });

  // Sync activeNav when user navigates with browser back/forward buttons
  useEffect(() => {
    const onPop = () => setActiveNav(getNavFromPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Time update ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Telemetry drift ticker — only drift values when backend data exists
  useEffect(() => {
    if (!dbTrafficData) return; // No drift when no backend data

    let tickMs = 5000;
    if (settings.refreshInterval === '1s') tickMs = 1000;
    if (settings.refreshInterval === '10s') tickMs = 10000;

    const interval = setInterval(() => {
      setLivePeople(prev => Math.max(10, prev + Math.floor(Math.random() * 9) - 4));
      setLiveVehicles(prev => Math.max(10, prev + Math.floor(Math.random() * 7) - 3));
      setLiveDwell(prev => Math.max(1.0, parseFloat((prev + (Math.random() * 0.4 - 0.2)).toFixed(1))));
    }, tickMs);
    return () => clearInterval(interval);
  }, [settings.refreshInterval, dbTrafficData]);

  // CCTV bounding boxes tracker simulation
  useEffect(() => {
    const trackingTimer = setInterval(() => {
      setBoxes(prev => prev.map(box => {
        let newX = box.x + box.dx * 1.5;
        let newY = box.y + box.dy * 1.5;
        // Reset box position when leaving screen bounds
        if (newX < 5 || newX > 90 || newY < 15 || newY > 85) {
          if (box.dx > 0) {
            newX = 5;
            newY = 20 + Math.random() * 50;
          } else {
            newX = 85;
            newY = 20 + Math.random() * 50;
          }
        }
        return {
          ...box,
          x: newX,
          y: newY,
          conf: Math.min(99, Math.max(80, box.conf + Math.floor(Math.random() * 5) - 2))
        };
      }));
    }, 180);
    return () => clearInterval(trackingTimer);
  }, []);

  // Alert dismissing handler
  const dismissAlert = (id) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, active: false } : a));
  };

  // Report generator runner
  const handleGenerateReport = (e) => {
    e.preventDefault();
    setGeneratingReport(true);
    setReportSuccess(false);
    setTimeout(() => {
      setGeneratingReport(false);
      setReportSuccess(true);
      const idStr = `REP-${Math.floor(1000 + Math.random() * 9000)}`;
      setReportsList(prev => [
        {
          id: idStr,
          name: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Traffic & Campaign ROI Report`,
          format: 'PDF',
          date: new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }),
          size: '2.5 MB'
        },
        ...prev
      ]);
    }, 2000);
  };

  // Data Export runner
  const handleExportData = (e) => {
    e.preventDefault();
    setExportingData(true);
    setExportSuccess(false);
    setTimeout(() => {
      setExportingData(false);
      setExportSuccess(true);
    }, 2000);
  };

  // Download report as proper PDF (Location & Traffic Overview)
  const downloadReportAsPDF = async (rep) => {
    // Pre-load the Aculion logo via fetch → FileReader (avoids canvas CORS taint)
    const logoDataUrl = await fetch(transparentLogo)
      .then(r => r.blob())
      .then(blob => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      }))
      .catch(() => null);
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentW = pageW - margin * 2;

    // ── Helper functions ──────────────────────────────────────
    const hex = (h) => {
      const r = parseInt(h.slice(1, 3), 16);
      const g = parseInt(h.slice(3, 5), 16);
      const b = parseInt(h.slice(5, 7), 16);
      return [r, g, b];
    };

    const fillRect = (x, y, w, h, color) => {
      doc.setFillColor(...hex(color));
      doc.rect(x, y, w, h, 'F');
    };

    const text = (str, x, y, opts = {}) => {
      doc.text(str, x, y, opts);
    };

    const setFont = (style = 'normal', size = 10, color = '#FFFFFF') => {
      doc.setFont('helvetica', style);
      doc.setFontSize(size);
      doc.setTextColor(...hex(color));
    };

    // ── BACKGROUND ────────────────────────────────────────────
    fillRect(0, 0, pageW, pageH, '#0a0e1a');

    // ── HEADER BANNER ────────────────────────────────────────
    fillRect(0, 0, pageW, 32, '#0d1b40');
    // accent line
    fillRect(0, 32, pageW, 1.2, '#2563eb');

    // Brand logo
    if (logoDataUrl) {
      // Logo image: height 14mm, width auto-calculated preserving aspect ratio
      const logoH = 14;
      const logoW = logoH * 4.2; // approximate aspect ratio of the transparent logo
      doc.addImage(logoDataUrl, 'PNG', margin - 2, 8, logoW, logoH);
    } else {
      // Fallback text if image fails
      setFont('bold', 18, '#FFFFFF');
      text('ACULION', margin, 13);
      setFont('normal', 7, '#60a5fa');
      text('SEE BEYOND INTELLIGENCE PLATFORM', margin, 19);
    }

    // Report label on right
    setFont('bold', 9, '#93c5fd');
    text('CAMPAIGN REPORT', pageW - margin, 11, { align: 'right' });
    setFont('normal', 7, '#94a3b8');
    text(`ID: ${rep.id}`, pageW - margin, 17, { align: 'right' });
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    text(`Generated: ${dateStr}`, pageW - margin, 22, { align: 'right' });

    let y = 42;

    // ── REPORT TITLE ─────────────────────────────────────────
    setFont('bold', 13, '#e2e8f0');
    const title = doc.splitTextToSize(rep.name, contentW);
    doc.text(title, margin, y);
    y += title.length * 7 + 2;

    setFont('normal', 8, '#64748b');
    text(`Period: ${rep.date}   •   Size: ${rep.size}   •   Weekly Summary`, margin, y);
    y += 10;

    // ── SECTION: LOCATION OVERVIEW ───────────────────────────
    // Section header pill
    fillRect(margin, y, contentW, 7.5, '#1e3a8a');
    fillRect(margin, y, 3, 7.5, '#3b82f6');
    setFont('bold', 9, '#93c5fd');
    text('  LOCATION OVERVIEW', margin + 4, y + 5.2);
    y += 11;

    // Table header
    fillRect(margin, y, contentW, 6.5, '#1e293b');
    setFont('bold', 7.5, '#94a3b8');
    const locCols = [margin + 2, margin + 62, margin + 95, margin + 125, margin + 152];
    const locHeaders = ['LOCATION', 'CITY', 'IMPRESSIONS', 'TYPE', 'STATUS'];
    locHeaders.forEach((h, i) => text(h, locCols[i], y + 4.5));
    y += 7;

    const locationData = [
      { location: 'Anna Nagar – Shanthi Colony Jn.', city: 'Chennai', impressions: '245,000', type: 'Digital Billboard', status: 'Active' },
      { location: 'T Nagar – Pondy Bazaar Hub', city: 'Chennai', impressions: '189,000', type: 'LED Unipole', status: 'Active' },
      { location: 'Velachery – Vijaya Nagar', city: 'Chennai', impressions: '176,000', type: 'Digital Billboard', status: 'Active' },
      { location: 'OMR – Tidel Park Flyover', city: 'Chennai', impressions: '162,000', type: 'DOOH Screen', status: 'Active' },
      { location: 'T. Nagar Bus Stand', city: 'Chennai', impressions: '148,000', type: 'Digital Screen', status: 'Active' }
    ];

    locationData.forEach((row, i) => {
      const rowBg = i % 2 === 0 ? '#0f172a' : '#111827';
      fillRect(margin, y, contentW, 6.5, rowBg);
      setFont('normal', 7.5, '#e2e8f0');
      text(row.location, locCols[0], y + 4.5);
      text(row.city, locCols[1], y + 4.5);
      text(row.impressions, locCols[2], y + 4.5);
      text(row.type, locCols[3], y + 4.5);
      // Status badge
      fillRect(locCols[4] - 1, y + 1.5, 18, 4, '#14532d');
      setFont('bold', 6.5, '#4ade80');
      text(row.status, locCols[4] + 8.5, y + 4.5, { align: 'center' });
      y += 6.5;
    });

    // Totals row
    fillRect(margin, y, contentW, 7, '#1e3a8a');
    setFont('bold', 7.5, '#93c5fd');
    text('TOTAL', locCols[0], y + 4.8);
    text('5 locations', locCols[1], y + 4.8);
    text('920,000', locCols[2], y + 4.8);
    text('Chennai Metro Area', locCols[3], y + 4.8);
    y += 12;

    // ── SECTION: TRAFFIC OVERVIEW ─────────────────────────────
    fillRect(margin, y, contentW, 7.5, '#1c1917');
    fillRect(margin, y, 3, 7.5, '#f97316');
    setFont('bold', 9, '#fdba74');
    text('  TRAFFIC OVERVIEW', margin + 4, y + 5.2);
    y += 11;

    // Table header
    fillRect(margin, y, contentW, 6.5, '#1e293b');
    setFont('bold', 7.5, '#94a3b8');
    const trfCols = [margin + 2, margin + 38, margin + 78, margin + 118];
    const trfHeaders = ['TIME', 'PEOPLE COUNT', 'VEHICLE COUNT', 'INTENSITY'];
    trfHeaders.forEach((h, i) => text(h, trfCols[i], y + 4.5));
    y += 7;

    const trafficData = [
      { time: '12 AM', people: 150, vehicles: 80 },
      { time: '06 AM', people: 240, vehicles: 130 },
      { time: '08 AM', people: 680, vehicles: 420 },
      { time: '10 AM', people: 1246, vehicles: 862 },
      { time: '12 PM', people: 950, vehicles: 610 },
      { time: '02 PM', people: 1100, vehicles: 720 },
      { time: '04 PM', people: 1480, vehicles: 890 },
      { time: '06 PM', people: 1600, vehicles: 940 },
      { time: '08 PM', people: 1200, vehicles: 760 },
      { time: '10 PM', people: 750, vehicles: 480 }
    ];
    const maxPeople = Math.max(...trafficData.map(t => t.people));

    trafficData.forEach((row, i) => {
      const rowBg = i % 2 === 0 ? '#0f172a' : '#111827';
      fillRect(margin, y, contentW, 6.5, rowBg);
      setFont('normal', 7.5, '#e2e8f0');
      text(row.time, trfCols[0], y + 4.5);
      text(row.people.toLocaleString(), trfCols[1], y + 4.5);
      text(row.vehicles.toLocaleString(), trfCols[2], y + 4.5);
      // Mini bar
      const barMaxW = 45;
      const barW = Math.max(2, (row.people / maxPeople) * barMaxW);
      const intensity = row.people > 1400 ? '#ef4444' : row.people > 900 ? '#f97316' : '#22c55e';
      fillRect(trfCols[3], y + 2, barMaxW, 2.5, '#1e293b');
      fillRect(trfCols[3], y + 2, barW, 2.5, intensity);
      y += 6.5;
    });

    y += 6;

    // ── SECTION: KEY METRICS ─────────────────────────────────
    fillRect(margin, y, contentW, 7.5, '#1a1a2e');
    fillRect(margin, y, 3, 7.5, '#a855f7');
    setFont('bold', 9, '#c084fc');
    text('  KEY METRICS', margin + 4, y + 5.2);
    y += 11;

    const metrics = [
      ['Peak Footfall', '1,600 persons (06 PM)'],
      ['Peak Vehicles', '940 vehicles (06 PM)'],
      ['Avg Dwell Duration', '7.6 minutes'],
      ['Daily Footfall Total', '~11,216 persons'],
      ['Daily Vehicle Total', '~6,894 vehicles'],
      ['Total Impressions', '920,000'],
      ['Data Streams', 'Footfall, Dwell, Vehicle Speed, Occupancy & Pricing']
    ];

    const col1 = margin + 2;
    const col2 = margin + 65;
    metrics.forEach((m, i) => {
      const rowBg = i % 2 === 0 ? '#0f172a' : '#111827';
      fillRect(margin, y, contentW, 6.5, rowBg);
      setFont('bold', 7.5, '#94a3b8');
      text(m[0], col1, y + 4.5);
      setFont('normal', 7.5, '#e2e8f0');
      text(m[1], col2, y + 4.5);
      y += 6.5;
    });

    y += 8;

    // ── FOOTER ────────────────────────────────────────────────
    fillRect(0, pageH - 14, pageW, 14, '#0d1b40');
    fillRect(0, pageH - 14, pageW, 0.8, '#2563eb');
    setFont('normal', 6.5, '#475569');
    text('Confidential — Generated by Aculion Analytics Engine v2.4', margin, pageH - 5);
    text('© Aculion Intelligence Platform. All rights reserved.', pageW - margin, pageH - 5, { align: 'right' });

    doc.save(`Aculion_${rep.id}_Location_Traffic_Report.pdf`);
  };

  // Settings Saver
  const handleSaveSettings = (e) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Helper date/time formatting
  const formattedDate = currentTime.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  const formattedTime = currentTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  // ── LIVE DATA COMPUTATIONS ──
  const activeBillboards = (billboards && billboards.length > 0) ? billboards : [
    { id: 'ACU-AN-001', name: 'Anna Nagar – Shanthi Colony Junction', location: 'Shanthi Colony Junction, Anna Nagar', city: 'Chennai', impressions: '245K', status: 'Active', type: 'Digital Billboard', image: '/anna_nagar_location.png', latitude: 13.0827, longitude: 80.2707 },
    { id: 'ACU-TN-002', name: 'T Nagar – Pondy Bazaar Commercial Hub', location: 'Pondy Bazaar Main Road, T. Nagar', city: 'Chennai', impressions: '189K', status: 'Active', type: 'Digital LED Unipole', image: '/blog_attention_metrics.png', latitude: 13.0418, longitude: 80.2341 },
    { id: 'ACU-VL-003', name: 'Velachery Main Road – Vijaya Nagar', location: 'Vijaya Nagar Bus Stand, Velachery', city: 'Chennai', impressions: '176K', status: 'Active', type: 'Digital Billboard', image: '/blog_billboard_roi.png', latitude: 12.9780, longitude: 80.2210 },
    { id: 'ACU-OMR-004', name: 'OMR Expressway – Tidel Park Flyover', location: 'Tidel Park Junction, OMR', city: 'Chennai', impressions: '162K', status: 'Active', type: 'DOOH Video Screen', image: '/blog_smart_city.png', latitude: 12.9892, longitude: 80.2483 },
    { id: 'ACU-TB-005', name: 'T. Nagar Bus Stand', location: 'Bus Stand Junction, T. Nagar', city: 'Chennai', impressions: '148K', status: 'Active', type: 'Digital Screen', image: '/blog_privacy_edge.png', latitude: 13.0400, longitude: 80.2300 }
  ];

  // 1. Total Medias (count of registered assets)
  const totalMediasCount = activeBillboards.length;

  // 2. Total Impressions (sum across active billboards)
  const rawImpressionsSum = activeBillboards.reduce((acc, b) => {
    if (typeof b.impressions === 'number') return acc + b.impressions;
    if (typeof b.impressions === 'string') {
      if (b.impressions.includes('M')) return acc + parseFloat(b.impressions) * 1000000;
      if (b.impressions.includes('K')) return acc + parseFloat(b.impressions) * 1000;
      return acc + (parseInt(b.impressions, 10) || 150000);
    }
    return acc + (b.status === 'Active' ? 245000 : 80000);
  }, 0);
  const formattedImpressionsVal = rawImpressionsSum >= 1000000 
    ? `${(rawImpressionsSum / 1000000).toFixed(2)}M`
    : `${(rawImpressionsSum / 1000).toFixed(0)}K`;

  // 3. Vehicles Detected (live telemetry state)
  const formattedVehiclesVal = dbTrafficData 
    ? (dbTrafficData.total_vehicles >= 1000 ? `${(dbTrafficData.total_vehicles / 1000).toFixed(1)}K` : `${dbTrafficData.total_vehicles}`)
    : '0';

  // 4. Premium & Above (% of high tier audience / digital screens)
  const digitalScreensCount = activeBillboards.filter(b => (b.type?.toLowerCase() || '').includes('digital') || (b.type?.toLowerCase() || '').includes('dooh') || b.status === 'Active').length;
  const premiumPctVal = Math.min(100, Math.round((digitalScreensCount / (totalMediasCount || 1)) * 43) || 43);

  // 5. Avg. Dwell Time
  const formattedDwellVal = dbTrafficData 
    ? `${dbTrafficData.avg_exposure_time} sec`
    : '0 sec';

  // Dynamic Media Health Breakdown
  const onlineCount = activeBillboards.filter(b => b.status === 'Active' || b.status === 'Online').length;
  const offlineCount = activeBillboards.filter(b => b.status === 'Offline' || b.status === 'Inactive').length;
  const maintenanceCount = activeBillboards.filter(b => b.status === 'Maintenance').length;
  const totalHealthCount = totalMediasCount || 1;
  const onlinePct = Math.round((onlineCount / totalHealthCount) * 100);
  const offlinePct = Math.round((offlineCount / totalHealthCount) * 100);
  const maintenancePct = Math.round((maintenanceCount / totalHealthCount) * 100);

  // Dynamic Top Performing Medias (Sorted by impressions)
  const sortedTopMedias = [...activeBillboards].sort((a, b) => {
    const valA = parseInt(a.impressions, 10) || (a.status === 'Active' ? 245000 : 80000);
    const valB = parseInt(b.impressions, 10) || (b.status === 'Active' ? 245000 : 80000);
    return valB - valA;
  });

  // Dynamic Performance Overview chart datasets based on selected time filter (1H, 6H, 12H, 24H)
  const CHART_DATASETS = {
    '1H': [
      { time: '12:00', Impressions: 15000, Vehicles: 9000, Premium: 4500 },
      { time: '12:15', Impressions: 22000, Vehicles: 14000, Premium: 6800 },
      { time: '12:30', Impressions: 38000, Vehicles: 26000, Premium: 11000 },
      { time: '12:45', Impressions: 45000, Vehicles: 31000, Premium: 14000 },
      { time: '01:00', Impressions: 52000, Vehicles: 38000, Premium: 18000 }
    ],
    '6H': [
      { time: '07 AM', Impressions: 35000, Vehicles: 22000, Premium: 9500 },
      { time: '08 AM', Impressions: 120000, Vehicles: 85000, Premium: 32000 },
      { time: '09 AM', Impressions: 185000, Vehicles: 125000, Premium: 48000 },
      { time: '10 AM', Impressions: 160000, Vehicles: 110000, Premium: 42000 },
      { time: '11 AM', Impressions: 140000, Vehicles: 95000, Premium: 36000 },
      { time: '12 PM', Impressions: 110000, Vehicles: 75000, Premium: 29000 }
    ],
    '12H': [
      { time: '01 AM', Impressions: 18000, Vehicles: 11000, Premium: 4000 },
      { time: '03 AM', Impressions: 25000, Vehicles: 16000, Premium: 6000 },
      { time: '05 AM', Impressions: 42000, Vehicles: 28000, Premium: 11000 },
      { time: '07 AM', Impressions: 95000, Vehicles: 65000, Premium: 24000 },
      { time: '09 AM', Impressions: 185000, Vehicles: 125000, Premium: 48000 },
      { time: '11 AM', Impressions: 140000, Vehicles: 95000, Premium: 36000 },
      { time: '01 PM', Impressions: 125000, Vehicles: 82000, Premium: 31000 }
    ],
    '24H': [
      { time: '12 AM', Impressions: 12000, Vehicles: 8000, Premium: 4000 },
      { time: '4 AM', Impressions: 35000, Vehicles: 22000, Premium: 10000 },
      { time: '8 AM', Impressions: 185000, Vehicles: 120000, Premium: 45000 },
      { time: '12 PM', Impressions: 110000, Vehicles: 75000, Premium: 30000 },
      { time: '4 PM', Impressions: 165000, Vehicles: 115000, Premium: 55000 },
      { time: '8 PM', Impressions: 140000, Vehicles: 95000, Premium: 40000 },
      { time: '12 AM', Impressions: 25000, Vehicles: 15000, Premium: 8000 }
    ]
  };
  const activeChartData = CHART_DATASETS[timeFilter] || CHART_DATASETS['24H'];

  const userName = user?.name || user?.fullName || 'Media Owner';

  return (
    <div className="w-screen h-screen bg-[#0a0e1a] text-white flex flex-col font-sans select-none overflow-hidden relative">
      
      {/* ═══════════════════════════════════════════════════
         MAIN BODY DECOUPLED COLUMNS
      ═══════════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden min-h-0 w-full relative">

        {/* ── SIDEBAR (Left Column - 280px width) ── */}
        <aside className="w-[280px] border-r border-white/10 bg-[#080b15] flex flex-col justify-between overflow-hidden h-full flex-shrink-0">
          
          {/* Logo brand section */}
          <div className="p-6 border-b border-white/10 flex flex-col gap-1.5 flex-shrink-0 cursor-pointer" onClick={(e) => navigateTo && navigateTo(e, '/')}>
            <div className="flex items-center gap-[12px]">
              <div style={{ width: '50px', height: '56px', overflow: 'hidden', flexShrink: 0 }}>
                <img 
                  src={transparentLogo} 
                  alt="Aculion Symbol" 
                  style={{ height: '56px', width: 'auto', maxWidth: 'none', display: 'block' }}
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[20px] font-black tracking-[0.05em] text-white uppercase leading-none font-heading">
                  ACULION
                </span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-[4px] leading-none">
                  SEE BEYOND
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col p-3 gap-1 overflow-y-auto min-h-0">
            {[
              { id: 'my_medias', icon: 'fa-tv', label: 'My Medias' },
              { id: 'live', icon: 'fa-circle-dot', label: 'Live View' },
              { id: 'traffic', icon: 'fa-car', label: 'Traffic Overview' },
              { id: 'overview', icon: 'fa-chart-pie', label: 'Location Overview' },
              { id: 'corridor', icon: 'fa-route', label: 'Corridor Intelligence' },
              { id: 'zone', icon: 'fa-chart-simple', label: 'Zone Comparison' },
              { id: 'historical', icon: 'fa-timeline', label: 'Historical Trends' },
              { id: 'alerts', icon: 'fa-triangle-exclamation', label: 'Alerts' },
              { id: 'reports', icon: 'fa-file-lines', label: 'Reports' },
              { id: 'export', icon: 'fa-file-export', label: 'Data Export' },
              { id: 'settings', icon: 'fa-sliders', label: 'Settings' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'my_medias') {
                    if (onBackToProfile) onBackToProfile();
                  } else {
                    // Map nav id → URL slug
                    const slugMap = {
                      live:      'live-view',
                      traffic:   'traffic-overview',
                      overview:  'location-overview',
                      corridor:  'corridor-intelligence',
                      zone:      'zone-comparison',
                      historical: 'historical-trends',
                      alerts:    'alerts',
                      reports:   'reports',
                      export:    'data-export',
                      settings:  'settings',
                    };
                    const viewSlug = slugMap[item.id] || item.id;
                    window.history.pushState(null, '', `${baseDashboardPath}/${viewSlug}`);
                    setActiveNav(item.id);
                  }
                }}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-[12px] font-semibold transition-all !w-full !border-none !shadow-none cursor-pointer ${
                  activeNav === item.id 
                    ? '!bg-blue-600 !text-white shadow-lg shadow-blue-500/20' 
                    : '!bg-transparent hover:!bg-white/[0.04] !text-white/60 hover:!text-white'
                }`}
              >
                <i className={`fa-solid ${item.icon} text-[12px] w-4 text-center`}></i>
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>

          {/* Media Owner Profile Pill in Sidebar */}
          <div className="p-3.5 border-t border-white/10 bg-[#06080e]/70 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 font-bold text-[11px] flex-shrink-0">
                MO
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] font-bold text-white truncate font-heading">{userName}</span>
                <span className="text-[9px] text-white/40 font-mono truncate">{user?.email || 'M0123456'}</span>
              </div>
            </div>
            <i className="fa-solid fa-chevron-down text-[10px] text-white/40 cursor-pointer" />
          </div>
        </aside>

        {/* ── MAIN CONTENT WORKSPACE (Right Column) ── */}
        <div className="flex-grow flex flex-col overflow-hidden h-full min-w-0">

          {/* ═══════════════════════════════════════════════════
             TOP BAR (TARGET REFERENCE DESIGN 1)
          ═══════════════════════════════════════════════════ */}
          <header className="h-[76px] border-b border-white/10 px-8 flex items-center justify-between bg-[#080c16] flex-shrink-0 w-full">
            {/* Greeting */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white/60">Welcome back,</span>
              </div>
              <h1 className="text-xl font-bold font-heading text-white tracking-wide leading-tight">
                {userName} 👋
              </h1>
              <p className="text-xs text-white/40 font-medium leading-none mt-1">
                Here's what's happening across your media today.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-[#121829] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white/80 font-medium">
                <i className="fa-regular fa-calendar text-blue-400 text-xs" />
                <span className="font-mono">Today, {formattedDate}</span>
              </div>

              <button
                onClick={onAddNewMedia || onBackToProfile}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 border border-blue-400/30 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-plus text-xs" />
                <span>Add Media</span>
              </button>
            </div>
          </header>

          {/* Main Views Container */}
          <main className="flex-grow flex flex-col h-full min-w-0 bg-[#070913] overflow-y-auto relative">
            {isTrafficLoading && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#070913]/95 backdrop-blur-md transition-all duration-300">
                <div className="relative flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full border-4 border-blue-500/10 border-t-blue-500 animate-spin shadow-[0_0_15px_rgba(59,130,246,0.3)]"></div>
                  <div className="absolute w-8 h-8 rounded-full bg-blue-500/20 animate-ping"></div>
                </div>
                <h3 className="mt-6 text-sm font-bold text-white tracking-widest uppercase font-heading">
                  Synchronizing Telemetry
                </h3>
                <p className="mt-2 text-xs text-white/40 font-medium font-mono">
                  Loading real-time database streams...
                </p>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════
               1. LIVE VIEW (EXACT TARGET REFERENCE DESIGN 1)
            ═══════════════════════════════════════════════════ */}
            {activeNav === 'live' && (
              <div className="flex-1 flex flex-col p-6 gap-6 min-w-0">

                {/* ── 1. TOP KPI CARDS ROW (5 CARDS) ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {/* Card 1: Total Medias */}
                  <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-4 flex flex-col justify-between shadow-xl relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-white/50">Total Medias</span>
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xs">
                        <i className="fa-solid fa-desktop" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <span className="text-2xl font-black text-white font-mono">{totalMediasCount}</span>
                      <div className="flex items-center gap-1 text-[10px] text-white/40 font-bold mt-1">
                        <span>--</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Total Impressions */}
                  <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-4 flex flex-col justify-between shadow-xl relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-white/50">Total Impressions</span>
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xs">
                        <i className="fa-solid fa-eye" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <span className="text-2xl font-black text-white font-mono">{formattedImpressionsVal}</span>
                      <div className="flex items-center gap-1 text-[10px] text-white/40 font-bold mt-1">
                        <span>--</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Vehicles Detected */}
                  <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-4 flex flex-col justify-between shadow-xl relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-white/50">Vehicles Detected</span>
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xs">
                        <i className="fa-solid fa-car" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <span className="text-2xl font-black text-white font-mono">{formattedVehiclesVal}</span>
                      <div className="flex items-center gap-1 text-[10px] text-white/40 font-bold mt-1">
                        <span>{dbTrafficData ? '+15%' : '--'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Premium & Above */}
                  <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-4 flex flex-col justify-between shadow-xl relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-white/50">Premium & Above</span>
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xs">
                        <i className="fa-solid fa-crown" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <span className="text-2xl font-black text-white font-mono">{premiumPctVal}%</span>
                      <div className="flex items-center gap-1 text-[10px] text-white/40 font-bold mt-1">
                        <span>--</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 5: Avg. Dwell Time */}
                  <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-4 flex flex-col justify-between shadow-xl relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-white/50">Avg. Dwell Time</span>
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs">
                <i className="fa-solid fa-stopwatch" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <span className="text-2xl font-black text-white font-mono">{formattedDwellVal}</span>
                      <div className="flex items-center gap-1 text-[10px] text-white/40 font-bold mt-1">
                        <span>{dbTrafficData ? '+6%' : '--'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── 2. MAIN MIDDLE SECTION (2 COLUMNS) ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Column: Media Performance Map (2 cols width) */}
                  <div className="lg:col-span-2 bg-[#0f1424]/90 border border-white/10 rounded-2xl p-5 flex flex-col gap-4 shadow-xl min-h-[420px]">
                    
                    {/* Map Header & View Switcher */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h3 className="text-sm font-bold text-white font-heading">Media Performance Map</h3>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Live
                        </span>
                      </div>

                      {/* View Toggle: Map vs CCTV Feed */}
                      <div className="flex items-center bg-white/[0.04] p-1 rounded-xl border border-white/10 gap-1">
                        <button
                          onClick={() => setMainMediaView('map')}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            mainMediaView === 'map' ? 'bg-blue-600 text-white shadow' : 'text-white/60 hover:!text-white'
                          }`}
                        >
                          <i className="fa-solid fa-map-location-dot mr-1.5" />
                          Map View
                        </button>
                        <button
                          onClick={() => setMainMediaView('cctv')}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            mainMediaView === 'cctv' ? 'bg-blue-600 text-white shadow' : 'text-white/60 hover:!text-white'
                          }`}
                        >
                          <i className="fa-solid fa-video mr-1.5" />
                          Live CCTV Feed
                        </button>
                      </div>
                    </div>

                    {/* Map Workspace Container */}
                    <div className="flex-1 min-h-[320px] bg-[#050711] rounded-xl border border-white/10 relative overflow-hidden flex flex-col">
                      {mainMediaView === 'map' ? (
                        <div className="w-full h-full relative">
                          <svg className="w-full h-full" viewBox="0 0 600 310" preserveAspectRatio="xMidYMid slice">
                            <defs>
                              <pattern id="gridMapTarget" width="25" height="25" patternUnits="userSpaceOnUse">
                                <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(255, 255, 255, 0.02)" strokeWidth="1"/>
                              </pattern>
                              <filter id="shadowPin" x="-20%" y="-20%" width="140%" height="140%">
                                <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.6"/>
                              </filter>
                            </defs>

                            <rect width="600" height="310" fill="url(#gridMapTarget)" />

                            {/* Bay of Bengal Ocean Coastline (Right Side) */}
                            <path d="M 530,-10 Q 515,100 540,200 Q 560,260 575,320 L 610,320 L 610,-10 Z" fill="#040b19" stroke="rgba(59, 130, 246, 0.2)" strokeWidth="1" />

                            {/* Road lines grid simulating Chennai arterial roads */}
                            <path d="M -20,110 L 530,115" stroke="#121b2d" strokeWidth="9" fill="none" />
                            <path d="M -20,110 L 530,115" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3 3" fill="none" />

                            <path d="M 470,40 L 220,320" stroke="#121b2d" strokeWidth="9" fill="none" />
                            <path d="M 470,40 L 220,320" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3 3" fill="none" />

                            <path d="M 260,-20 L 260,330" stroke="#0e1628" strokeWidth="7" fill="none" />
                            <path d="M 440,160 L 500,330" stroke="#0e1628" strokeWidth="7" fill="none" />
                            <path d="M 330,185 L 180,330" stroke="#0e1628" strokeWidth="7" fill="none" />

                            <path d="M 120,-20 L 120,330" stroke="#0a101f" strokeWidth="4" fill="none" />
                            <path d="M 370,-20 L 370,330" stroke="#0a101f" strokeWidth="4" fill="none" />
                            <path d="M -20,180 L 550,180" stroke="#0a101f" strokeWidth="4" fill="none" />
                            <path d="M -20,240 L 550,240" stroke="#0a101f" strokeWidth="4" fill="none" />

                            <text x="340" y="105" fill="rgba(255,255,255,0.4)" fontSize="9" fontWeight="bold">ANNA NAGAR</text>
                            <text x="180" y="145" fill="rgba(255,255,255,0.35)" fontSize="8" fontWeight="600">PORUR</text>
                            <text x="325" y="175" fill="rgba(255,255,255,0.35)" fontSize="8" fontWeight="600">GUINDY</text>
                            <text x="240" y="225" fill="rgba(255,255,255,0.35)" fontSize="8" fontWeight="600">VELACHERY</text>
                            <text x="375" y="155" fill="rgba(255,255,255,0.35)" fontSize="8" fontWeight="600">T. NAGAR</text>
                            <text x="465" y="170" fill="rgba(255,255,255,0.3)" fontSize="7">VELACHERY</text>
                            <text x="465" y="195" fill="rgba(255,255,255,0.3)" fontSize="7">THIRUVANMIYUR</text>
                            <text x="465" y="225" fill="rgba(255,255,255,0.3)" fontSize="7">ADYAR</text>
                            <text x="530" y="130" fill="rgba(255,255,255,0.35)" fontSize="13" fontWeight="bold">Chennai</text>

                            {[
                              { id: 'ACU-AN-001', x: 340, y: 110, status: 'High' },
                              { id: 'ACU-TN-002', x: 375, y: 160, status: 'High' },
                              { id: 'ACU-VL-003', x: 310, y: 220, status: 'Medium' },
                              { id: 'ACU-OMR-004', x: 460, y: 190, status: 'High' },
                              { id: 'ACU-PR-005', x: 190, y: 155, status: 'Low' },
                              { id: 'ACU-GD-006', x: 330, y: 185, status: 'High' },
                              { id: 'ACU-AS-007', x: 420, y: 100, status: 'High' },
                              { id: 'ACU-TM-008', x: 480, y: 225, status: 'Medium' },
                              { id: 'ACU-AD-009', x: 460, y: 245, status: 'High' },
                              { id: 'ACU-SH-010', x: 490, y: 275, status: 'Medium' },
                              { id: 'ACU-KB-011', x: 250, y: 120, status: 'High' },
                              { id: 'ACU-ANP-012', x: 290, y: 160, status: 'Low' },
                              { id: 'ACU-EG-013', x: 400, y: 75, status: 'High' },
                              { id: 'ACU-CR-014', x: 440, y: 65, status: 'High' },
                              { id: 'ACU-PG-015', x: 470, y: 210, status: 'Medium' }
                            ].map((pin) => (
                              <g key={pin.id} transform={`translate(${pin.x}, ${pin.y})`} className="cursor-pointer group">
                                {pin.status === 'High' && (
                                  <circle cx="0" cy="-14" r="8" fill="rgba(34, 197, 94, 0.25)" className="animate-ping" />
                                )}
                                <ellipse cx="0" cy="1" rx="4.5" ry="1.8" fill="rgba(0,0,0,0.6)" />
                                <path
                                  d="M 0 0 C -5 -7 -8 -13 0 -19 C 8 -13 5 -7 0 0 Z"
                                  fill={pin.status === 'High' ? '#22c55e' : pin.status === 'Medium' ? '#f59e0b' : '#ef4444'}
                                  stroke="#ffffff"
                                  strokeWidth="1.3"
                                  filter="url(#shadowPin)"
                                  className="transition-transform duration-200 group-hover:-translate-y-1"
                                />
                                <circle cx="0" cy="-12" r="3" fill="#ffffff" />
                                <circle cx="0" cy="-12" r="1.5" fill={pin.status === 'High' ? '#15803d' : pin.status === 'Medium' ? '#b45309' : '#b91c1c'} />
                              </g>
                            ))}
                          </svg>

                          <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
                            <button className="w-7 h-7 bg-[#0a0f1d]/90 hover:bg-white/10 border border-white/10 rounded-lg flex items-center justify-center text-xs text-white shadow-lg cursor-pointer backdrop-blur-sm">+</button>
                            <button className="w-7 h-7 bg-[#0a0f1d]/90 hover:bg-white/10 border border-white/10 rounded-lg flex items-center justify-center text-xs text-white shadow-lg cursor-pointer backdrop-blur-sm">−</button>
                            <button className="w-7 h-7 bg-[#0a0f1d]/90 hover:bg-white/10 border border-white/10 rounded-lg flex items-center justify-center text-xs text-white shadow-lg cursor-pointer backdrop-blur-sm mt-1">
                              <i className="fa-solid fa-expand text-[10px]" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Live CCTV Surveillance Feed with AI Object Boxes */
                        <div className="w-full h-full relative bg-black flex flex-col justify-center items-center">
                          <img src={selectedBillboard?.feedImage || "/anna_nagar_feed.png"} alt="CCTV Feed" className="w-full h-full object-cover opacity-80" />
                          {settings.overlayBoxes && boxes.map(box => (
                            <div
                              key={box.id}
                              className="absolute border border-blue-400 bg-blue-500/15 pointer-events-none flex flex-col justify-between"
                              style={{
                                left: `${box.x}%`,
                                top: `${box.y}%`,
                                width: `${box.w}%`,
                                height: `${box.h}%`,
                                transition: 'left 180ms linear, top 180ms linear'
                              }}
                            >
                              <span className="bg-blue-600 text-[8px] px-1 text-white leading-none font-bold uppercase self-start rounded-br">
                                {box.type} {box.conf}%
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Legend & Action Bar */}
                      <div className="p-3 border-t border-white/10 bg-[#080c16]/90 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-4 text-[11px] text-white/60">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> High Performance
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Medium Performance
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Low Performance
                          </span>
                        </div>

                        <button
                          onClick={onBackToProfile}
                          className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <span>View All Medias</span>
                          <i className="fa-solid fa-chevron-right text-[10px]" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Top Performing Medias (1 col width) */}
                  <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-xl min-h-[420px]">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-white font-heading">Top Performing Medias</h3>
                      <button onClick={onBackToProfile} className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer">
                        View All
                      </button>
                    </div>

                    <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1">
                      {sortedTopMedias.slice(0, 5).map((media, idx) => (
                        <div 
                          key={media.id || idx} 
                          onClick={() => onSelectBillboard && onSelectBillboard(media)}
                          className="bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-xl p-2.5 flex items-center justify-between transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <img src={media.image || '/anna_nagar_location.png'} alt={media.name} className="w-10 h-10 rounded-lg object-cover border border-white/10" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold text-white font-heading truncate max-w-[140px]">{media.name}</span>
                              <span className="text-[10px] text-white/40 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                {media.city || media.location || 'Chennai'}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] text-white/40 font-medium">Impressions</span>
                            <span className="text-xs font-bold text-white font-mono">{media.impressions || '245K'}</span>
                            <span className="text-[9px] text-emerald-400 font-bold">↑ {22 - idx * 3}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* ── 3. BOTTOM SECTION (3 COLUMNS) ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
                  
                  {/* Panel 1: Performance Overview Chart (5 cols) */}
                  <div className="lg:col-span-5 bg-[#0f1424]/90 border border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-white font-heading">Performance Overview</h3>
                      <div className="flex items-center bg-white/[0.04] p-0.5 rounded-lg border border-white/10 text-[10px]">
                        {['1H', '6H', '12H', '24H'].map((tf) => (
                          <button 
                            key={tf} 
                            onClick={() => setTimeFilter(tf)}
                            className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${timeFilter === tf ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white'}`}
                          >
                            {tf}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-[10px] mb-2 font-medium">
                      <span className="flex items-center gap-1.5 text-blue-400">
                        <span className="w-2 h-2 rounded-full bg-blue-500" /> Impressions
                      </span>
                      <span className="flex items-center gap-1.5 text-cyan-400">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" /> Vehicles
                      </span>
                      <span className="flex items-center gap-1.5 text-purple-400">
                        <span className="w-2 h-2 rounded-full bg-purple-500" /> Premium & Above
                      </span>
                    </div>

                    <div className="h-[180px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart 
                          data={activeChartData} 
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorImp" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorVeh" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorPrem" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="time" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v/1000}K`} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area type="monotone" dataKey="Impressions" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorImp)" />
                          <Area type="monotone" dataKey="Vehicles" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorVeh)" />
                          <Area type="monotone" dataKey="Premium" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorPrem)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Panel 2: Media Health Donut Chart (3 cols) */}
                  <div className="lg:col-span-3 bg-[#0f1424]/90 border border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
                    <h3 className="text-sm font-bold text-white font-heading mb-2">Media Health</h3>
                    
                    <div className="flex items-center justify-center gap-4 flex-1">
                      <div className="relative w-28 h-28 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'Online', value: onlineCount || 1, color: '#22c55e' },
                                { name: 'Offline', value: offlineCount, color: '#ef4444' },
                                { name: 'Maintenance', value: maintenanceCount, color: '#f59e0b' }
                              ]}
                              innerRadius={32}
                              outerRadius={44}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              <Cell key="0" fill="#22c55e" />
                              <Cell key="1" fill="#ef4444" />
                              <Cell key="2" fill="#f59e0b" />
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-lg font-black text-white font-mono">{totalMediasCount}</span>
                          <span className="text-[8px] text-white/40 uppercase">Total Medias</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-white/50">Online</span>
                            <span className="font-bold text-white text-xs font-mono">{onlineCount} ({onlinePct}%)</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-white/50">Offline</span>
                            <span className="font-bold text-white text-xs font-mono">{offlineCount} ({offlinePct}%)</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-white/50">Maintenance</span>
                            <span className="font-bold text-white text-xs font-mono">{maintenanceCount} ({maintenancePct}%)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Panel 3: Alerts List (4 cols) */}
                  <div className="lg:col-span-4 bg-[#0f1424]/90 border border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-white font-heading">Alerts</h3>
                      <button onClick={() => setActiveNav('alerts')} className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer">
                        View All
                      </button>
                    </div>

                    <div className="flex flex-col gap-2.5 flex-1">
                      {[
                        { type: 'CRITICAL', title: 'Camera Offline', target: 'Guindy Flyover Billboard #2', time: '10 min ago', icon: 'fa-triangle-exclamation', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
                        { type: 'WARNING', title: 'Low Storage', target: 'OMR – Sholinganallur', time: '25 min ago', icon: 'fa-triangle-exclamation', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                        { type: 'INFO', title: 'Maintenance Due', target: 'Anna Salai Junction', time: '1 hr ago', icon: 'fa-wrench', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' }
                      ].map((a, idx) => (
                        <div key={idx} className="bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-xl p-2.5 flex items-center justify-between transition-all">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0 border ${a.color}`}>
                              <i className={`fa-solid ${a.icon}`} />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold text-white truncate">{a.title}</span>
                              <span className="text-[10px] text-white/40 truncate">{a.target}</span>
                            </div>
                          </div>
                          <span className="text-[9px] text-white/30 whitespace-nowrap ml-2 font-mono">{a.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* ═══════════════════════════════════════════════════
               TRAFFIC OVERVIEW
            ═══════════════════════════════════════════════════ */}
            {activeNav === 'traffic' && (
              <iframe
                key={`${selectedBillboard?.billboard_code || selectedBillboard?.id || 'traffic-frame'}-${dbTrafficData ? 'data' : 'nodata'}`}
                src="/traffic_ui/index.html"
                title="Traffic Overview"
                className="w-full h-full border-none"
              />
            )}

            {/* ═══════════════════════════════════════════════════
               2. LOCATION OVERVIEW
            ═══════════════════════════════════════════════════ */}
            {activeNav === 'overview' && (
              <LocationIntelligence selectedBillboard={selectedBillboard} />
            )}

            {/* ═══════════════════════════════════════════════════
               3. CORRIDOR INTELLIGENCE
            ═══════════════════════════════════════════════════ */}
            {activeNav === 'corridor' && (
              <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                <div className="flex items-center justify-between flex-shrink-0">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">Junction Corridor Flow Matrix</h3>
                </div>

                {/* Corridor Comparison Table */}
                <div className="flex-grow bg-slate-900/60 border border-white/10 rounded-xl overflow-hidden flex flex-col shadow-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-[#080b15] text-white/45 border-b border-white/10 uppercase font-semibold text-[9.5px]">
                        <tr>
                          <th className="p-3">Corridor Description</th>
                          <th className="p-3">Average Speed</th>
                          <th className="p-3">Traffic Density</th>
                          <th className="p-3">Avg Dwell time</th>
                          <th className="p-3 font-mono">Busiest Hour</th>
                          <th className="p-3">Congestion Level</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {getCorridors().map((row, idx) => (
                          <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                            <td className="p-3 font-bold text-white/95">{row.name}</td>
                            <td className="p-3 font-mono text-white/80">{row.speed}</td>
                            <td className="p-3 font-mono text-white/80">{row.flow}</td>
                            <td className="p-3 font-mono text-white/80">{row.dwell}</td>
                            <td className="p-3 font-mono text-white/60">{row.peak}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${row.badge}`}>
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Speed vs Congestion metrics */}
                <div className="grid grid-cols-2 gap-4 h-[120px] flex-shrink-0">
                  <div className="bg-[#0f172a]/60 border border-white/10 rounded-xl p-3 flex flex-col justify-around shadow-lg">
                    <span className="text-[9.5px] text-cyan-400 font-bold uppercase tracking-wider">Corridor Congestion Average</span>
                    <div className="flex items-center justify-between text-[11px]">
                      <span>Mean Vehicular Speed: <strong className="text-white font-mono">30 km/h</strong></span>
                      <span>Average Delay Index: <strong className="text-yellow-400 font-mono">+12.4% vs last week</strong></span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-yellow-500 h-full rounded-full" style={{ width: '45%' }} />
                    </div>
                  </div>

                  <div className="bg-[#0f172a]/60 border border-white/10 rounded-xl p-3 flex flex-col justify-around shadow-lg">
                    <span className="text-[9.5px] text-purple-400 font-bold uppercase tracking-wider">AI Traffic recommendations</span>
                    <p className="text-[11.5px] text-white/50 leading-relaxed">{getCorridors()[2].name} displays severe delays on weekday evening hours. Auto-apply dynamic programmatic DOOH price modifiers to capture longer dwell margins.</p>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════
               4. ZONE COMPARISON
            ═══════════════════════════════════════════════════ */}
            {activeNav === 'zone' && (
              <div className="flex-grow flex flex-col gap-4 overflow-y-auto pr-1">
                <div className="flex items-center justify-between flex-shrink-0">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">Multi-Zone Dashboard Comparison</h3>
                  
                  {/* Select zone toggles */}
                  <div className="flex bg-[#121829] border border-white/10 rounded p-0.5 text-[9.5px]">
                    {[
                      { key: 'zoneA', label: 'Commercial Zone A' },
                      { key: 'zoneB', label: 'Retail Zone B' },
                      { key: 'zoneC', label: 'Transit Zone C' }
                    ].map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => setActiveZoneCompare(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))}
                        className={`px-3 py-1 rounded font-semibold transition-all !border-none !shadow-none ${
                          activeZoneCompare[opt.key] ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {/* Commercial Zone */}
                  {activeZoneCompare.zoneA && (
                    <div className="bg-[#0f172a]/60 border border-blue-500/30 rounded-xl p-4 flex flex-col justify-between shadow-lg h-[260px]">
                      <div>
                        <span className="text-[8px] font-bold text-white/40 block">ZONE A</span>
                        <h4 className="text-sm font-bold text-white mt-1">{getZones().zoneA}</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-[11px] border-t border-white/5 pt-3 my-2 flex-grow font-sans">
                        <div><span className="text-white/45 block">Daily Footfall:</span> <strong className="font-mono text-white/90">45,782</strong></div>
                        <div><span className="text-white/45 block">Vehicles count:</span> <strong className="font-mono text-white/90">32,605</strong></div>
                        <div><span className="text-white/45 block">Avg Dwell time:</span> <strong className="font-mono text-white/90">38 sec</strong></div>
                        <div><span className="text-white/45 block">Occupancy:</span> <strong className="font-mono text-white/90 text-emerald-400">92%</strong></div>
                        <div><span className="text-white/45 block">Campaign Reach:</span> <strong className="font-mono text-white/90">86.2K</strong></div>
                        <div><span className="text-white/45 block">Engagement:</span> <strong className="font-mono text-white/90 text-purple-400">89%</strong></div>
                      </div>
                      <div className="flex justify-between items-center border-t border-white/5 pt-3">
                        <span className="text-[10px] text-white/50">Performance ROI Yield:</span>
                        <strong className="text-sm text-blue-400 font-mono">2.4x</strong>
                      </div>
                    </div>
                  )}

                  {/* Retail Zone */}
                  {activeZoneCompare.zoneB && (
                    <div className="bg-[#0f172a]/60 border border-cyan-500/20 rounded-xl p-4 flex flex-col justify-between shadow-lg h-[260px]">
                      <div>
                        <span className="text-[8px] font-bold text-white/40 block">ZONE B</span>
                        <h4 className="text-sm font-bold text-white mt-1">{getZones().zoneB}</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-[11px] border-t border-white/5 pt-3 my-2 flex-grow font-sans">
                        <div><span className="text-white/45 block">Daily Footfall:</span> <strong className="font-mono text-white/90">38,120</strong></div>
                        <div><span className="text-white/45 block">Vehicles count:</span> <strong className="font-mono text-white/90">41,500</strong></div>
                        <div><span className="text-white/45 block">Avg Dwell time:</span> <strong className="font-mono text-white/90">52 sec</strong></div>
                        <div><span className="text-white/45 block">Occupancy:</span> <strong className="font-mono text-white/90 text-emerald-400">85%</strong></div>
                        <div><span className="text-white/45 block">Campaign Reach:</span> <strong className="font-mono text-white/90">72.4K</strong></div>
                        <div><span className="text-white/45 block">Engagement:</span> <strong className="font-mono text-white/90 text-purple-400">76%</strong></div>
                      </div>
                      <div className="flex justify-between items-center border-t border-white/5 pt-3">
                        <span className="text-[10px] text-white/50">Performance ROI Yield:</span>
                        <strong className="text-sm text-cyan-400 font-mono">1.9x</strong>
                      </div>
                    </div>
                  )}

                  {/* Transit Zone */}
                  {activeZoneCompare.zoneC && (
                    <div className="bg-[#0f172a]/60 border border-purple-500/20 rounded-xl p-4 flex flex-col justify-between shadow-lg h-[260px]">
                      <div>
                        <span className="text-[8px] font-bold text-white/40 block">ZONE C</span>
                        <h4 className="text-sm font-bold text-white mt-1">{getZones().zoneC}</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-[11px] border-t border-white/5 pt-3 my-2 flex-grow font-sans">
                        <div><span className="text-white/45 block">Daily Footfall:</span> <strong className="font-mono text-white/90">62,800</strong></div>
                        <div><span className="text-white/45 block">Vehicles count:</span> <strong className="font-mono text-white/90">14,200</strong></div>
                        <div><span className="text-white/45 block">Avg Dwell time:</span> <strong className="font-mono text-white/90">15 sec</strong></div>
                        <div><span className="text-white/45 block">Occupancy:</span> <strong className="font-mono text-white/90 text-emerald-400">74%</strong></div>
                        <div><span className="text-white/45 block">Campaign Reach:</span> <strong className="font-mono text-white/90">98.1K</strong></div>
                        <div><span className="text-white/45 block">Engagement:</span> <strong className="font-mono text-white/90 text-purple-400">62%</strong></div>
                      </div>
                      <div className="flex justify-between items-center border-t border-white/5 pt-3">
                        <span className="text-[10px] text-white/50">Performance ROI Yield:</span>
                        <strong className="text-sm text-purple-400 font-mono">1.4x</strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════
               5. HISTORICAL TRENDS
            ═══════════════════════════════════════════════════ */}
            {activeNav === 'historical' && (
              <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                <div className="flex items-center justify-between flex-shrink-0 font-sans">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">Historical Trend Analytics</h3>
                  
                  {/* Select Trend Toggles */}
                  <div className="flex bg-[#121829] border border-white/10 rounded p-0.5 text-[9.5px]">
                    {['day', 'week', 'month', 'year'].map(opt => (
                      <button
                        key={opt}
                        onClick={() => setHistoricalFilter(opt)}
                        className={`px-3 py-1 rounded font-semibold transition-all uppercase !border-none !shadow-none ${
                          historicalFilter === opt ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 bg-slate-900/60 border border-white/10 rounded-xl p-4 flex flex-col shadow-lg min-h-0">
                  <span className="text-[10px] text-white/45 mb-3 block">Impressions vs Billboard Occupancy Trend Matrix</span>
                  <div className="flex-grow w-full relative min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={
                          historicalFilter === 'day' 
                            ? HISTORICAL_DAILY 
                            : historicalFilter === 'week' 
                              ? HISTORICAL_WEEKLY 
                              : historicalFilter === 'month' 
                                ? HISTORICAL_MONTHLY 
                                : HISTORICAL_YEARLY
                        }
                        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                      >
                        <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }} />
                        <YAxis yAxisId="left" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fill: 'rgba(34,197,94,0.6)', fontSize: 9 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar yAxisId="left" dataKey="Impressions" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                        <Bar yAxisId="right" dataKey="Occupancy" fill="#22c55e" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════
               6. ALERTS
            ═══════════════════════════════════════════════════ */}
            {activeNav === 'alerts' && (
              <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">Node Status Alerts & Alarms</h3>

                {/* Telemetries */}
                <div className="grid grid-cols-5 gap-4">
                  {[
                    { title: 'GPU Core Load', val: '74%', desc: 'AI processing OK', color: 'text-blue-400' },
                    { title: 'Edge Temp', val: '58°C', desc: 'Thermal control clean', color: 'text-emerald-400' },
                    { title: 'CCTV Stream Health', val: '100%', desc: 'Camera offline alert: 0', color: 'text-cyan-400' },
                    { title: 'Network Latency', val: '12ms', desc: 'Signal ping active', color: 'text-violet-400' },
                    { title: 'Traffic Alerts', val: '2 Spike', desc: 'Corridor threshold alerts', color: 'text-amber-400' }
                  ].map((meter, idx) => (
                    <div key={idx} className="bg-[#0f172a]/60 border border-white/10 rounded-xl p-3.5 shadow-lg flex flex-col justify-between h-[100px]">
                      <span className="text-[9px] text-white/45 uppercase font-medium">{meter.title}</span>
                      <strong className={`text-2xl font-bold font-mono ${meter.color}`}>{meter.val}</strong>
                      <span className="text-[8.5px] text-white/30 truncate leading-none">{meter.desc}</span>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4 flex flex-col shadow-lg flex-grow">
                  <span className="text-[10px] text-white/40 mb-3 block">Live Device Logs & Event Status Indicators</span>
                  <div className="flex flex-col gap-2 overflow-y-auto max-h-[300px]">
                    {alerts.map(alert => alert.active && (
                      <div key={alert.id} className="flex items-center justify-between bg-white/[0.01] border border-white/5 p-3 rounded-lg hover:bg-white/[0.02] transition-all">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                            alert.type === 'CRITICAL' 
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                              : alert.type === 'WARNING' 
                                ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' 
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {alert.type}
                          </span>
                          <div className="flex flex-col text-[11px]">
                            <strong className="text-white/95">{alert.title}</strong>
                            <span className="text-white/45 mt-0.5">{alert.target} • {alert.time}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => dismissAlert(alert.id)}
                          className="text-[9.5px] font-semibold text-blue-400 hover:text-blue-300 transition-colors px-2.5 py-1 bg-white/[0.02] hover:bg-white/5 rounded border border-white/5 !shadow-none !outline-none"
                        >
                          Dismiss Event
                        </button>
                      </div>
                    ))}
                    {alerts.filter(a => a.active).length === 0 && (
                      <div className="text-center py-6 text-xs text-white/30">
                        All clear. No active alerts on edge network.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════
               7. Reports
            ═══════════════════════════════════════════════════ */}
            {activeNav === 'reports' && (
              <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">Campaign Report compiler</h3>

                <div className="grid grid-cols-[1.2fr_1.8fr] gap-4 min-h-[300px]">
                  {/* Query config panel */}
                  <form onSubmit={handleGenerateReport} className="bg-slate-900/60 border border-white/10 rounded-xl p-4 flex flex-col justify-between shadow-lg h-full">
                    <div className="flex flex-col gap-3">
                      <span className="text-[10px] text-white/45 uppercase font-medium">Report Configuration</span>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] text-white/50">Start Date</label>
                          <input type="date" defaultValue="2026-07-01" className="bg-[#121829] border border-white/10 rounded px-2.5 py-1.5 text-[11px] text-white/80 focus:outline-none" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] text-white/50">End Date</label>
                          <input type="date" defaultValue="2026-07-11" className="bg-[#121829] border border-white/10 rounded px-2.5 py-1.5 text-[11px] text-white/80 focus:outline-none" />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-white/50">Frequency Scope</label>
                        <select 
                          value={reportType} 
                          onChange={(e) => setReportType(e.target.value)} 
                          className="bg-[#121829] border border-white/10 rounded px-2.5 py-1.5 text-[11px] text-white/80 focus:outline-none"
                        >
                          <option value="weekly">Weekly Summary</option>
                          <option value="monthly">Monthly Comprehensive</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-white/50">Streams check list</label>
                        <div className="flex flex-col gap-1.5 text-[10px] mt-1 font-sans">
                          {['Footfall & Impression counts', 'Average Dwell Duration', 'Vehicular Speed & Traffic count', 'Occupancy & Pricing modifier'].map(lbl => (
                            <label key={lbl} className="flex items-center gap-2 cursor-pointer text-white/70 hover:text-white">
                              <input type="checkbox" defaultChecked className="rounded border-white/10 bg-slate-800 w-3 h-3 cursor-pointer" />
                              <span>{lbl}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <button 
                        type="submit" 
                        disabled={generatingReport}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded text-[11px] border-none shadow-md transition-all flex items-center justify-center gap-1.5"
                      >
                        {generatingReport ? (
                          <>
                            <i className="fa-solid fa-spinner animate-spin" />
                            Compiling Data streams...
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-file-pdf" />
                            Generate Report PDF
                          </>
                        )}
                      </button>
                    </div>
                  </form>

                  {/* Preview generated report logs */}
                  <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4 flex flex-col justify-between shadow-lg h-full">
                    <div>
                      <span className="text-[10px] text-white/45 uppercase font-medium mb-3 block">Reports log history</span>
                      <div className="flex flex-col gap-2 overflow-y-auto max-h-[220px]">
                        {reportsList.map(rep => (
                          <div key={rep.id} className="flex items-center justify-between bg-white/[0.01] border border-white/5 p-2.5 rounded-lg text-[10.5px] hover:bg-white/[0.02]">
                            <div className="flex flex-col">
                              <strong className="text-white/95 truncate max-w-[200px]">{rep.name}</strong>
                              <span className="text-white/45 mt-0.5 font-mono">{rep.id} • {rep.date} • {rep.size}</span>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => downloadReportAsPDF(rep)}
                                className="px-2 py-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/10 rounded text-[9.5px] font-semibold flex items-center gap-1 !shadow-none !outline-none transition-all"
                                title="Download Location & Traffic Overview"
                              >
                                <i className="fa-solid fa-download" /> PDF
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════
               8. DATA EXPORT
            ═══════════════════════════════════════════════════ */}
            {activeNav === 'export' && (
              <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">Raw Data Streams Exporter</h3>

                <div className="grid grid-cols-[1fr_2fr] gap-4">
                  {/* Format config panel */}
                  <form onSubmit={handleExportData} className="bg-slate-900/60 border border-white/10 rounded-xl p-4 flex flex-col justify-between shadow-lg h-[240px]">
                    <div className="flex flex-col gap-3">
                      <span className="text-[10px] text-white/45 uppercase font-medium">Export Query Settings</span>
                      
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-white/55">Target Format</label>
                        <div className="flex items-center gap-4 mt-0.5 text-[10.5px]">
                          {['csv', 'xlsx', 'pdf'].map(fmt => (
                            <label key={fmt} className="flex items-center gap-1.5 cursor-pointer">
                              <input 
                                type="radio" 
                                name="format" 
                                checked={exportFormat === fmt} 
                                onChange={() => setExportFormat(fmt)}
                                className="w-3 h-3 bg-slate-800 border-white/10 cursor-pointer" 
                              />
                              <span className="uppercase font-bold">{fmt}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <button 
                        type="submit" 
                        disabled={exportingData}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded text-[11px] border-none shadow-md transition-all flex items-center justify-center gap-1.5"
                      >
                        {exportingData ? (
                          <>
                            <i className="fa-solid fa-spinner animate-spin" />
                            Packaging dataset...
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-file-export" />
                            Start Export Download
                          </>
                        )}
                      </button>
                      {exportSuccess && (
                        <p className="text-[10.5px] text-emerald-400 font-semibold text-center mt-2 flex items-center justify-center gap-1">
                          <i className="fa-solid fa-circle-check" />
                          Download completed successfully!
                        </p>
                      )}
                    </div>
                  </form>

                  {/* Raw data preview mock grid */}
                  <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4 flex flex-col shadow-lg h-[240px]">
                    <span className="text-[10px] text-white/45 uppercase font-medium mb-2.5">Raw Data Stream Preview (Live)</span>
                    <div className="flex-grow overflow-auto border border-white/5 rounded">
                      <table className="w-full text-left text-[9.5px] font-mono">
                        <thead className="bg-[#080b15] text-white/40 border-b border-white/10 sticky top-0 uppercase">
                          <tr>
                            <th className="p-2">Timestamp</th>
                            <th className="p-2">Vehicles/min</th>
                            <th className="p-2">Pedestrians/min</th>
                            <th className="p-2">AvgDwell(s)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-white/70">
                          {[
                            { time: '11:44:15 AM', v: Math.round(liveVehicles / 60) || 12, p: Math.round(livePeople / 60) || 20, d: Math.round(liveDwell) },
                            { time: '11:44:00 AM', v: Math.round(liveVehicles / 60 - 2) || 10, p: Math.round(livePeople / 60 - 3) || 17, d: Math.round(liveDwell + 2) },
                            { time: '11:43:45 AM', v: Math.round(liveVehicles / 60 + 1) || 13, p: Math.round(livePeople / 60 + 2) || 22, d: Math.round(liveDwell - 1) },
                            { time: '11:43:30 AM', v: Math.round(liveVehicles / 60 - 1) || 11, p: Math.round(livePeople / 60 - 1) || 19, d: Math.round(liveDwell + 1) },
                            { time: '11:43:15 AM', v: Math.round(liveVehicles / 60 + 2) || 14, p: Math.round(livePeople / 60 + 4) || 24, d: Math.round(liveDwell - 2) }
                          ].map((row, idx) => (
                            <tr key={idx} className="hover:bg-white/[0.01]">
                              <td className="p-2">{row.time}</td>
                              <td className="p-2">{row.v}</td>
                              <td className="p-2">{row.p}</td>
                              <td className="p-2">{row.d}s</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════
               9. SETTINGS
            ═══════════════════════════════════════════════════ */}
            {activeNav === 'settings' && (
              <form onSubmit={handleSaveSettings} className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex-shrink-0">Settings Dashboard</h3>

                <div className="bg-slate-900/60 border border-white/10 rounded-xl p-5 flex flex-col gap-4 shadow-lg">
                  <span className="text-[10px] text-white/45 uppercase font-medium">Dashboard Preferences</span>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-white/50">Telemetry refresh rate</label>
                      <select 
                        value={settings.refreshInterval} 
                        onChange={(e) => setSettings({ ...settings, refreshInterval: e.target.value })}
                        className="bg-[#121829] border border-white/10 rounded px-2.5 py-1.5 text-[11.5px] text-white/80 focus:outline-none"
                      >
                        <option value="1s">High Frequency (1 second)</option>
                        <option value="5s">Standard (5 seconds)</option>
                        <option value="10s">Extended (10 seconds)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-white/50">Vector Map Visual Style</label>
                      <select 
                        value={settings.mapStyle} 
                        onChange={(e) => setSettings({ ...settings, mapStyle: e.target.value })}
                        className="bg-[#121829] border border-white/10 rounded px-2.5 py-1.5 text-[11.5px] text-white/80 focus:outline-none"
                      >
                        <option value="dark-gps">Futuristic Dark GPS</option>
                        <option value="vector-lines">Monochrome Vector</option>
                      </select>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-3 flex flex-col gap-2.5">
                    <label className="flex items-center gap-2.5 text-[11px] cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={settings.overlayBoxes} 
                        onChange={(e) => setSettings({ ...settings, overlayBoxes: e.target.checked })}
                        className="rounded border-white/10 bg-slate-800 w-3.5 h-3.5 cursor-pointer" 
                      />
                      <span>Show live AI tracking bounding box labels on CCTV feeds</span>
                    </label>

                    <label className="flex items-center gap-2.5 text-[11px] cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={settings.notifications} 
                        onChange={(e) => setSettings({ ...settings, notifications: e.target.checked })}
                        className="rounded border-white/10 bg-slate-800 w-3.5 h-3.5 cursor-pointer" 
                      />
                      <span>Enable audio signals and visual indicators for critical threshold alerts</span>
                    </label>
                  </div>

                  <div className="flex justify-between items-center border-t border-white/5 pt-4 mt-2">
                    <span className="text-[10.5px] text-emerald-400 font-semibold">
                      {saveSuccess && (
                        <>
                          <i className="fa-solid fa-circle-check" /> Console configurations updated successfully!
                        </>
                      )}
                    </span>
                    <button 
                      type="submit" 
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded text-[11px] border-none shadow-md transition-all !shadow-none !outline-none"
                    >
                      Apply Settings
                    </button>
                  </div>
                </div>
              </form>
            )}

          </main>

          {/* ═══════════════════════════════════════════════════
             FOOTER STATUS BAR (h-[40px])
          ═══════════════════════════════════════════════════ */}
          <footer className="h-[40px] border-t border-white/10 px-6 flex items-center justify-between bg-[#05070f] text-[10px] text-white/35 flex-shrink-0 w-full">
            <div className="flex items-center gap-1.5 font-semibold text-[#22c55e]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shadow-[0_0_5px_rgba(34,197,94,0.6)]"></span>
              All hardware nodes operational
            </div>
            
            <div className="font-medium text-white/30 text-center truncate px-2">
              Aculion Location Intelligence Platform <span className="mx-2 text-white/10">|</span> Real-time human & mobility insights
            </div>

            <div className="flex items-center gap-1.5 font-semibold text-blue-400/80 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.6)] animate-pulse"></span>
              Data updates every {settings.refreshInterval}
            </div>
          </footer>

        </div>

      </div>

    </div>
  );
}
