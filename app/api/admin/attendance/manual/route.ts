import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";
import { writeAuditLog } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { safeTimeZone, zonedDateTimeToUtc } from "@/lib/timezones";
import { manualAttendanceSchema, parseBody } from "@/lib/validation";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const { profile: adminProfile, demo } = await requireAuth("ADMIN");
    const body = parseBody(manualAttendanceSchema, await request.json());
    if (!demo && (!UUID_PATTERN.test(body.user_id) || !UUID_PATTERN.test(body.project_id))) throw new ApiError(400, "INVALID_ATTENDANCE_TARGET");
    const requestedTimeZone = demo ? "America/New_York" : null;
    let projectTimeZone = requestedTimeZone;

    if (!demo) {
      const admin = createSupabaseAdminClient();
      const { data: project, error } = await admin.from("projects").select("timezone").eq("id", body.project_id).maybeSingle();
      if (error) throw error;
      if (!project) throw new ApiError(404, "PROJECT_NOT_FOUND");
      projectTimeZone = safeTimeZone(project.timezone);
    }

    const checkIn = zonedDateTimeToUtc(body.check_in_time, projectTimeZone || "UTC");
    const checkOut = body.check_out_time ? zonedDateTimeToUtc(body.check_out_time, projectTimeZone || "UTC") : null;
    if (!checkIn) throw new ApiError(400, "INVALID_CHECK_IN_TIME");
    if (body.check_out_time && !checkOut) throw new ApiError(400, "INVALID_CHECK_OUT_TIME");
    if (checkOut && checkOut <= checkIn) throw new ApiError(400, "CHECK_OUT_BEFORE_CHECK_IN");

    if (demo) {
      const id = crypto.randomUUID();
      return NextResponse.json({ session: { id, user_id: body.user_id, project_id: body.project_id, check_in_time: checkIn.toISOString(), check_out_time: checkOut?.toISOString() || null, status: checkOut ? "MANUALLY_CORRECTED" : "OPEN", is_manual_entry: true, admin_note: body.admin_note || null }, demo: true }, { status: 201 });
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
    return apiErrorResponse(error);
  }
}
