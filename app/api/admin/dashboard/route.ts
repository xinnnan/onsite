import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type DashboardRow = Record<string, unknown>;

function related(row: DashboardRow, key: string) {
  const value = row[key];
  return Array.isArray(value) ? value[0] : value;
}

function peopleFromRows(rows: DashboardRow[], timeField: string) {
  const people = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const worker = related(row, "worker") as Record<string, unknown> | null;
    const project = related(row, "project") as Record<string, unknown> | null;
    if (!worker?.id || people.has(String(worker.id))) continue;
    people.set(String(worker.id), {
      id: worker.id,
      display_name: worker.display_name,
      company: worker.company,
      project_name: project?.project_name,
      status: row.status,
      timestamp: row[timeField],
    });
  }
  return [...people.values()];
}

function selectedRange(request: NextRequest, today: Date) {
  const params = request.nextUrl.searchParams;
  const requestedDate = params.get("date");
  const date = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : today.toISOString().slice(0, 10);
  const requestedStart = Date.parse(params.get("start") || "");
  const requestedEnd = Date.parse(params.get("end") || "");
  const validRange = Number.isFinite(requestedStart) && Number.isFinite(requestedEnd)
    && requestedEnd > requestedStart && requestedEnd - requestedStart <= 27 * 60 * 60 * 1000;
  return {
    date,
    start: new Date(validRange ? requestedStart : Date.parse(`${date}T00:00:00.000Z`)),
    end: new Date(validRange ? requestedEnd : Date.parse(`${date}T00:00:00.000Z`) + 24 * 60 * 60 * 1000),
  };
}

function liveDayRange(request: NextRequest, today: Date) {
  const params = request.nextUrl.searchParams;
  const requestedStart = Date.parse(params.get("today_start") || "");
  const requestedEnd = Date.parse(params.get("today_end") || "");
  const validRange = Number.isFinite(requestedStart) && Number.isFinite(requestedEnd)
    && requestedEnd > requestedStart && requestedEnd - requestedStart <= 27 * 60 * 60 * 1000;
  return {
    start: new Date(validRange ? requestedStart : today.getTime()),
    end: new Date(validRange ? requestedEnd : today.getTime() + 24 * 60 * 60 * 1000),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { demo } = await requireAuth("ADMIN");
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const range = selectedRange(request, start);
    const liveRange = liveDayRange(request, start);
    if (demo) return NextResponse.json({
      stats: { currently_on_site: 1, checked_in_today: 2, checked_out_today: 1, complete_sessions: 1, missing_checkout: 0, exceptions: 0 },
      stat_people: {}, on_site: [], recent: [], selected_date: range.date, demo: true,
    });
    const admin = createSupabaseAdminClient();
    const weekStart = new Date(liveRange.start);
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);
    const [events, sessions, open, weekly, selected] = await Promise.all([
      admin.from("attendance_events").select("event_type,server_timestamp,worker:profiles!attendance_events_user_id_fkey(id,display_name,company),project:projects!attendance_events_project_id_fkey(id,project_name,customer_name)").gte("server_timestamp", liveRange.start.toISOString()).lt("server_timestamp", liveRange.end.toISOString()),
      admin.from("work_sessions").select("*,worker:profiles!work_sessions_user_id_fkey(id,display_name,company),project:projects!work_sessions_project_id_fkey(id,project_name,customer_name)").gte("check_in_time", liveRange.start.toISOString()).lt("check_in_time", liveRange.end.toISOString()).order("check_in_time", { ascending: false }),
      admin.from("work_sessions").select("*,worker:profiles!work_sessions_user_id_fkey(id,display_name,company),project:projects!work_sessions_project_id_fkey(id,project_name,customer_name)").eq("status", "OPEN").order("check_in_time"),
      admin.from("work_sessions").select("check_in_time,duration_seconds").gte("check_in_time", weekStart.toISOString()),
      admin.from("work_sessions").select("*,worker:profiles!work_sessions_user_id_fkey(id,display_name,company),project:projects!work_sessions_project_id_fkey(id,project_name,customer_name)").gte("check_in_time", range.start.toISOString()).lt("check_in_time", range.end.toISOString()).order("check_in_time", { ascending: false }).limit(500),
    ]);
    if (events.error) throw events.error;
    if (sessions.error) throw sessions.error;
    if (open.error) throw open.error;
    if (weekly.error) throw weekly.error;
    if (selected.error) throw selected.error;
    const eventRows = (events.data || []) as DashboardRow[];
    const sessionRows = (sessions.data || []) as DashboardRow[];
    const openRows = (open.data || []) as DashboardRow[];
    const exceptions = sessionRows.filter((row) => ["MISSING_CHECKOUT", "LONG_SESSION"].includes(String(row.status))).length;
    const dailyHours = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setUTCDate(weekStart.getUTCDate() + index);
      const day = date.toISOString().slice(0, 10);
      const seconds = (weekly.data || []).filter((row) => String(row.check_in_time).slice(0, 10) === day).reduce((sum, row) => sum + Number(row.duration_seconds || 0), 0);
      return { day, hours: Number((seconds / 3600).toFixed(2)) };
    });
    return NextResponse.json({
      stats: {
        currently_on_site: openRows.length,
        checked_in_today: eventRows.filter((row) => row.event_type === "CHECK_IN").length,
        checked_out_today: eventRows.filter((row) => row.event_type === "CHECK_OUT").length,
        complete_sessions: sessionRows.filter((row) => row.status === "COMPLETE").length,
        missing_checkout: sessionRows.filter((row) => row.status === "MISSING_CHECKOUT").length,
        exceptions,
      },
      stat_people: {
        currently_on_site: peopleFromRows(openRows, "check_in_time"),
        checked_in_today: peopleFromRows(eventRows.filter((row) => row.event_type === "CHECK_IN"), "server_timestamp"),
        checked_out_today: peopleFromRows(eventRows.filter((row) => row.event_type === "CHECK_OUT"), "server_timestamp"),
        complete_sessions: peopleFromRows(sessionRows.filter((row) => row.status === "COMPLETE"), "check_out_time"),
        missing_checkout: peopleFromRows(sessionRows.filter((row) => row.status === "MISSING_CHECKOUT"), "check_in_time"),
        exceptions: peopleFromRows(sessionRows.filter((row) => ["MISSING_CHECKOUT", "LONG_SESSION"].includes(String(row.status))), "check_in_time"),
      },
      on_site: openRows,
      recent: selected.data || [],
      selected_date: range.date,
      daily_hours: dailyHours,
    });
  } catch (error) { return apiErrorResponse(error); }
}
