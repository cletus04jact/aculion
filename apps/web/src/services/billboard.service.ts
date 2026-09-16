/**
 * billboard.service.ts
 * Supabase-backed Billboard service layer.
 * Replaces mock/stub implementation with actual calls to the `billboards` table.
 */
import { Billboard } from "../types/location";
import { supabase } from "./supabase";

function mapDbRecordToBillboard(record: any): Billboard {
  return {
    id: record.id,
    billboard_id: record.id,
    billboard_code: record.billboard_code,
    camera_id: record.camera_ff_code || record.camera_bf_code || '',
    client_id: record.owner_id,
    name: record.billboard_name,
    billboard_name: record.billboard_name,
    billboard_location: record.location_landmark,
    street_address: record.street_address,
    city: record.city,
    location: record.location_landmark,
    latitude: Number(record.latitude),
    longitude: Number(record.longitude),
    status: record.status || 'Active',
    type: record.billboard_type || 'Digital Billboard',
    width: 40,
    height: 20,
    image: '/blog_smart_city.png',
    campaign: {
      name: "Nike OOH Campaign",
      owner: "Nike India",
      startDate: "2026-08-01",
      endDate: "2026-09-01",
      duration: 30,
      status: "Running" as const,
    },
    lastUpdated: record.updated_at || new Date().toISOString(),
  } as any;
}

