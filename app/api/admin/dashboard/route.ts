import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const { demo } = await requireAuth("ADMIN");
    if (demo) return NextResponse.json({ stats: { currently_on_site: 12, checked_in_today: 18, checked_out_today: 6, complete_sessions: 16, missing_checkout: 2, exceptions: 2 }, on_site: [], recent: [], demo: true });
    const admin = createSupabaseAdminClient();
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const weekStart = new Date(start);
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);
    const [events, sessions, open, weekly] = await Promise.all([
      admin.from("attendance_events").select("event_type").gte("server_timestamp", start.toISOString()),
      admin.from("work_sessions").select("*,worker:profiles!work_sessions_user_id_fkey(id,display_name,company),project:projects!work_sessions_project_id_fkey(id,project_name,customer_name)").gte("check_in_time", start.toISOString()).order("check_in_time", { ascending: false }),
      admin.from("work_sessions").select("*,worker:profiles!work_sessions_user_id_fkey(id,display_name,company),project:projects!work_sessions_project_id_fkey(id,project_name,customer_name)").eq("status", "OPEN").order("check_in_time"),
      admin.from("work_sessions").select("check_in_time,duration_seconds").gte("check_in_time", weekStart.toISOString()),
    ]);
    if (events.error) throw events.error;
    if (sessions.error) throw sessions.error;
    if (open.error) throw open.error;
    if (weekly.error) throw weekly.error;
    const eventRows = events.data || [];
    const sessionRows = sessions.data || [];
    const exceptions = sessionRows.filter((row) => ["MISSING_CHECKOUT", "LONG_SESSION"].includes(row.status)).length;
    const dailyHours = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setUTCDate(weekStart.getUTCDate() + index);
      const day = date.toISOString().slice(0, 10);
      const seconds = (weekly.data || []).filter((row) => String(row.check_in_time).slice(0, 10) === day).reduce((sum, row) => sum + Number(row.duration_seconds || 0), 0);
      return { day, hours: Number((seconds / 3600).toFixed(2)) };
    });
    return NextResponse.json({
      stats: {
        currently_on_site: open.data?.length || 0,
        checked_in_today: eventRows.filter((row) => row.event_type === "CHECK_IN").length,
        checked_out_today: eventRows.filter((row) => row.event_type === "CHECK_OUT").length,
        complete_sessions: sessionRows.filter((row) => row.status === "COMPLETE").length,
        missing_checkout: sessionRows.filter((row) => row.status === "MISSING_CHECKOUT").length,
        exceptions,
      },
      on_site: open.data || [],
      recent: sessionRows.slice(0, 10),
      daily_hours: dailyHours,
    });
  } catch (error) { return apiErrorResponse(error); }
}
