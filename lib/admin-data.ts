import "server-only";
import sharp from "sharp";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type PrivateAssetBucket = "project-assets" | "attendance-originals" | "attendance-watermarked";

export interface AttendanceFilters {
  projectId?: string | null;
  workerId?: string | null;
  customer?: string | null;
  company?: string | null;
  start?: string | null;
  end?: string | null;
  status?: string | null;
}

export async function fetchAttendanceSessions(filters: AttendanceFilters = {}) {
  const admin = createSupabaseAdminClient();
  let query = admin.from("work_sessions").select(`
    *,
    worker:profiles!work_sessions_user_id_fkey(id,username,display_name,company,worker_type),
    project:projects!work_sessions_project_id_fkey(id,project_code,project_name,customer_name,site_name,address_line_1,address_line_2,city,state,postal_code,country,timezone,map_image_path),
    check_in_event:attendance_events!work_sessions_check_in_event_id_fkey(id,record_code,event_type,server_timestamp,project_name_snapshot,customer_name_snapshot,site_name_snapshot,project_address_snapshot,project_timezone_snapshot,project_map_path_snapshot,original_photo_path,watermarked_photo_path),
    check_out_event:attendance_events!work_sessions_check_out_event_id_fkey(id,record_code,event_type,server_timestamp,project_name_snapshot,customer_name_snapshot,site_name_snapshot,project_address_snapshot,project_timezone_snapshot,project_map_path_snapshot,original_photo_path,watermarked_photo_path)
  `).order("check_in_time", { ascending: false }).limit(1000);
  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  if (filters.workerId) query = query.eq("user_id", filters.workerId);
  if (filters.start) query = query.gte("check_in_time", `${filters.start}T00:00:00.000Z`);
  if (filters.end) query = query.lte("check_in_time", `${filters.end}T23:59:59.999Z`);
  if (filters.status) query = query.eq("status", filters.status);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).filter((row) => {
    const project = Array.isArray(row.project) ? row.project[0] : row.project;
    const worker = Array.isArray(row.worker) ? row.worker[0] : row.worker;
    return (!filters.customer || project?.customer_name === filters.customer) && (!filters.company || worker?.company === filters.company);
  });
}

export async function signPrivateAsset(bucket: PrivateAssetBucket, path: string | null | undefined) {
  if (!path) return null;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, 60 * 10);
  return error ? null : data.signedUrl;
}

export async function loadPrivateAssetAsJpegDataUri(
  bucket: PrivateAssetBucket,
  path: string | null | undefined,
) {
  if (!path) return null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(bucket).download(path);
  if (error || !data) return null;

  try {
    const source = Buffer.from(await data.arrayBuffer());
    const jpeg = await sharp(source)
      .rotate()
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 76, progressive: true })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function signAttendancePhoto(bucket: "attendance-originals" | "attendance-watermarked", path: string | null | undefined) {
  return signPrivateAsset(bucket, path);
}
