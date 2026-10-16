import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireScopedAccess } from "@/lib/auth-context";
import { fetchAttendanceSessions, fetchVisibleProjects, fetchVisibleWorkers } from "@/lib/admin-data";

export async function GET(request: NextRequest) {
  try {
    const { demo, scope } = await requireScopedAccess();
    if (demo) return NextResponse.json({ sessions: [], users: [], projects: [], demo: true });
    const params = request.nextUrl.searchParams;
    const [sessions, users, projects] = await Promise.all([
      fetchAttendanceSessions({
        projectId: params.get("project"), workerId: params.get("worker"), customer: params.get("customer"),
        company: params.get("company"), start: params.get("start"), end: params.get("end"), status: params.get("status"),
      }, scope),
      fetchVisibleWorkers(scope, "id,display_name,username,company,role,status"),
      fetchVisibleProjects(scope, "id,project_name,project_code,customer_name,site_name,timezone,status"),
    ]);
    return NextResponse.json({ sessions, users, projects });
  } catch (error) { return apiErrorResponse(error); }
}
