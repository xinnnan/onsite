import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";
import { checkOut } from "@/lib/attendance-service";
import { isWorkSummaryValid } from "@/lib/work-summary";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { profile, demo } = await requireAuth("WORKER");
    const form = await request.formData();
    const photo = form.get("photo");
    const clientCaptureTime = form.get("client_capture_time");
    const dailyWorkSummary = form.get("daily_work_summary");
    if (!(photo instanceof File)) throw new ApiError(400, "INVALID_CHECK_OUT_PAYLOAD");
    if (typeof dailyWorkSummary !== "string" || !isWorkSummaryValid(dailyWorkSummary)) throw new ApiError(400, "WORK_SUMMARY_TOO_SHORT");
    if (demo) {
      const eventId = crypto.randomUUID();
      return NextResponse.json({ event: { id: eventId, record_code: `ATT-${eventId.slice(0, 8).toUpperCase()}`, event_type: "CHECK_OUT", server_timestamp: new Date().toISOString() }, session: { id: crypto.randomUUID(), status: "COMPLETE", check_out_time: new Date().toISOString(), duration_seconds: 33060, daily_work_summary: dailyWorkSummary.trim() }, demo: true }, { status: 201 });
    }
    const data = await checkOut({ profile, photo, clientCaptureTime: typeof clientCaptureTime === "string" ? clientCaptureTime : null, dailyWorkSummary: dailyWorkSummary.trim() });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof Error && ["UNSUPPORTED_PHOTO_TYPE", "PHOTO_SIZE_INVALID", "INVALID_PHOTO"].includes(error.message)) return apiErrorResponse(new ApiError(400, error.message));
    return apiErrorResponse(error);
  }
}
