import "server-only";
import sharp from "sharp";
import { ALL_ACCESS, isWorkerInScope, normalizeCompany, type AccessScope, type ScopedWorker } from "@/lib/access-scope";
import { ApiError } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionTimeZone, localDateKey } from "@/lib/timezones";

type PrivateAssetBucket = "project-assets" | "attendance-originals" | "attendance-watermarked";

/**
 * Filters a query down to the scope's workers. The query must embed its worker as
 * `worker:profiles!<fk>!inner(...,company,role,status)`: the join has to be inner for the filter to
 * drop rows, and `keepInScope` reads those columns. Every scoped table's user_id is a NOT NULL
 * foreign key, so the inner join returns the same rows as a left join for administrators.
 */
export function scopeToWorkers<Query extends { match(filters: Record<string, string>): unknown }>(query: Query, scope: AccessScope): Query {
  if (scope.kind === "ALL") return query;
  // PostgREST builders return themselves, so the filtered query keeps its type.
  return query.match({ "worker.company": scope.company, "worker.status": "ACTIVE", "worker.role": "WORKER" }) as Query;
}

/** Re-checks fetched rows in code, so a query that loses its scope filter still cannot leak rows. */
export function keepInScope<Row>(scope: AccessScope, rows: Row[]) {
  if (scope.kind === "ALL") return rows;
  return rows.filter((row) => {
    const worker = (row as { worker?: unknown }).worker;
    return isWorkerInScope(scope, (Array.isArray(worker) ? worker[0] : worker) as ScopedWorker | undefined);
  });
}

export async function fetchVisibleWorkers(scope: AccessScope, columns: string, { activeOnly = true } = {}) {
  const admin = createSupabaseAdminClient();
  let query = admin.from("profiles").select(columns).eq("role", "WORKER");
  if (activeOnly || scope.kind === "COMPANY") query = query.eq("status", "ACTIVE");
  if (scope.kind === "COMPANY") query = query.eq("company", scope.company);
  const { data, error } = await query.order("display_name");
  if (error) throw error;
  return (data || []) as unknown as Record<string, unknown>[];
}

/**
 * A manager's projects: every project their company owns plus every project their company's active
 * workers are, or were, assigned to. Managers see, edit and staff exactly these, so a project needs
 * no owning company for its staff's manager to run it.
 */
export async function fetchCompanyProjectIds(company: string) {
  const admin = createSupabaseAdminClient();
  const [assignments, owned] = await Promise.all([
    admin.from("project_assignments").select("project_id,user:profiles!inner(id)")
      .eq("user.company", company).eq("user.status", "ACTIVE").eq("user.role", "WORKER"),
    admin.from("projects").select("id").eq("company", company),
  ]);
  if (assignments.error) throw assignments.error;
  if (owned.error) throw owned.error;
  return [...new Set([...(assignments.data || []).map((assignment) => String(assignment.project_id)), ...(owned.data || []).map((project) => String(project.id))])];
}

export async function fetchVisibleProjects(scope: AccessScope, columns: string, { activeOnly = true } = {}) {
  const admin = createSupabaseAdminClient();
  let query = admin.from("projects").select(columns);
  if (activeOnly) query = query.eq("status", "ACTIVE");
  if (scope.kind === "COMPANY") {
    const projectIds = await fetchCompanyProjectIds(scope.company);
    if (!projectIds.length) return [];
    query = query.in("id", projectIds);
  }
  const { data, error } = await query.order("project_name");
  if (error) throw error;
  return (data || []) as unknown as Record<string, unknown>[];
}

/** Rejects a project outside the scope with the same 404 as one that does not exist. */
export async function assertProjectInScope(scope: AccessScope, projectId: string) {
  if (scope.kind === "ALL") return;
  if (!(await fetchCompanyProjectIds(scope.company)).includes(projectId)) throw new ApiError(404, "PROJECT_NOT_FOUND");
}

