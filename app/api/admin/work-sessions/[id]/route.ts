import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse, assertFound } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";
import { writeAuditLog } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionTimeZone, zonedDateTimeToUtc } from "@/lib/timezones";

const ALLOWED_STATUSES = new Set(["COMPLETE", "MISSING_CHECKOUT", "LONG_SESSION", "MANUALLY_CORRECTED", "VOID"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile: adminProfile, demo } = await requireAuth("ADMIN");
    const { id } = await params;
    const body = await request.json() as { check_in_time?: string; check_out_time?: string | null; status?: string; reason?: string; project_timezone?: string };
    if (!body.reason?.trim()) throw new ApiError(400, "CORRECTION_REASON_REQUIRED");
    if (body.status && !ALLOWED_STATUSES.has(body.status)) throw new ApiError(400, "INVALID_SESSION_STATUS");
    if (demo) {
      const checkIn = body.check_in_time ? zonedDateTimeToUtc(body.check_in_time, body.project_timezone || "UTC") : null;
      const checkOut = body.check_out_time ? zonedDateTimeToUtc(body.check_out_time, body.project_timezone || "UTC") : null;
      if (body.check_in_time && !checkIn) throw new ApiError(400, "INVALID_CHECK_IN_TIME");
      if (body.check_out_time && !checkOut) throw new ApiError(400, "INVALID_CHECK_OUT_TIME");
      return NextResponse.json({ session: { id, ...body, check_in_time: checkIn?.toISOString(), check_out_time: checkOut?.toISOString() || null, status: body.status || "MANUALLY_CORRECTED" }, demo: true });
    }
    const admin = createSupabaseAdminClient();
    const { data: oldValue } = await admin.from("work_sessions").select("*,project:projects!work_sessions_project_id_fkey(timezone),check_in_event:attendance_events!work_sessions_check_in_event_id_fkey(project_timezone_snapshot)").eq("id", id).single();
    assertFound(oldValue, "SESSION_NOT_FOUND");
    const projectTimeZone = getSessionTimeZone(oldValue);
    const checkIn = body.check_in_time ? zonedDateTimeToUtc(body.check_in_time, projectTimeZone) : null;
    const checkOut = body.check_out_time ? zonedDateTimeToUtc(body.check_out_time, projectTimeZone) : null;
    if (body.check_in_time && !checkIn) throw new ApiError(400, "INVALID_CHECK_IN_TIME");
    if (body.check_out_time && !checkOut) throw new ApiError(400, "INVALID_CHECK_OUT_TIME");
    const finalCheckIn = checkIn || new Date(oldValue.check_in_time);
    const finalCheckOut = body.check_out_time === null ? null : checkOut || (oldValue.check_out_time ? new Date(oldValue.check_out_time) : null);
    const finalStatus = body.status || "MANUALLY_CORRECTED";
    if (finalCheckOut && finalCheckOut <= finalCheckIn) throw new ApiError(400, "CHECK_OUT_BEFORE_CHECK_IN");
    if (["COMPLETE", "LONG_SESSION", "MANUALLY_CORRECTED"].includes(finalStatus) && !finalCheckOut) throw new ApiError(400, "CHECK_OUT_REQUIRED_FOR_STATUS");
    if (finalStatus === "MISSING_CHECKOUT" && finalCheckOut) throw new ApiError(400, "MISSING_CHECKOUT_CANNOT_HAVE_CHECK_OUT");
    const update = {
      ...(body.check_in_time ? { check_in_time: finalCheckIn.toISOString() } : {}),
      ...(body.check_out_time !== undefined ? { check_out_time: finalCheckOut?.toISOString() || null } : {}),
      duration_seconds: finalCheckOut ? Math.max(0, Math.floor((finalCheckOut.valueOf() - finalCheckIn.valueOf()) / 1000)) : null,
      status: finalStatus,
    };
    const { data, error } = await admin.from("work_sessions").update(update).eq("id", id).select().single();
    if (error || !data) throw new ApiError(409, "SESSION_UPDATE_FAILED", error?.message);
    await writeAuditLog({ adminUserId: adminProfile.id, action: "WORK_SESSION_UPDATED", entityType: "WORK_SESSION", entityId: id, oldValue, newValue: data, reason: body.reason.trim() });
    return NextResponse.json({ session: data });
  } catch (error) { return apiErrorResponse(error); }
}
