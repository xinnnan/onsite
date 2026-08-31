import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/api";
import { normalizeSelfie } from "@/lib/attendance-image";
import { cleanupAttendanceAssets, uploadPreparedAttendanceAssets, type PreparedAttendancePhoto } from "@/lib/attendance-service";
import { requireAuth } from "@/lib/auth-context";
import { writeAuditLog } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { safeTimeZone, zonedDateTimeToUtc } from "@/lib/timezones";
import type { Profile, Project } from "@/lib/types";
import { manualAttendanceSchema, parseBody } from "@/lib/validation";
import { isWorkSummaryValid } from "@/lib/work-summary";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const runtime = "nodejs";

function optionalPhoto(value: FormDataEntryValue | null) {
  return value instanceof File && value.size > 0 ? value : null;
}

function optionalText(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function POST(request: Request) {
  try {
    const { profile: adminProfile, demo } = await requireAuth("ADMIN");
    const contentType = request.headers.get("content-type") || "";
    let checkInPhoto: File | null = null;
    let checkOutPhoto: File | null = null;
    let rawBody: unknown;
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      checkInPhoto = optionalPhoto(form.get("check_in_photo"));
      checkOutPhoto = optionalPhoto(form.get("check_out_photo"));
      rawBody = {
        user_id: optionalText(form.get("user_id")),
        project_id: optionalText(form.get("project_id")),
        check_in_time: optionalText(form.get("check_in_time")),
        check_out_time: optionalText(form.get("check_out_time")),
        admin_note: optionalText(form.get("admin_note")),
        daily_work_summary: optionalText(form.get("daily_work_summary")),
      };
    } else {
      rawBody = await request.json();
    }
    const body = parseBody(manualAttendanceSchema, rawBody);
    const dailyWorkSummary = body.daily_work_summary?.trim() || null;
    if (dailyWorkSummary && !isWorkSummaryValid(dailyWorkSummary)) throw new ApiError(400, "WORK_SUMMARY_TOO_SHORT");
    if (!demo && (!UUID_PATTERN.test(body.user_id) || !UUID_PATTERN.test(body.project_id))) throw new ApiError(400, "INVALID_ATTENDANCE_TARGET");
    if (checkOutPhoto && !body.check_out_time) throw new ApiError(400, "CHECK_OUT_PHOTO_REQUIRES_TIME");
    const requestedTimeZone = demo ? "America/New_York" : null;
    let projectTimeZone = requestedTimeZone;
    let project: Project | null = null;
    let worker: Profile | null = null;

    if (!demo) {
      const admin = createSupabaseAdminClient();
      const [projectResult, workerResult] = await Promise.all([
        admin.from("projects").select("*").eq("id", body.project_id).eq("status", "ACTIVE").maybeSingle(),
        admin.from("profiles").select("*").eq("id", body.user_id).eq("role", "WORKER").eq("status", "ACTIVE").maybeSingle(),
      ]);
      if (projectResult.error) throw projectResult.error;
      if (workerResult.error) throw workerResult.error;
      if (!projectResult.data) throw new ApiError(404, "PROJECT_NOT_ACTIVE");
      if (!workerResult.data) throw new ApiError(404, "WORKER_NOT_ACTIVE");
      project = projectResult.data as Project;
      worker = workerResult.data as Profile;
      projectTimeZone = safeTimeZone(project.timezone);
    }

    const checkIn = zonedDateTimeToUtc(body.check_in_time, projectTimeZone || "UTC");
    const checkOut = body.check_out_time ? zonedDateTimeToUtc(body.check_out_time, projectTimeZone || "UTC") : null;
    if (!checkIn) throw new ApiError(400, "INVALID_CHECK_IN_TIME");
    if (body.check_out_time && !checkOut) throw new ApiError(400, "INVALID_CHECK_OUT_TIME");
    if (checkOut && checkOut <= checkIn) throw new ApiError(400, "CHECK_OUT_BEFORE_CHECK_IN");

    const [preparedCheckIn, preparedCheckOut] = await Promise.all([
      checkInPhoto ? normalizeSelfie(checkInPhoto) : Promise.resolve(null),
      checkOutPhoto ? normalizeSelfie(checkOutPhoto) : Promise.resolve(null),
    ]);

    if (demo) {
      const id = crypto.randomUUID();
      return NextResponse.json({ session: { id, user_id: body.user_id, project_id: body.project_id, check_in_time: checkIn.toISOString(), check_out_time: checkOut?.toISOString() || null, status: checkOut ? "MANUALLY_CORRECTED" : "OPEN", is_manual_entry: true, admin_note: body.admin_note || null, daily_work_summary: dailyWorkSummary }, demo: true }, { status: 201 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("create_manual_attendance", {
      p_user_id: body.user_id,
      p_project_id: body.project_id,
      p_check_in_time: checkIn.toISOString(),
      p_check_out_time: checkOut?.toISOString() || null,
      p_admin_note: body.admin_note || null,
      p_admin_profile_id: adminProfile.id,
    });
    if (error || !data?.session) {
      if (error?.message.includes("ATTENDANCE_TIME_OVERLAP") || error?.message.includes("one_open_session_per_worker")) {
        throw new ApiError(409, "ATTENDANCE_TIME_OVERLAP");
      }
      throw new ApiError(409, "MANUAL_ATTENDANCE_CREATE_FAILED", error?.message);
    }

    const uploadedPaths: string[] = [];
    const eventIds = [data.check_in_event?.id, data.check_out_event?.id].filter((id): id is string => typeof id === "string");
    async function attachPhoto(preparedPhoto: PreparedAttendancePhoto | null, event: { id: string; record_code: string } | null, eventType: "CHECK_IN" | "CHECK_OUT", timestamp: Date | null) {
      if (!preparedPhoto || !event || !timestamp || !project || !worker) return;
      const assets = await uploadPreparedAttendanceAssets({ project, profile: worker, preparedPhoto, eventType, timestamp, eventId: event.id, recordCode: event.record_code });
      uploadedPaths.push(assets.originalPath);
      const { error: updateError } = await admin.from("attendance_events").update({
        original_photo_path: assets.originalPath,
        watermarked_photo_path: assets.watermarkedPath,
        photo_hash: assets.hash,
      }).eq("id", event.id);
      if (updateError) throw new ApiError(500, "MANUAL_ATTENDANCE_PHOTO_ATTACH_FAILED", updateError.message);
      Object.assign(event, { original_photo_path: assets.originalPath, watermarked_photo_path: assets.watermarkedPath, photo_hash: assets.hash });
    }
    try {
      await attachPhoto(preparedCheckIn, data.check_in_event, "CHECK_IN", checkIn);
      await attachPhoto(preparedCheckOut, data.check_out_event, "CHECK_OUT", checkOut);
      if (dailyWorkSummary) {
        const { data: updatedSession, error: summaryError } = await admin.from("work_sessions").update({ daily_work_summary: dailyWorkSummary }).eq("id", data.session.id).select().single();
        if (summaryError || !updatedSession) throw new ApiError(500, "WORK_SUMMARY_UPDATE_FAILED", summaryError?.message);
        data.session = updatedSession;
      }
    } catch (photoError) {
      await cleanupAttendanceAssets(uploadedPaths);
      await admin.from("work_sessions").delete().eq("id", data.session.id);
      if (eventIds.length) await admin.from("attendance_events").delete().in("id", eventIds);
      throw photoError;
    }

    await writeAuditLog({
      adminUserId: adminProfile.id,
      action: "MANUAL_ATTENDANCE_CREATED",
      entityType: "WORK_SESSION",
      entityId: data.session.id,
      newValue: data,
      reason: body.admin_note || "Administrator manually added an attendance record",
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "VALIDATION_ERROR") return apiErrorResponse(new ApiError(400, "VALIDATION_ERROR", error.message));
    if (error instanceof Error && ["UNSUPPORTED_PHOTO_TYPE", "PHOTO_SIZE_INVALID", "INVALID_PHOTO"].includes(error.message)) return apiErrorResponse(new ApiError(400, error.message));
    return apiErrorResponse(error);
  }
}
