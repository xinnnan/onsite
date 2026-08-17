import "server-only";
import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/api";
import { createWatermarkedPhoto, normalizeSelfie } from "@/lib/attendance-image";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Profile, Project } from "@/lib/types";

function datePath(date: Date) {
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("/");
}

async function getProjectMap(project: Project) {
  if (!project.map_image_path) return null;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from("project-assets").download(project.map_image_path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

async function uploadAttendanceAssets({
  project,
  profile,
  photo,
  eventType,
  timestamp,
  eventId,
}: {
  project: Project;
  profile: Profile;
  photo: File;
  eventType: "CHECK_IN" | "CHECK_OUT";
  timestamp: Date;
  eventId: string;
}) {
  const admin = createSupabaseAdminClient();
  const normalized = await normalizeSelfie(photo);
  const recordCode = `ATT-${eventId.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  const path = `${project.id}/${datePath(timestamp)}/${profile.id}/${eventId}.webp`;
  const map = await getProjectMap(project);
  const watermarked = await createWatermarkedPhoto({ selfie: normalized.buffer, map, eventType, profile, project, timestamp, recordCode });

  const originalUpload = await admin.storage.from("attendance-originals").upload(path, normalized.buffer, { contentType: "image/webp", upsert: false });
  if (originalUpload.error) throw new ApiError(500, "ORIGINAL_UPLOAD_FAILED", originalUpload.error.message);
  const watermarkUpload = await admin.storage.from("attendance-watermarked").upload(path, watermarked, { contentType: "image/webp", upsert: false });
  if (watermarkUpload.error) {
    await admin.storage.from("attendance-originals").remove([path]);
    throw new ApiError(500, "WATERMARK_UPLOAD_FAILED", watermarkUpload.error.message);
  }
  return { originalPath: path, watermarkedPath: path, hash: normalized.hash, recordCode };
}

async function cleanupAssets(paths: string[]) {
  const admin = createSupabaseAdminClient();
  await Promise.all([
    admin.storage.from("attendance-originals").remove(paths),
    admin.storage.from("attendance-watermarked").remove(paths),
  ]);
}

export async function checkIn({ profile, projectId, photo, clientCaptureTime }: { profile: Profile; projectId: string; photo: File; clientCaptureTime?: string | null }) {
  const admin = createSupabaseAdminClient();
  const { data: projectData, error: projectError } = await admin.from("projects").select("*").eq("id", projectId).eq("status", "ACTIVE").single();
  if (projectError || !projectData) throw new ApiError(404, "PROJECT_NOT_ACTIVE");
  const { data: assignment } = await admin.from("project_assignments").select("id").eq("user_id", profile.id).eq("project_id", projectId).eq("status", "ACTIVE").maybeSingle();
  if (!assignment) throw new ApiError(403, "PROJECT_NOT_ASSIGNED");
  const { data: openSession } = await admin.from("work_sessions").select("id").eq("user_id", profile.id).eq("status", "OPEN").maybeSingle();
  if (openSession) throw new ApiError(409, "OPEN_SESSION_EXISTS");

  const project = projectData as Project;
  const eventId = randomUUID();
  const serverTimestamp = new Date();
  const assets = await uploadAttendanceAssets({ project, profile, photo, eventType: "CHECK_IN", timestamp: serverTimestamp, eventId });
  const { data, error } = await admin.rpc("create_check_in", {
    p_user_id: profile.id,
    p_project_id: project.id,
    p_event_id: eventId,
    p_original_photo_path: assets.originalPath,
    p_watermarked_photo_path: assets.watermarkedPath,
    p_photo_hash: assets.hash,
    p_client_capture_time: clientCaptureTime || null,
    p_server_timestamp: serverTimestamp.toISOString(),
  });
  if (error) {
    await cleanupAssets([assets.originalPath]);
    throw new ApiError(409, "CHECK_IN_FAILED", error.message);
  }
  return data;
}

export async function checkOut({ profile, photo, clientCaptureTime, dailyWorkSummary }: { profile: Profile; photo: File; clientCaptureTime?: string | null; dailyWorkSummary: string }) {
  const admin = createSupabaseAdminClient();
  const { data: session, error: sessionError } = await admin.from("work_sessions").select("project_id").eq("user_id", profile.id).eq("status", "OPEN").maybeSingle();
  if (sessionError || !session) throw new ApiError(409, "OPEN_SESSION_NOT_FOUND");
  const { data: projectData, error: projectError } = await admin.from("projects").select("*").eq("id", session.project_id).single();
  if (projectError || !projectData) throw new ApiError(404, "PROJECT_NOT_FOUND");

  const project = projectData as Project;
  const eventId = randomUUID();
  const serverTimestamp = new Date();
  const assets = await uploadAttendanceAssets({ project, profile, photo, eventType: "CHECK_OUT", timestamp: serverTimestamp, eventId });
  const { data, error } = await admin.rpc("create_check_out", {
    p_user_id: profile.id,
    p_event_id: eventId,
    p_original_photo_path: assets.originalPath,
    p_watermarked_photo_path: assets.watermarkedPath,
    p_photo_hash: assets.hash,
    p_client_capture_time: clientCaptureTime || null,
    p_server_timestamp: serverTimestamp.toISOString(),
    p_daily_work_summary: dailyWorkSummary,
  });
  if (error) {
    await cleanupAssets([assets.originalPath]);
    throw new ApiError(409, "CHECK_OUT_FAILED", error.message);
  }
  return data;
}
