import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse, assertFound } from "@/lib/api";
import { normalizeSelfie } from "@/lib/attendance-image";
import { cleanupAttendanceAssetPaths, regenerateAttendanceWatermark, uploadPreparedAttendanceAssets, type PreparedAttendancePhoto } from "@/lib/attendance-service";
import { requireAuth } from "@/lib/auth-context";
import { writeAuditLog } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionTimeZone, zonedDateTimeToUtc } from "@/lib/timezones";
import type { Profile, Project } from "@/lib/types";
import { isWorkSummaryValid } from "@/lib/work-summary";

const ALLOWED_STATUSES = new Set(["OPEN", "COMPLETE", "MISSING_CHECKOUT", "LONG_SESSION", "MANUALLY_CORRECTED"]);

export const runtime = "nodejs";

type CorrectionBody = {
  project_id?: string;
  check_in_time?: string;
  check_out_time?: string | null;
  status?: string;
  reason?: string;
  project_timezone?: string;
  daily_work_summary?: string | null;
};

type AttendanceEvent = {
  id: string;
  project_id: string;
  record_code: string;
  server_timestamp: string;
  original_photo_path?: string | null;
  watermarked_photo_path?: string | null;
  photo_hash?: string | null;
  project_name_snapshot?: string | null;
  customer_name_snapshot?: string | null;
  site_name_snapshot?: string | null;
  project_address_snapshot?: string | null;
  project_timezone_snapshot?: string | null;
  project_map_path_snapshot?: string | null;
  project_latitude_snapshot?: number | null;
  project_longitude_snapshot?: number | null;
};

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function optionalPhoto(value: FormDataEntryValue | null) {
  return value instanceof File && value.size > 0 ? value : null;
}

function formText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : undefined;
}

function projectEventFields(project: Project) {
  return {
    project_id: project.id,
    project_name_snapshot: project.project_name,
    customer_name_snapshot: project.customer_name,
    site_name_snapshot: project.site_name,
    project_address_snapshot: [project.address_line_1, project.address_line_2, project.city, project.state, project.postal_code].filter(Boolean).join(", "),
    project_timezone_snapshot: project.timezone,
    project_map_path_snapshot: project.map_image_path,
    project_latitude_snapshot: project.latitude,
    project_longitude_snapshot: project.longitude,
  };
}

