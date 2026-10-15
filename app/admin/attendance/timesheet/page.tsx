import { requirePageRole } from "@/lib/page-auth";
import AdminShell from "../../AdminShell";

// Administrators only: managers are sent back to their overview.
export default async function AttendanceTimesheetPage() {
  await requirePageRole("ADMIN", "/admin");
  return <AdminShell view="attendance-timesheet" />;
}
