import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";
import { signAttendancePhoto } from "@/lib/admin-data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { demo } = await requireAuth("ADMIN");
    const { id } = await params;
    if (demo) return NextResponse.json({ session: null, demo: true });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("work_sessions").select(`
      *, worker:profiles!work_sessions_user_id_fkey(*), project:projects!work_sessions_project_id_fkey(*),
      check_in_event:attendance_events!work_sessions_check_in_event_id_fkey(*),
      check_out_event:attendance_events!work_sessions_check_out_event_id_fkey(*)
    `).eq("id", id).single();
    if (error || !data) throw new ApiError(404, "SESSION_NOT_FOUND");
    const checkInEvent = Array.isArray(data.check_in_event) ? data.check_in_event[0] : data.check_in_event;
    const checkOutEvent = Array.isArray(data.check_out_event) ? data.check_out_event[0] : data.check_out_event;
    const [checkInUrl, checkOutUrl] = await Promise.all([
      signAttendancePhoto("attendance-watermarked", checkInEvent?.watermarked_photo_path),
      signAttendancePhoto("attendance-watermarked", checkOutEvent?.watermarked_photo_path),
    ]);
    return NextResponse.json({ session: { ...data, check_in_photo_url: checkInUrl, check_out_photo_url: checkOutUrl } });
  } catch (error) { return apiErrorResponse(error); }
}
