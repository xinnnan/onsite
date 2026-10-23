import { NextResponse } from "next/server";
import { CLOCK_IN_ROLES } from "@/lib/access-scope";
import { apiErrorResponse } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";
import { getSessionTimeZone, localDateKey } from "@/lib/timezones";

const demoProjects = [
  { id: "adidas", project_code: "ADI-AMR-26", project_name: "adidas Indy AMR", customer_name: "adidas", site_name: "Indy Manufacturing Facility", address_line_1: "8677 Impact Court", city: "Indianapolis", state: "IN", postal_code: "46219", timezone: "America/Indiana/Indianapolis", status: "ACTIVE" },
  { id: "walmart", project_code: "WMT-ATL-04", project_name: "Walmart Atlanta", customer_name: "Walmart", site_name: "ATL Distribution Center", address_line_1: "1200 Logistics Pkwy", city: "Norcross", state: "GA", postal_code: "30071", timezone: "America/New_York", status: "ACTIVE" },
];

export async function GET() {
  try {
    const { supabase, profile, demo } = await requireAuth(CLOCK_IN_ROLES);
    if (demo || !supabase) return NextResponse.json({ profile, projects: demoProjects, session: null, today: [], demo: true });
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const now = new Date();
    const [projectsResult, sessionResult, eventsResult, recentResult] = await Promise.all([
      supabase.from("project_assignments").select("project:projects(*)").eq("user_id", profile.id).eq("status", "ACTIVE"),
      supabase.from("work_sessions").select("*, project:projects(*)").eq("user_id", profile.id).eq("status", "OPEN").maybeSingle(),
      supabase.from("attendance_events").select("id,record_code,event_type,server_timestamp,project_name_snapshot").eq("user_id", profile.id).gte("server_timestamp", today.toISOString()).order("server_timestamp"),
      supabase.from("work_sessions").select("check_in_time,check_out_time,duration_seconds,status,check_in_event:attendance_events!work_sessions_check_in_event_id_fkey(project_name_snapshot,project_timezone_snapshot)")
        .eq("user_id", profile.id).neq("status", "VOID").neq("status", "OPEN").gte("check_in_time", new Date(now.valueOf() - 36 * 60 * 60 * 1000).toISOString()).order("check_in_time", { ascending: false }),
    ]);
    if (projectsResult.error) throw projectsResult.error;
    if (sessionResult.error) throw sessionResult.error;
    if (eventsResult.error) throw eventsResult.error;
    if (recentResult.error) throw recentResult.error;
    // People clock in once a day, so a session that started today means the day is done.
    const finished = (recentResult.data || []).find((row) => localDateKey(row.check_in_time, getSessionTimeZone(row)) === localDateKey(now, getSessionTimeZone(row)));
    const finishedEvent = finished && (Array.isArray(finished.check_in_event) ? finished.check_in_event[0] : finished.check_in_event);
    return NextResponse.json({
      profile,
      projects: projectsResult.data?.map((row) => row.project).filter(Boolean) ?? [],
      session: sessionResult.data,
      today: eventsResult.data,
      today_session: finished ? { check_in_time: finished.check_in_time, check_out_time: finished.check_out_time, duration_seconds: finished.duration_seconds, project_name: finishedEvent?.project_name_snapshot || null } : null,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