export const billboardService = {
  getBillboards: async (): Promise<Billboard[]> => {
    const { data, error } = await supabase
      .from("billboards")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[billboardService] Error fetching billboards:", error);
      throw new Error(error.message || "Failed to fetch billboards.");
    }

    return (data || []).map(mapDbRecordToBillboard);
  },

  getBillboardById: async (id: string): Promise<Billboard> => {
    const { data, error } = await supabase
      .from("billboards")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[billboardService] Error fetching billboard by ID:", error);
      throw new Error(error.message || "Failed to fetch billboard.");
    }

    if (!data) {
      throw new Error(`Billboard with ID ${id} not found.`);
    }

    return mapDbRecordToBillboard(data);
  },

  invalidateCache: () => {
    // No-op
  },

  createBillboard: async (billboardData: {
    name: string;
    id?: string;
    location: string;
    address?: string;
    city?: string;
    type?: string;
    category?: string;
    status?: string;
    latitude: number;
    longitude: number;
    cameraCodeFF?: string;
    cameraCodeBF?: string;
    ownerId?: string;
  }): Promise<Billboard> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication required to register a billboard.");

    const insertData = {
      billboard_code: billboardData.id || null,
      owner_id: billboardData.ownerId || user.id,
      billboard_name: billboardData.name || "New Billboard",
      camera_ff_code: billboardData.cameraCodeFF || null,
      camera_bf_code: billboardData.cameraCodeBF || null,
      billboard_type: billboardData.type || billboardData.category || 'Digital Billboard',
      location_landmark: billboardData.location || "Junction",
      street_address: billboardData.address || billboardData.location || "Street Address",
      latitude: Number(billboardData.latitude),
      longitude: Number(billboardData.longitude),
      city: billboardData.city || "Chennai",
      status: billboardData.status || "Active"
    };

    const { data, error } = await supabase
      .from("billboards")
      .insert(insertData)
      .select("*")
      .single();

    if (error) {
      console.error("[billboardService] Error creating billboard:", error);
      throw new Error(error.message || "Failed to create billboard.");
    }

    return mapDbRecordToBillboard(data);
  },

  updateBillboard: async (id: string, billboardData: any): Promise<Billboard> => {
    const updateData: any = {};
    if (billboardData.name !== undefined) updateData.billboard_name = billboardData.name;
    if (billboardData.type !== undefined) updateData.billboard_type = billboardData.type;
    if (billboardData.category !== undefined) updateData.billboard_type = billboardData.category;
    if (billboardData.location !== undefined) updateData.location_landmark = billboardData.location;
    if (billboardData.address !== undefined) updateData.street_address = billboardData.address;
    if (billboardData.latitude !== undefined) updateData.latitude = Number(billboardData.latitude);
    if (billboardData.longitude !== undefined) updateData.longitude = Number(billboardData.longitude);
    if (billboardData.city !== undefined) updateData.city = billboardData.city;
    if (billboardData.status !== undefined) updateData.status = billboardData.status;
    if (billboardData.cameraCodeFF !== undefined) updateData.camera_ff_code = billboardData.cameraCodeFF;
    if (billboardData.cameraCodeBF !== undefined) updateData.camera_bf_code = billboardData.cameraCodeBF;

    const { data, error } = await supabase
      .from("billboards")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("[billboardService] Error updating billboard:", error);
      throw new Error(error.message || "Failed to update billboard.");
    }

    return mapDbRecordToBillboard(data);
  },

  deleteBillboard: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from("billboards")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[billboardService] Error deleting billboard:", error);
      throw new Error(error.message || "Failed to delete billboard.");
    }
  },

  getTrafficOverview: async (billboardCode: string): Promise<any> => {
    const { data, error } = await supabase
      .from("traffic_overview")
      .select("*")
      .eq("billboard_code", billboardCode)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[billboardService] Error fetching traffic overview:", error);
      throw new Error(error.message || "Failed to fetch traffic overview.");
    }

    return data;
  },

  /**
   * Fetch latest completed recording metadata and temporary signed URL for a billboard.
   */
  getLatestRecording: async (billboardCode: string): Promise<BillboardRecordingData | null> => {
    if (!billboardCode) return null;

    try {
      // 1. Try fetching metadata from billboard_latest_recordings
      const { data, error } = await supabase
        .from("billboard_latest_recordings")
        .select(
          "billboard_code, camera_ff_code, storage_path, recorded_at, uploaded_at, duration_seconds, file_name, file_size_bytes, status, updated_at"
        )
        .eq("billboard_code", billboardCode)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn("[billboardService] Notice fetching latest recording from DB:", error);
      }

      const storagePath = data?.storage_path || `${billboardCode}/latest.mp4`;
      let videoUrl: string | null = null;
      let signedUrlError: string | null = null;

      // 2. Generate signed URL from private bucket 'billboard-recordings'
      const { data: signedData, error: storageError } = await supabase.storage
        .from("billboard-recordings")
        .createSignedUrl(storagePath, 3600);

      if (signedData?.signedUrl) {
        videoUrl = signedData.signedUrl;
      } else if (data?.status === "completed") {
        console.error("[billboardService] Error creating signed URL:", storageError);
        signedUrlError = "Unable to generate the video playback URL. Please try again.";
      }

      // 3. If DB row exists, return it with generated videoUrl
      if (data) {
        return {
          billboard_code: data.billboard_code,
          camera_ff_code: data.camera_ff_code || null,
          storage_path: data.storage_path,
          recorded_at: data.recorded_at,
          uploaded_at: data.uploaded_at,
          duration_seconds: data.duration_seconds || 300,
          file_name: data.file_name || "latest.mp4",
          file_size_bytes: data.file_size_bytes,
          status: data.status || (videoUrl ? "completed" : "failed"),
          updated_at: data.updated_at,
          video_url: videoUrl,
          error: signedUrlError,
        };
      }

      // 4. Fallback: If DB row doesn't exist yet but file is in Storage, construct recording data
      if (videoUrl) {
        return {
          billboard_code: billboardCode,
          camera_ff_code: "CAM-FF-001",
          storage_path: storagePath,
          recorded_at: new Date().toISOString(),
          uploaded_at: new Date().toISOString(),
          duration_seconds: 300,
          file_name: "latest.mp4",
          file_size_bytes: null,
          status: "completed",
          updated_at: new Date().toISOString(),
          video_url: videoUrl,
          error: null,
        };
      }

      return null;
    } catch (err: any) {
      console.error("[billboardService] Error in getLatestRecording:", err);
      throw err;
    }
  },
};

