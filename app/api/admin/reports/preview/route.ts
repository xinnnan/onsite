import { ApiError, apiErrorResponse } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";
import { buildReportData, getSessionSnapshot } from "@/lib/report-data";
import { signPrivateAsset } from "@/lib/admin-data";
import { DEMO_COMPANY_NAME } from "@/lib/demo";
import { getSessionTimeZone, localDateKey } from "@/lib/timezones";

export const runtime = "nodejs";

type PreviewRequest = {
  project_id?: string;
  worker_id?: string;
  start?: string;
  end?: string;
};

function demoPreview(body: PreviewRequest) {
  const project = {
    customer_name: "adidas",
    project_name: "adidas Indy AMR",
    site_name: "Indy Manufacturing Facility",
    address: "8677 Impact Court, Indianapolis, IN 46219",
    latitude: 39.780625,
    longitude: -86.045711,
    timezone: "America/Indiana/Indianapolis",
    map_url: null,
  };
  return {
    filters: body,
    all_projects: !body.project_id,
    company_name: DEMO_COMPANY_NAME,
    project: body.project_id ? project : null,
    projects: [{ project_id: "demo-project", customer_name: project.customer_name, project_name: project.project_name, site_name: project.site_name, address: project.address, timezone: project.timezone, days_on_site: 1, work_sessions: 1, hours: 9.18 }],
    summary: { total_personnel: 1, total_work_sessions: 1, total_work_hours: 9.18, total_work_days: 1, incomplete_sessions: 0 },
    personnel: [{ name: "John Smith", company: DEMO_COMPANY_NAME, days_on_site: 1, hours: 9.18 }],
    sessions: [{ id: "demo-session", date: "2026-08-17", timezone: "America/Indiana/Indianapolis", worker_name: "John Smith", company: DEMO_COMPANY_NAME, project_name: project.project_name, site_name: project.site_name, check_in: "2026-08-17T12:03:00Z", check_out: "2026-08-17T21:14:00Z", hours: 9.18, status: "COMPLETE", daily_work_summary: "完成 6 台机器人的例行检查，更换 2 个传感器并测试运行状态正常。", is_manual_entry: false }],
  };
}

export async function POST(request: Request) {
  try {
    const { demo } = await requireAuth("ADMIN");
    const body = await request.json() as PreviewRequest;
    if (body.start && body.end && body.start > body.end) throw new ApiError(400, "INVALID_REPORT_PERIOD");
    if (demo) return Response.json(demoPreview(body), { headers: { "cache-control": "no-store" } });

    const report = await buildReportData({
      projectId: body.project_id,
      workerId: body.worker_id,
      start: body.start,
      end: body.end,
    });
    const allProjects = !body.project_id;
    const first = report.sessions[0];
    const snapshot = first ? getSessionSnapshot(first) : null;
    const project = report.selectedProject;
    const mapPath = snapshot?.mapPath || project?.map_image_path || null;
    const mapUrl = allProjects ? null : await signPrivateAsset("project-assets", typeof mapPath === "string" ? mapPath : null);

    return Response.json({
      filters: body,
      all_projects: allProjects,
      company_name: report.companyName,
      projects: report.projects,
      project: allProjects ? null : {
        customer_name: snapshot?.customerName || project?.customer_name || "—",
        project_name: snapshot?.projectName || project?.project_name || "—",
        site_name: snapshot?.siteName || project?.site_name || "—",
        address: snapshot?.address || [project?.address_line_1, project?.address_line_2, project?.city, project?.state, project?.postal_code].filter(Boolean).join(", ") || "—",
        latitude: snapshot?.latitude ?? project?.latitude ?? null,
        longitude: snapshot?.longitude ?? project?.longitude ?? null,
        timezone: snapshot?.timezone || project?.timezone || "UTC",
        map_url: mapUrl,
      },
      summary: report.summary,
      personnel: report.personnel,
      sessions: report.sessions.slice(0, 250).map((row) => {
        const worker = Array.isArray(row.worker) ? row.worker[0] : row.worker;
        const timezone = getSessionTimeZone(row);
        const sessionSnapshot = getSessionSnapshot(row);
        return {
          id: row.id,
          date: localDateKey(row.check_in_time, timezone),
          timezone,
          worker_name: worker?.display_name || "—",
          company: worker?.company || "—",
          project_name: sessionSnapshot.projectName || "—",
          site_name: sessionSnapshot.siteName || "—",
          check_in: row.check_in_time,
          check_out: row.check_out_time,
          hours: row.duration_seconds == null ? null : Number((Number(row.duration_seconds) / 3600).toFixed(2)),
          status: row.status,
          daily_work_summary: row.daily_work_summary || null,
          is_manual_entry: Boolean(row.is_manual_entry),
        };
      }),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
