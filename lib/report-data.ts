import "server-only";
import { fetchAttendanceSessions, type AttendanceFilters } from "@/lib/admin-data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SnapshotSource = Record<string, string | number | null | undefined>;

async function fetchReportCompanyNames(filters: AttendanceFilters) {
  const admin = createSupabaseAdminClient();
  if (filters.workerId) {
    const { data, error } = await admin.from("profiles").select("company").eq("id", filters.workerId).maybeSingle();
    if (error) throw error;
    return data?.company ? [data.company] : [];
  }
  if (filters.projectId) {
    const { data, error } = await admin
      .from("project_assignments")
      .select("user:profiles!project_assignments_user_id_fkey(company)")
      .eq("project_id", filters.projectId)
      .eq("status", "ACTIVE");
    if (error) throw error;
    return (data || []).map((row) => {
      const user = Array.isArray(row.user) ? row.user[0] : row.user;
      return user?.company || "";
    }).filter(Boolean);
  }
  return [];
}

export function getSessionSnapshot(row: Record<string, unknown>) {
  const projectValue = row.project;
  const eventValue = row.check_in_event;
  const project = (Array.isArray(projectValue) ? projectValue[0] : projectValue) as SnapshotSource | null | undefined;
  const checkInEvent = (Array.isArray(eventValue) ? eventValue[0] : eventValue) as SnapshotSource | null | undefined;
  const mapPath = checkInEvent?.project_map_path_snapshot || project?.map_image_path || null;
  return {
    customerName: String(checkInEvent?.customer_name_snapshot || project?.customer_name || ""),
    projectName: String(checkInEvent?.project_name_snapshot || project?.project_name || ""),
    siteName: String(checkInEvent?.site_name_snapshot || project?.site_name || ""),
    address: String(checkInEvent?.project_address_snapshot || [project?.address_line_1, project?.city, project?.state, project?.postal_code].filter(Boolean).join(", ")),
    timezone: String(checkInEvent?.project_timezone_snapshot || project?.timezone || "UTC"),
    mapPath: typeof mapPath === "string" ? mapPath : null,
    latitude: checkInEvent?.project_latitude_snapshot ?? project?.latitude ?? null,
    longitude: checkInEvent?.project_longitude_snapshot ?? project?.longitude ?? null,
  };
}

export async function buildReportData(filters: AttendanceFilters) {
  const admin = createSupabaseAdminClient();
  const sessionsPromise = fetchAttendanceSessions(filters);
  const projectPromise = filters.projectId
    ? admin.from("projects").select("*").eq("id", filters.projectId).maybeSingle()
    : Promise.resolve({ data: null, error: null });
  const workerPromise = filters.workerId
    ? admin.from("profiles").select("id,display_name,company").eq("id", filters.workerId).maybeSingle()
    : Promise.resolve({ data: null, error: null });
  const [sessions, projectResult, workerResult, assignedCompanies] = await Promise.all([sessionsPromise, projectPromise, workerPromise, fetchReportCompanyNames(filters)]);
  if (projectResult.error) throw projectResult.error;
  if (workerResult.error) throw workerResult.error;
  const workers = new Map<string, { name: string; company: string; days: Set<string>; seconds: number }>();
  let totalSeconds = 0;
  let incomplete = 0;
  const workDays = new Set<string>();
  for (const row of sessions) {
    const worker = Array.isArray(row.worker) ? row.worker[0] : row.worker;
    const key = worker?.id || row.user_id;
    const day = String(row.check_in_time).slice(0, 10);
    const seconds = Number(row.duration_seconds || 0);
    workDays.add(day);
    totalSeconds += seconds;
    if (!["COMPLETE", "MANUALLY_CORRECTED"].includes(row.status)) incomplete += 1;
    const current = workers.get(key) || { name: worker?.display_name || "Unknown", company: worker?.company || "", days: new Set<string>(), seconds: 0 };
    current.days.add(day);
    current.seconds += seconds;
    workers.set(key, current);
  }
  const attendanceCompanies = Array.from(workers.values()).map((row) => row.company).filter(Boolean);
  const companyNames = [...new Set(attendanceCompanies.length ? attendanceCompanies : assignedCompanies)];
  return {
    sessions,
    selectedProject: projectResult.data,
    selectedWorker: workerResult.data,
    companyName: companyNames.join(" / ") || "—",
    summary: {
      total_personnel: workers.size,
      total_work_sessions: sessions.length,
      total_work_hours: Number((totalSeconds / 3600).toFixed(2)),
      total_work_days: workDays.size,
      incomplete_sessions: incomplete,
    },
    personnel: Array.from(workers.values()).map((row) => ({ name: row.name, company: row.company, days_on_site: row.days.size, hours: Number((row.seconds / 3600).toFixed(2)) })),
  };
}