export interface BillboardRecordingData {
  billboard_code: string;
  camera_ff_code: string | null;
  storage_path: string;
  recorded_at: string | null;
  uploaded_at: string | null;
  duration_seconds: number | null;
  file_name: string | null;
  file_size_bytes: number | null;
  status: string;
  updated_at: string | null;
  video_url?: string | null;
  error?: string | null;
}

/**
 * Format timestamp in Asia/Kolkata timezone (IST) as e.g. "16 Sep 2026, 8:05 AM"
 */
export function formatISTDateTime(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "—";

    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(d);

    let day = "";
    let monthNum = 1;
    let year = "";
    let hour = "";
    let minute = "";
    let dayPeriod = "";

    for (const p of parts) {
      if (p.type === "day") day = p.value;
      if (p.type === "month") monthNum = parseInt(p.value, 10);
      if (p.type === "year") year = p.value;
      if (p.type === "hour") hour = p.value;
      if (p.type === "minute") minute = p.value;
      if (p.type === "dayPeriod") dayPeriod = p.value.toUpperCase();
    }

    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const month = months[monthNum - 1] || "Jan";

    return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod}`;
  } catch (e) {
    return "—";
  }
}

/**
 * Format duration in seconds to "5 minutes" or "X min Y sec"
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(Number(seconds))) return "—";
  const totalSecs = Math.round(Number(seconds));
  if (totalSecs <= 0) return "0 seconds";
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (mins > 0 && secs === 0) {
    return `${mins} minute${mins > 1 ? "s" : ""}`;
  }
  if (mins > 0) {
    return `${mins} min ${secs} sec`;
  }
  return `${secs} seconds`;
}

/**
 * Format file size in bytes to human readable string (e.g. 45.2 MB)
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || isNaN(Number(bytes))) return "—";
  const b = Number(bytes);
  if (b === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Calculate the next scheduled recording time in Asia/Kolkata (IST).
 * Schedule: 08:00 AM, 01:00 PM, 06:00 PM IST
 * Example output: "16 Sep 2026, 1:00 PM"
 */
export function getNextScheduledRecordingTime(baseDate: Date = new Date()): {
  formattedText: string;
  timeText: string;
  dateText: string;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(baseDate);
  const getPart = (name: string) =>
    parseInt(parts.find((p) => p.type === name)?.value || "0", 10);

  const year = getPart("year");
  const month = getPart("month") - 1; // 0-indexed
  const day = getPart("day");
  const hour = getPart("hour");
  const minute = getPart("minute");
  const currentMinutes = hour * 60 + minute;

  const schedules = [
    { hour: 8, minute: 0, label: "8:00 AM", minutesOfDay: 8 * 60 },
    { hour: 13, minute: 0, label: "1:00 PM", minutesOfDay: 13 * 60 },
    { hour: 18, minute: 0, label: "6:00 PM", minutesOfDay: 18 * 60 },
  ];

  // Find the first slot strictly after current time
  const nextSlot = schedules.find((s) => s.minutesOfDay > currentMinutes);

  let targetYear = year;
  let targetMonth = month;
  let targetDay = day;
  let targetSlot: { hour: number; minute: number; label: string; minutesOfDay: number };

  if (nextSlot) {
    targetSlot = nextSlot;
  } else {
    // Next day at 8:00 AM
    targetSlot = schedules[0];
    const tomorrow = new Date(Date.UTC(year, month, day + 1));
    targetYear = tomorrow.getUTCFullYear();
    targetMonth = tomorrow.getUTCMonth();
    targetDay = tomorrow.getUTCDate();
  }

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const dateText = `${targetDay} ${months[targetMonth]} ${targetYear}`;
  const formattedText = `${dateText}, ${targetSlot.label}`;

  return {
    formattedText,
    timeText: targetSlot.label,
    dateText,
  };
}
