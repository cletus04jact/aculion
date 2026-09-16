import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  billboardService, 
  formatISTDateTime, 
  formatDuration, 
  formatFileSize, 
  getNextScheduledRecordingTime 
} from '../services/billboard.service';

/**
 * FrontCameraView Component
 * Displays the latest recorded 5-minute front camera footage for the selected billboard.
 * Retains only the latest footage per billboard from the private 'billboard-recordings' Supabase storage bucket.
 */
export default function FrontCameraView({
  selectedBillboard,
  billboards = [],
  onSelectBillboard,
  user,
}) {
  const [recordingData, setRecordingData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Keep current time updated for next scheduled recording calculation
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const [dbBillboards, setDbBillboards] = useState(billboards);

  // Always fetch real billboards from public.billboards on mount
  useEffect(() => {
    billboardService.getBillboards().then((rows) => {
      if (rows && rows.length > 0) {
        setDbBillboards(rows);
      }
    }).catch((err) => {
      console.error('[FrontCameraView] Error fetching billboards:', err);
    });
  }, []);

  const effectiveBillboards = useMemo(() => {
    if (dbBillboards && dbBillboards.length > 0) return dbBillboards;
    if (billboards && billboards.length > 0) return billboards;
    return [];
  }, [dbBillboards, billboards]);

  const activeBillboard = useMemo(() => {
    if (selectedBillboard) {
      // If selectedBillboard is matched in effectiveBillboards, use it
      const match = effectiveBillboards.find(
        (b) => (b.billboard_code || b.id) === (selectedBillboard.billboard_code || selectedBillboard.id)
      );
      if (match) return match;
      return selectedBillboard;
    }
    return effectiveBillboards.length > 0 ? effectiveBillboards[0] : null;
  }, [selectedBillboard, effectiveBillboards]);

  const currentBillboardCode = useMemo(() => {
    return activeBillboard?.billboard_code || activeBillboard?.id || '';
  }, [activeBillboard]);

  const currentBillboardName = useMemo(() => {
    return activeBillboard?.billboard_name || activeBillboard?.name || 'Selected Billboard';
  }, [activeBillboard]);

  const cameraFFCode = useMemo(() => {
    return (
      recordingData?.camera_ff_code ||
      activeBillboard?.camera_ff_code ||
      activeBillboard?.cameraCodeFF ||
      activeBillboard?.camera_id ||
      'CAM-FF-001'
    );
  }, [recordingData, activeBillboard]);

  // Next scheduled recording calculation (IST: 08:00 AM, 01:00 PM, 06:00 PM)
  const nextScheduled = useMemo(() => {
    return getNextScheduledRecordingTime(currentTime);
  }, [currentTime]);

  // Fetch the latest recording from Supabase database & storage
  const fetchRecording = useCallback(async (showRefreshingState = false) => {
    if (!currentBillboardCode) {
      setRecordingData(null);
      setErrorMessage('Select a billboard to view its latest footage.');
      return;
    }

    if (showRefreshingState) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage('');

    try {
      const data = await billboardService.getLatestRecording(currentBillboardCode);
      if (!data) {
        setRecordingData(null);
        setErrorMessage('No recorded footage is available for this billboard yet.');
      } else if (data.status === 'uploading') {
        setRecordingData(data);
        setErrorMessage('The latest footage is still being uploaded.\nPlease check again shortly.');
      } else if (data.status === 'failed') {
        setRecordingData(data);
        setErrorMessage('The latest recording is currently unavailable.');
      } else if (data.error) {
        setRecordingData(data);
        setErrorMessage(data.error);
      } else {
        setRecordingData(data);
        setErrorMessage('');
      }
    } catch (err) {
      console.error('[FrontCameraView] Error fetching recording:', err);
      setRecordingData(null);
      setErrorMessage('The latest recording is currently unavailable.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentBillboardCode]);

  // Fetch on mount or whenever the selected billboard changes
  useEffect(() => {
    fetchRecording(false);
  }, [fetchRecording]);

  const handleDropdownChange = (e) => {
    const targetCode = e.target.value;
    const match = effectiveBillboards.find(
      (b) => (b.billboard_code || b.id) === targetCode
    );
    if (match && onSelectBillboard) {
      onSelectBillboard(match);
    }
  };

  const handleRefresh = () => {
    fetchRecording(true);
  };

  return (
    <div className="flex-1 flex flex-col p-6 gap-6 min-w-0 bg-[#070913] text-white overflow-y-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/10">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-white tracking-wide font-heading uppercase flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
              Front Camera
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30 uppercase">
              Radxa Edge HD
            </span>
          </div>
          <p className="text-xs text-white/50 font-medium mt-1">
            View the latest recorded billboard footage uploaded by the front-facing camera.
          </p>
        </div>

        {/* Action Controls: Refresh & Storage Indicator */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 bg-[#0f1424]/90 border border-white/10 rounded-xl px-3 py-1.5 text-[11px] text-white/70">
            <i className="fa-solid fa-cloud-arrow-up text-cyan-400 text-xs" />
            <span className="font-mono">Storage: billboard-recordings</span>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            title="Refresh latest recording"
            className="px-3.5 py-2 rounded-xl bg-[#0f1424]/90 hover:bg-blue-600/20 text-white/80 hover:text-white border border-white/10 hover:border-blue-500/40 text-xs font-semibold transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
          >
            <i className={`fa-solid fa-arrows-rotate text-xs text-blue-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ── Billboard Selector Bar ── */}
      <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
          <label htmlFor="billboard-select" className="text-xs font-bold text-white/70 uppercase tracking-wider flex items-center gap-2">
            <i className="fa-solid fa-tv text-blue-400 text-xs" />
            Select Billboard:
          </label>
          <div className="relative min-w-[280px] max-w-full sm:max-w-md">
            <select
              id="billboard-select"
              value={currentBillboardCode}
              onChange={handleDropdownChange}
              className="w-full appearance-none bg-[#070913] text-white text-xs font-medium rounded-xl px-4 py-2.5 pr-10 border border-white/15 hover:border-blue-500/50 focus:border-blue-500 focus:outline-none transition-all cursor-pointer shadow-inner"
            >
              {effectiveBillboards.length === 0 ? (
                <option value="">No billboards registered</option>
              ) : (
                effectiveBillboards.map((b) => {
                  const code = b.billboard_code || b.id;
                  const name = b.billboard_name || b.name || code;
                  return (
                    <option key={code} value={code} className="bg-[#0f1424] text-white">
                      {code} — {name}
                    </option>
                  );
                })
              )}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-white/40">
              <i className="fa-solid fa-chevron-down text-xs" />
            </div>
          </div>
        </div>

        {/* Selected Billboard Quick Tags */}
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 font-mono font-medium">
            <i className="fa-solid fa-barcode mr-1.5 text-[10px]" />
            {currentBillboardCode || 'No Billboard'}
          </span>
          <span className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono font-medium">
            <i className="fa-solid fa-video mr-1.5 text-[10px]" />
            Camera: {cameraFFCode}
          </span>
          {selectedBillboard?.city && (
            <span className="px-3 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-white/60 font-medium">
              <i className="fa-solid fa-location-dot mr-1.5 text-red-400 text-[10px]" />
              {selectedBillboard.city}
            </span>
          )}
        </div>
      </div>

      {/* ── Main Video Area & Metadata ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (8 cols): Video Player Card */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 relative overflow-hidden">
            {/* Video Player Card Header */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-blue-500 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></div>
                </div>
                <h3 className="text-sm font-bold text-white tracking-wide font-heading">
                  Latest 5-Minute Front Camera Footage
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-white/[0.06] text-white/70 border border-white/10">
                  1080p • 30 FPS
                </span>
                {recordingData?.status === 'completed' && !errorMessage && (
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Latest footage available
                  </span>
                )}
                {recordingData?.status === 'uploading' && (
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 animate-pulse">
                    Uploading
                  </span>
                )}
              </div>
            </div>

            {/* Video Player Box */}
            <div className="relative w-full aspect-video bg-black/95 rounded-xl overflow-hidden border border-white/10 flex items-center justify-center shadow-inner group">
              {/* 1. Loading State */}
              {isLoading && (
                <div className="flex flex-col items-center justify-center p-8 gap-3 text-center">
                  <div className="w-12 h-12 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
                  <span className="text-xs font-bold uppercase tracking-wider text-white/80 font-heading">
                    Synchronizing Footage
                  </span>
                  <p className="text-[11px] text-white/40 font-mono">
                    Generating signed video playback URL from storage...
                  </p>
                </div>
              )}

              {/* 2. Error / Empty / Uploading States */}
              {!isLoading && errorMessage && (
                <div className="flex flex-col items-center justify-center p-8 gap-3 text-center max-w-md">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-white/60 mb-1">
                    {recordingData?.status === 'uploading' ? (
                      <i className="fa-solid fa-cloud-arrow-up text-2xl text-yellow-400 animate-bounce" />
                    ) : !currentBillboardCode ? (
                      <i className="fa-solid fa-tv text-2xl text-blue-400" />
                    ) : (
                      <i className="fa-solid fa-video-slash text-2xl text-white/40" />
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-white tracking-wide font-heading">
                    {recordingData?.status === 'uploading'
                      ? 'Footage Upload in Progress'
                      : !currentBillboardCode
                      ? 'No Billboard Selected'
                      : recordingData?.status === 'failed'
                      ? 'Recording Unavailable'
                      : 'No Recording Available'}
                  </h4>
                  <p className="text-xs text-white/50 leading-relaxed whitespace-pre-line font-medium">
                    {errorMessage}
                  </p>
                  <button
                    onClick={handleRefresh}
                    className="mt-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <i className="fa-solid fa-arrows-rotate text-xs" />
                    <span>Check Again</span>
                  </button>
                </div>
              )}

              {/* 3. Completed State: Native HTML5 Video Player */}
              {!isLoading && !errorMessage && recordingData?.video_url && (
                <>
                  <video
                    key={recordingData.video_url}
                    src={recordingData.video_url}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-contain bg-black"
                  >
                    Your browser does not support HTML5 video playback.
                  </video>

                  {/* Watermark Overlay on Video Top-Left */}
                  <div className="pointer-events-none absolute top-3 left-3 bg-[#080c16]/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-2 text-[10px] font-mono text-white/90 shadow-md">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span className="font-bold">{currentBillboardCode}</span>
                    <span className="text-white/40">|</span>
                    <span className="text-white/70">{cameraFFCode}</span>
                  </div>

                  {/* Timestamp Overlay on Video Top-Right */}
                  <div className="pointer-events-none absolute top-3 right-3 bg-[#080c16]/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-[10px] font-mono text-white/70 shadow-md">
                    {formatISTDateTime(recordingData.recorded_at)}
                  </div>
                </>
              )}
            </div>

            {/* Video Player Footer Note */}
            <div className="flex items-center justify-between text-[11px] text-white/40 pt-1">
              <span className="flex items-center gap-1.5">
                <i className="fa-solid fa-shield-halved text-blue-400 text-xs" />
                Private encrypted stream token expires in 1 hour
              </span>
              <span className="font-mono">
                Storage Path: {recordingData?.storage_path || `${currentBillboardCode || 'bb'}/latest.mp4`}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Metadata KPIs & Schedule */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          
          {/* Metadata Card: Recorded at */}
          <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-4 flex flex-col justify-between shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">Recorded At</span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xs">
                <i className="fa-regular fa-clock" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-base font-bold text-white font-mono block">
                {formatISTDateTime(recordingData?.recorded_at)}
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-white/40 font-medium mt-1">
                <span>Timestamp logged by Radxa edge</span>
              </div>
            </div>
          </div>

          {/* Metadata Card: Last updated at */}
          <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-4 flex flex-col justify-between shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">Last Updated At</span>
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-xs">
                <i className="fa-solid fa-cloud-arrow-up" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-base font-bold text-white font-mono block">
                {formatISTDateTime(recordingData?.uploaded_at || recordingData?.updated_at)}
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-white/40 font-medium mt-1">
                <span>Supabase Storage upload completion</span>
              </div>
            </div>
          </div>

          {/* Metadata Card: Next Scheduled Recording */}
          <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-4 flex flex-col justify-between shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">Next Stream Video</span>
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-xs">
                <i className="fa-regular fa-calendar-days" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-base font-bold text-purple-300 font-mono block">
                {nextScheduled.formattedText}
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-white/40 font-medium mt-1">
                <i className="fa-solid fa-circle-info text-[9px] text-purple-400" />
                <span>Scheduled slot (08:00 AM, 01:00 PM, 06:00 PM IST)</span>
              </div>
            </div>
          </div>

          {/* Metadata Card: Duration & Status */}
          <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-4 flex flex-col justify-between shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">Duration & Status</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs">
                <i className="fa-solid fa-stopwatch" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between">
                <span className="text-xl font-black text-white font-mono">
                  {formatDuration(recordingData?.duration_seconds || 300)}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono ${
                  recordingData?.status === 'completed'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : recordingData?.status === 'uploading'
                    ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
                    : 'bg-white/10 text-white/60 border border-white/10'
                }`}>
                  {recordingData?.status === 'completed'
                    ? 'Latest footage available'
                    : recordingData?.status || 'No Footage'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-white/40 font-medium mt-2 pt-2 border-t border-white/5">
                <span>File Size: <strong className="text-white/80 font-mono">{formatFileSize(recordingData?.file_size_bytes)}</strong></span>
                <span>Retention: <strong className="text-white/80">Latest Only</strong></span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
