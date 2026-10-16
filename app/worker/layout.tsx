import { connection } from "next/server";
import { CLOCK_IN_ROLES } from "@/lib/access-scope";
import { requirePageRole } from "@/lib/page-auth";

export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  await connection();
  // Managers clock in here too.
  await requirePageRole(CLOCK_IN_ROLES);
  return children;
}
