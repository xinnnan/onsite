import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";

const demoProjects = [
  { id: "adidas", project_code: "ADI-AMR-26", project_name: "adidas Indy AMR", customer_name: "adidas", site_name: "Indy Manufacturing Facility", address_line_1: "8677 Impact Court", city: "Indianapolis", state: "IN", postal_code: "46219", timezone: "America/Indiana/Indianapolis", status: "ACTIVE" },
  { id: "walmart", project_code: "WMT-ATL-04", project_name: "Walmart Atlanta", customer_name: "Walmart", site_name: "ATL Distribution Center", address_line_1: "1200 Logistics Pkwy", city: "Norcross", state: "GA", postal_code: "30071", timezone: "America/New_York", status: "ACTIVE" },
];

export async function GET() {
  try {
    const { supabase, profile, demo } = await requireAuth("WORKER");
    if (demo || !supabase) return NextResponse.json({ profile, projects: demoProjects, session: null, today: [], demo: true });
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const [projectsResult, sessionResult, eventsResult] = await Promise.all([
      supabase.from("project_assignments").select("project:projects(*)").eq("user_id", profile.id).eq("status", "ACTIVE"),
      supabase.from("work_sessions").select("*, project:projects(*)").eq("user_id", profile.id).eq("status", "OPEN").maybeSingle(),
      supabase.from("attendance_events").select("id,record_code,event_type,server_timestamp,project_name_snapshot").eq("user_id", profile.id).gte("server_timestamp", today.toISOString()).order("server_timestamp"),
    ]);
    if (projectsResult.error) throw projectsResult.error;
    if (sessionResult.error) throw sessionResult.error;
    if (eventsResult.error) throw eventsResult.error;
    return NextResponse.json({
      profile,
      projects: projectsResult.data?.map((row) => row.project).filter(Boolean) ?? [],
      session: sessionResult.data,
      today: eventsResult.data ?? [],
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
