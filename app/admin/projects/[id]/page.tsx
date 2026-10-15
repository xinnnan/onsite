import { requirePageRole } from "@/lib/page-auth";
import AdminShell from "../../AdminShell";

// Administrators only: managers are sent back to their overview.
export default async function ProjectPage() {
  await requirePageRole("ADMIN", "/admin");
  return <AdminShell view="project-detail" />;
}
