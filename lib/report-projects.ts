export type ReportProjectSession = {
  projectId: string;
  customerName: string;
  projectName: string;
  siteName: string;
  address: string;
  timezone: string;
  localDate: string;
  seconds: number;
};

export type ReportProjectSummary = {
  project_id: string;
  customer_name: string;
  project_name: string;
  site_name: string;
  address: string;
  timezone: string;
  days_on_site: number;
  work_sessions: number;
  hours: number;
};

// Sessions arrive newest first, so the first snapshot seen per project is the most recent one.
export function summarizeReportProjects(sessions: ReportProjectSession[]): ReportProjectSummary[] {
  const projects = new Map<string, { first: ReportProjectSession; days: Set<string>; sessions: number; seconds: number }>();
  for (const session of sessions) {
    const current = projects.get(session.projectId) || { first: session, days: new Set<string>(), sessions: 0, seconds: 0 };
    current.days.add(session.localDate);
    current.sessions += 1;
    current.seconds += session.seconds;
    projects.set(session.projectId, current);
  }
  return Array.from(projects.values())
    .map(({ first, days, sessions: count, seconds }) => ({
      project_id: first.projectId,
      customer_name: first.customerName,
      project_name: first.projectName,
      site_name: first.siteName,
      address: first.address,
      timezone: first.timezone,
      days_on_site: days.size,
      work_sessions: count,
      hours: Number((seconds / 3600).toFixed(2)),
    }))
    .sort((a, b) => a.customer_name.localeCompare(b.customer_name) || a.project_name.localeCompare(b.project_name));
}
