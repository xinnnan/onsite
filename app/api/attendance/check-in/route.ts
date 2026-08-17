import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";
import { checkIn } from "@/lib/attendance-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { profile, demo } = await requireAuth("WORKER");
    const form = await request.formData();
    const projectId = form.get("project_id");
    const photo = form.get("photo");
    const clientCaptureTime = form.get("client_capture_time");
    if (typeof projectId !== "string" || !(photo instanceof File)) throw new ApiError(400, "INVALID_CHECK_IN_PAYLOAD");
    if (demo) {
      const eventId = crypto.randomUUID();
      return NextResponse.json({ event: { id: eventId, record_code: `ATT-${eventId.slice(0, 8).toUpperCase()}`, event_type: "CHECK_IN", server_timestamp: new Date().toISOString() }, session: { id: crypto.randomUUID(), status: "OPEN", check_in_time: new Date().toISOString(), project_id: projectId }, demo: true });
    }
    const data = await checkIn({ profile, projectId, photo, clientCaptureTime: typeof clientCaptureTime === "string" ? clientCaptureTime : null });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof Error && ["UNSUPPORTED_PHOTO_TYPE", "PHOTO_SIZE_INVALID", "INVALID_PHOTO"].includes(error.message)) return apiErrorResponse(new ApiError(400, error.message));
    return apiErrorResponse(error);
  }
}