function existingEventProjectFields(event: AttendanceEvent) {
  return {
    project_id: event.project_id,
    project_name_snapshot: event.project_name_snapshot,
    customer_name_snapshot: event.customer_name_snapshot,
    site_name_snapshot: event.site_name_snapshot,
    project_address_snapshot: event.project_address_snapshot,
    project_timezone_snapshot: event.project_timezone_snapshot,
    project_map_path_snapshot: event.project_map_path_snapshot,
    project_latitude_snapshot: event.project_latitude_snapshot,
    project_longitude_snapshot: event.project_longitude_snapshot,
  };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile: adminProfile, demo } = await requireAuth("ADMIN");
    const { id } = await params;
    const contentType = request.headers.get("content-type") || "";
    let checkInPhoto: File | null = null;
    let checkOutPhoto: File | null = null;
    let body: CorrectionBody;
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      checkInPhoto = optionalPhoto(form.get("check_in_photo"));
      checkOutPhoto = optionalPhoto(form.get("check_out_photo"));
      const checkOutValue = formText(form, "check_out_time");
      const summaryValue = formText(form, "daily_work_summary");
      body = {
        project_id: formText(form, "project_id"),
        check_in_time: formText(form, "check_in_time"),
        check_out_time: checkOutValue === "" ? null : checkOutValue,
        status: formText(form, "status"),
        reason: formText(form, "reason"),
        project_timezone: formText(form, "project_timezone"),
        daily_work_summary: summaryValue === "" ? null : summaryValue,
      };
    } else {
      body = await request.json() as CorrectionBody;
    }
    if (!body.reason?.trim()) throw new ApiError(400, "CORRECTION_REASON_REQUIRED");
    if (body.status && !ALLOWED_STATUSES.has(body.status)) throw new ApiError(400, "INVALID_SESSION_STATUS");
    const dailyWorkSummary = body.daily_work_summary?.trim() || null;
    if (dailyWorkSummary && !isWorkSummaryValid(dailyWorkSummary)) throw new ApiError(400, "WORK_SUMMARY_TOO_SHORT");
    if (demo) {
      const checkIn = body.check_in_time ? zonedDateTimeToUtc(body.check_in_time, body.project_timezone || "UTC") : null;
      const checkOut = body.check_out_time ? zonedDateTimeToUtc(body.check_out_time, body.project_timezone || "UTC") : null;
      if (body.check_in_time && !checkIn) throw new ApiError(400, "INVALID_CHECK_IN_TIME");
      if (body.check_out_time && !checkOut) throw new ApiError(400, "INVALID_CHECK_OUT_TIME");
      if (checkOutPhoto && !checkOut) throw new ApiError(400, "CHECK_OUT_PHOTO_REQUIRES_TIME");
      await Promise.all([checkInPhoto ? normalizeSelfie(checkInPhoto) : null, checkOutPhoto ? normalizeSelfie(checkOutPhoto) : null]);
      return NextResponse.json({ session: { id, ...body, check_in_time: checkIn?.toISOString(), check_out_time: checkOut?.toISOString() || null, status: body.status || "OPEN", daily_work_summary: body.daily_work_summary === undefined ? undefined : dailyWorkSummary }, demo: true });
    }

    const admin = createSupabaseAdminClient();
    const { data: oldValue } = await admin.from("work_sessions").select(`
      *, worker:profiles!work_sessions_user_id_fkey(*), project:projects!work_sessions_project_id_fkey(*),
      check_in_event:attendance_events!work_sessions_check_in_event_id_fkey(*),
      check_out_event:attendance_events!work_sessions_check_out_event_id_fkey(*)
    `).eq("id", id).single();
    assertFound(oldValue, "SESSION_NOT_FOUND");
    if ((checkInPhoto || checkOutPhoto) && !oldValue.is_manual_entry) throw new ApiError(403, "MANUAL_ATTENDANCE_PHOTOS_ONLY");

    const existingProject = one(oldValue.project) as Project | null;
    const projectChanged = Boolean(body.project_id && body.project_id !== oldValue.project_id);
    let project = existingProject;
    if (projectChanged) {
      const { data: selectedProject, error: selectedProjectError } = await admin.from("projects").select("*").eq("id", body.project_id).eq("status", "ACTIVE").maybeSingle();
      if (selectedProjectError) throw selectedProjectError;
      if (!selectedProject) throw new ApiError(404, "PROJECT_NOT_ACTIVE");
      project = selectedProject as Project;
    }
    if (!project) throw new ApiError(409, "ATTENDANCE_PROJECT_CONTEXT_MISSING");

    const projectTimeZone = projectChanged ? project.timezone : getSessionTimeZone(oldValue);
    const checkIn = body.check_in_time ? zonedDateTimeToUtc(body.check_in_time, projectTimeZone) : null;
    const checkOut = body.check_out_time ? zonedDateTimeToUtc(body.check_out_time, projectTimeZone) : null;
    if (body.check_in_time && !checkIn) throw new ApiError(400, "INVALID_CHECK_IN_TIME");
    if (body.check_out_time && !checkOut) throw new ApiError(400, "INVALID_CHECK_OUT_TIME");
    const finalCheckIn = checkIn || new Date(oldValue.check_in_time);
    const finalCheckOut = body.check_out_time === null ? null : checkOut || (oldValue.check_out_time ? new Date(oldValue.check_out_time) : null);
    const finalStatus = body.status || oldValue.status || (finalCheckOut ? "MANUALLY_CORRECTED" : "OPEN");
    if (finalCheckOut && finalCheckOut <= finalCheckIn) throw new ApiError(400, "CHECK_OUT_BEFORE_CHECK_IN");
    if (["COMPLETE", "LONG_SESSION", "MANUALLY_CORRECTED"].includes(finalStatus) && !finalCheckOut) throw new ApiError(400, "CHECK_OUT_REQUIRED_FOR_STATUS");
    if (finalStatus === "MISSING_CHECKOUT" && finalCheckOut) throw new ApiError(400, "MISSING_CHECKOUT_CANNOT_HAVE_CHECK_OUT");
    if (finalStatus === "OPEN" && finalCheckOut) throw new ApiError(400, "OPEN_SESSION_CANNOT_HAVE_CHECK_OUT");
    if (checkOutPhoto && !finalCheckOut) throw new ApiError(400, "CHECK_OUT_PHOTO_REQUIRES_TIME");

    const worker = one(oldValue.worker) as Profile | null;
    const existingCheckInEvent = one(oldValue.check_in_event) as AttendanceEvent | null;
    const existingCheckOutEvent = one(oldValue.check_out_event) as AttendanceEvent | null;
    const checkInEvent = existingCheckInEvent ? { ...existingCheckInEvent } : null;
    let checkOutEvent = existingCheckOutEvent ? { ...existingCheckOutEvent } : null;
    if ((checkInPhoto || checkOutPhoto) && (!project || !worker || !checkInEvent)) throw new ApiError(409, "ATTENDANCE_PHOTO_CONTEXT_MISSING");

    const [preparedCheckIn, preparedCheckOut] = await Promise.all([
      checkInPhoto ? normalizeSelfie(checkInPhoto) : Promise.resolve(null),
      checkOutPhoto ? normalizeSelfie(checkOutPhoto) : Promise.resolve(null),
    ]);

    let createdCheckOutEventId: string | null = null;
    if (oldValue.is_manual_entry && finalCheckOut && !checkOutEvent) {
      const eventId = randomUUID();
      const recordCode = `ATT-${eventId.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
      const { data: createdEvent, error: createEventError } = await admin.from("attendance_events").insert({
        id: eventId,
        record_code: recordCode,
        user_id: oldValue.user_id,
        ...(projectChanged || !checkInEvent ? projectEventFields(project) : existingEventProjectFields(checkInEvent)),
        event_type: "CHECK_OUT",
        server_timestamp: finalCheckOut.toISOString(),
        client_capture_time: null,
        original_photo_path: null,
        watermarked_photo_path: null,
        photo_hash: null,
      }).select("*").single();
      if (createEventError || !createdEvent) throw new ApiError(409, "CHECK_OUT_EVENT_CREATE_FAILED", createEventError?.message);
      checkOutEvent = createdEvent as AttendanceEvent;
      createdCheckOutEventId = eventId;
    }

    const newOriginalPaths: string[] = [];
    const newWatermarkedPaths: string[] = [];
    const replacedOriginalPaths: string[] = [];
    const replacedWatermarkedPaths: string[] = [];
    const photoRollbacks: Array<{ event: AttendanceEvent; original_photo_path: string | null; watermarked_photo_path: string | null; photo_hash: string | null }> = [];
    const watermarkRollbacks: Array<{ event: AttendanceEvent; watermarked_photo_path: string | null }> = [];
    const projectRollbacks: AttendanceEvent[] = [];
    async function replacePhoto(preparedPhoto: PreparedAttendancePhoto | null, event: AttendanceEvent | null, eventType: "CHECK_IN" | "CHECK_OUT", timestamp: Date | null) {
      if (!preparedPhoto) return;
      if (!event || !timestamp || !project || !worker) throw new ApiError(409, "ATTENDANCE_PHOTO_CONTEXT_MISSING");
      const previous = {
        event,
        original_photo_path: event.original_photo_path || null,
        watermarked_photo_path: event.watermarked_photo_path || null,
        photo_hash: event.photo_hash || null,
      };
      const assets = await uploadPreparedAttendanceAssets({
        project,
        profile: worker,
        preparedPhoto,
        eventType,
        timestamp,
        eventId: event.id,
        recordCode: event.record_code,
        assetId: `${event.id}-${randomUUID()}`,
      });
      newOriginalPaths.push(assets.originalPath);
      newWatermarkedPaths.push(assets.watermarkedPath);
      const { error: photoUpdateError } = await admin.from("attendance_events").update({
        original_photo_path: assets.originalPath,
        watermarked_photo_path: assets.watermarkedPath,
        photo_hash: assets.hash,
      }).eq("id", event.id);
      if (photoUpdateError) throw new ApiError(500, "ATTENDANCE_PHOTO_UPDATE_FAILED", photoUpdateError.message);
      photoRollbacks.push(previous);
      if (previous.original_photo_path) replacedOriginalPaths.push(previous.original_photo_path);
      if (previous.watermarked_photo_path) replacedWatermarkedPaths.push(previous.watermarked_photo_path);
      Object.assign(event, { original_photo_path: assets.originalPath, watermarked_photo_path: assets.watermarkedPath, photo_hash: assets.hash });
    }

    async function refreshWatermark(event: AttendanceEvent | null, eventType: "CHECK_IN" | "CHECK_OUT", timestamp: Date | null, replaced: boolean, needed: boolean) {
      if (!event || !timestamp || replaced || !needed || !event.original_photo_path) return false;
      if (!project || !worker) throw new ApiError(409, "ATTENDANCE_PHOTO_CONTEXT_MISSING");
      const previous = event.watermarked_photo_path || null;
      const watermarkedPath = await regenerateAttendanceWatermark({ project, profile: worker, event, eventType, timestamp });
      if (!watermarkedPath) return false;
      newWatermarkedPaths.push(watermarkedPath);
      const { error: watermarkUpdateError } = await admin.from("attendance_events").update({ watermarked_photo_path: watermarkedPath }).eq("id", event.id);
      if (watermarkUpdateError) throw new ApiError(500, "WATERMARK_REGENERATION_FAILED", watermarkUpdateError.message);
      watermarkRollbacks.push({ event, watermarked_photo_path: previous });
      if (previous) replacedWatermarkedPaths.push(previous);
      event.watermarked_photo_path = watermarkedPath;
      return true;
    }

    async function saveEventProject(event: AttendanceEvent | null, previous: AttendanceEvent | null) {
      if (!projectChanged || !event || !previous) return;
      const { error: eventProjectError } = await admin.from("attendance_events").update(projectEventFields(project!)).eq("id", event.id);
      if (eventProjectError) throw new ApiError(409, "ATTENDANCE_PROJECT_UPDATE_FAILED", eventProjectError.message);
      projectRollbacks.push(previous);
    }

    let data;
    let checkInWatermarkRegenerated = false;
    let checkOutWatermarkRegenerated = false;
    const checkInTimeChanged = finalCheckIn.valueOf() !== new Date(oldValue.check_in_time).valueOf();
    const checkOutTimeChanged = (finalCheckOut?.valueOf() || null) !== (oldValue.check_out_time ? new Date(oldValue.check_out_time).valueOf() : null);
    const checkInLegacyMismatch = Boolean(checkInEvent?.original_photo_path && checkInEvent.original_photo_path === checkInEvent.watermarked_photo_path && new Date(checkInEvent.server_timestamp).valueOf() !== finalCheckIn.valueOf());
    const checkOutLegacyMismatch = Boolean(checkOutEvent?.original_photo_path && checkOutEvent.original_photo_path === checkOutEvent.watermarked_photo_path && finalCheckOut && new Date(checkOutEvent.server_timestamp).valueOf() !== finalCheckOut.valueOf());
    if (projectChanged) {
      if (checkInEvent) Object.assign(checkInEvent, projectEventFields(project));
      if (checkOutEvent && existingCheckOutEvent) Object.assign(checkOutEvent, projectEventFields(project));
    }
    try {
      await replacePhoto(preparedCheckIn, checkInEvent, "CHECK_IN", finalCheckIn);
      await replacePhoto(preparedCheckOut, checkOutEvent, "CHECK_OUT", finalCheckOut);
      checkInWatermarkRegenerated = await refreshWatermark(checkInEvent, "CHECK_IN", finalCheckIn, Boolean(preparedCheckIn), projectChanged || checkInTimeChanged || checkInLegacyMismatch);
      checkOutWatermarkRegenerated = await refreshWatermark(checkOutEvent, "CHECK_OUT", finalCheckOut, Boolean(preparedCheckOut), projectChanged || checkOutTimeChanged || checkOutLegacyMismatch);
      await saveEventProject(checkInEvent, existingCheckInEvent);
      await saveEventProject(checkOutEvent, existingCheckOutEvent);
      const update = {
        ...(projectChanged ? { project_id: project.id } : {}),
        ...(body.check_in_time ? { check_in_time: finalCheckIn.toISOString() } : {}),
        ...(body.check_out_time !== undefined ? { check_out_time: finalCheckOut?.toISOString() || null } : {}),
        ...(createdCheckOutEventId ? { check_out_event_id: createdCheckOutEventId } : {}),
        ...(body.daily_work_summary !== undefined ? { daily_work_summary: dailyWorkSummary } : {}),
        duration_seconds: finalCheckOut ? Math.max(0, Math.floor((finalCheckOut.valueOf() - finalCheckIn.valueOf()) / 1000)) : null,
        status: finalStatus,
      };
      const result = await admin.from("work_sessions").update(update).eq("id", id).select().single();
      if (result.error || !result.data) throw new ApiError(409, "SESSION_UPDATE_FAILED", result.error?.message);
      data = result.data;
    } catch (updateError) {
      for (const rollback of projectRollbacks.reverse()) {
        await admin.from("attendance_events").update(existingEventProjectFields(rollback)).eq("id", rollback.id);
      }
      for (const rollback of watermarkRollbacks.reverse()) {
        await admin.from("attendance_events").update({ watermarked_photo_path: rollback.watermarked_photo_path }).eq("id", rollback.event.id);
      }
      for (const rollback of photoRollbacks) {
        await admin.from("attendance_events").update({
          original_photo_path: rollback.original_photo_path,
          watermarked_photo_path: rollback.watermarked_photo_path,
          photo_hash: rollback.photo_hash,
        }).eq("id", rollback.event.id);
      }
      await cleanupAttendanceAssetPaths({ originalPaths: newOriginalPaths, watermarkedPaths: newWatermarkedPaths });
      if (createdCheckOutEventId) await admin.from("attendance_events").delete().eq("id", createdCheckOutEventId);
      throw updateError;
    }

    await cleanupAttendanceAssetPaths({
      originalPaths: [...new Set(replacedOriginalPaths)].filter((path) => !newOriginalPaths.includes(path)),
      watermarkedPaths: [...new Set(replacedWatermarkedPaths)].filter((path) => !newWatermarkedPaths.includes(path)),
    });
    await writeAuditLog({
      adminUserId: adminProfile.id,
      action: "WORK_SESSION_UPDATED",
      entityType: "WORK_SESSION",
      entityId: id,
      oldValue,
      newValue: {
        ...data,
        check_in_photo_updated: Boolean(preparedCheckIn),
        check_out_photo_updated: Boolean(preparedCheckOut),
        check_in_watermark_regenerated: checkInWatermarkRegenerated,
        check_out_watermark_regenerated: checkOutWatermarkRegenerated,
        project_changed: projectChanged,
      },
      reason: body.reason.trim(),
    });
    return NextResponse.json({ session: data });
  } catch (error) {
    if (error instanceof Error && ["UNSUPPORTED_PHOTO_TYPE", "PHOTO_SIZE_INVALID", "INVALID_PHOTO"].includes(error.message)) return apiErrorResponse(new ApiError(400, error.message));
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile: adminProfile, demo } = await requireAuth("ADMIN");
    const { id } = await params;
    const body = await request.json().catch(() => ({})) as { reason?: string };
    const reason = body.reason?.trim() || "";
    if (reason.length < 5) throw new ApiError(400, "DELETION_REASON_REQUIRED");
    if (demo) return NextResponse.json({ deleted: true, demo: true });

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("delete_work_session", {
      p_session_id: id,
      p_admin_profile_id: adminProfile.id,
      p_reason: reason,
    });
    if (error || !data) throw new ApiError(409, "SESSION_DELETE_FAILED", error?.message);
    const deleted = data as { original_photo_paths?: string[]; watermarked_photo_paths?: string[] };
    await cleanupAttendanceAssetPaths({
      originalPaths: deleted.original_photo_paths || [],
      watermarkedPaths: deleted.watermarked_photo_paths || [],
    });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