/** Every company name in use, so administrators can pick an existing spelling for a project. */
export async function fetchCompanyNames() {
  const admin = createSupabaseAdminClient();
  const [profiles, projects] = await Promise.all([
    admin.from("profiles").select("company").not("company", "is", null),
    admin.from("projects").select("company").not("company", "is", null),
  ]);
  if (profiles.error) throw profiles.error;
  if (projects.error) throw projects.error;
  const names = [...(profiles.data || []), ...(projects.data || [])].map((row) => normalizeCompany(row.company)).filter((name): name is string => Boolean(name));
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

/** Drops embedded project assignments of workers outside the scope. */
export function keepScopedAssignments<Row extends { project_assignments?: unknown }>(scope: AccessScope, project: Row) {
  if (scope.kind === "ALL" || !Array.isArray(project.project_assignments)) return project;
  return { ...project, project_assignments: project.project_assignments.filter((assignment) => {
    const user = (assignment as { user?: unknown }).user;
    return isWorkerInScope(scope, (Array.isArray(user) ? user[0] : user) as ScopedWorker | undefined);
  }) };
}

/**
 * Checks every worker and project in an assignment change exists and is in reach: assigning needs
 * active workers and projects, and managers may only pair their own active workers with their own
 * projects, whether adding or removing.
 */
export async function assertAssignmentTargets(scope: AccessScope, { userIds, projectIds, assigned, errorCode }: { userIds: string[]; projectIds: string[]; assigned: boolean; errorCode: string }) {
  if (!assigned && scope.kind === "ALL") return;
  const admin = createSupabaseAdminClient();
  const [workers, projects, scopedProjectIds] = await Promise.all([
    admin.from("profiles").select("id,role,status,company").in("id", userIds),
    admin.from("projects").select("id,status").in("id", projectIds),
    scope.kind === "COMPANY" ? fetchCompanyProjectIds(scope.company) : null,
  ]);
  if (workers.error) throw workers.error;
  if (projects.error) throw projects.error;
  const validWorkers = (workers.data || []).filter((worker) => isWorkerInScope(scope, worker) && (!assigned || (worker.role === "WORKER" && worker.status === "ACTIVE")));
  const validProjects = (projects.data || []).filter((project) => (!scopedProjectIds || scopedProjectIds.includes(project.id)) && (!assigned || project.status === "ACTIVE"));
  if (validWorkers.length !== userIds.length || validProjects.length !== projectIds.length) throw new ApiError(400, errorCode);
}

/** Rejects report targets outside a manager's scope with the same 404 as a missing record. */
export async function assertReportTargetsInScope(scope: AccessScope, { workerId, projectId }: { workerId?: string | null; projectId?: string | null }) {
  if (scope.kind === "ALL") return;
  const [workers, projects] = await Promise.all([
    workerId ? fetchVisibleWorkers(scope, "id") : Promise.resolve([]),
    projectId ? fetchVisibleProjects(scope, "id", { activeOnly: false }) : Promise.resolve([]),
  ]);
  if (workerId && !workers.some((worker) => worker.id === workerId)) throw new ApiError(404, "WORKER_NOT_FOUND");
  if (projectId && !projects.some((project) => project.id === projectId)) throw new ApiError(404, "PROJECT_NOT_FOUND");
}

export interface AttendanceFilters {
  projectId?: string | null;
  workerId?: string | null;
  customer?: string | null;
  company?: string | null;
  start?: string | null;
  end?: string | null;
  status?: string | null;
}

export async function fetchAttendanceSessions(filters: AttendanceFilters = {}, scope: AccessScope = ALL_ACCESS) {
  const admin = createSupabaseAdminClient();
  let query = admin.from("work_sessions").select(`
    *,
    worker:profiles!work_sessions_user_id_fkey!inner(id,username,display_name,worker_type,company,role,status),
    project:projects!work_sessions_project_id_fkey(id,project_code,project_name,customer_name,site_name,address_line_1,address_line_2,city,state,postal_code,country,timezone,map_image_path,latitude,longitude),
    check_in_event:attendance_events!work_sessions_check_in_event_id_fkey(id,record_code,event_type,server_timestamp,project_name_snapshot,customer_name_snapshot,site_name_snapshot,project_address_snapshot,project_timezone_snapshot,project_map_path_snapshot,project_latitude_snapshot,project_longitude_snapshot,original_photo_path,watermarked_photo_path),
    check_out_event:attendance_events!work_sessions_check_out_event_id_fkey(id,record_code,event_type,server_timestamp,project_name_snapshot,customer_name_snapshot,site_name_snapshot,project_address_snapshot,project_timezone_snapshot,project_map_path_snapshot,project_latitude_snapshot,project_longitude_snapshot,original_photo_path,watermarked_photo_path)
  `).order("check_in_time", { ascending: false }).limit(1000);
  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  if (filters.workerId) query = query.eq("user_id", filters.workerId);
  if (filters.start) query = query.gte("check_in_time", new Date(Date.parse(`${filters.start}T00:00:00.000Z`) - 14 * 60 * 60 * 1000).toISOString());
  if (filters.end) query = query.lte("check_in_time", new Date(Date.parse(`${filters.end}T23:59:59.999Z`) + 12 * 60 * 60 * 1000).toISOString());
  if (filters.status) query = query.eq("status", filters.status);
  const { data, error } = await scopeToWorkers(query, scope);
  if (error) throw error;
  return keepInScope(scope, data || []).filter((row) => {
    const project = Array.isArray(row.project) ? row.project[0] : row.project;
    const worker = Array.isArray(row.worker) ? row.worker[0] : row.worker;
    const localDay = localDateKey(row.check_in_time, getSessionTimeZone(row));
    return (!filters.customer || project?.customer_name === filters.customer)
      && (!filters.company || worker?.company === filters.company)
      && (!filters.start || localDay >= filters.start)
      && (!filters.end || localDay <= filters.end);
  });
}

export async function signPrivateAsset(bucket: PrivateAssetBucket, path: string | null | undefined) {
  if (!path) return null;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, 60 * 10);
  return error ? null : data.signedUrl;
}

export async function loadPrivateAssetAsJpegDataUri(
  bucket: PrivateAssetBucket,
  path: string | null | undefined,
) {
  if (!path) return null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(bucket).download(path);
  if (error || !data) return null;

  try {
    const source = Buffer.from(await data.arrayBuffer());
    const jpeg = await sharp(source)
      .rotate()
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 76, progressive: true })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function signAttendancePhoto(bucket: "attendance-originals" | "attendance-watermarked", path: string | null | undefined) {
  return signPrivateAsset(bucket, path);
}
