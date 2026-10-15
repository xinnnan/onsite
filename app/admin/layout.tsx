import { connection } from "next/server";
import { requirePageRole } from "@/lib/page-auth";
import { ViewerProvider } from "./viewer";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const { profile } = await requirePageRole(["ADMIN", "MANAGER"]);
  return <ViewerProvider viewer={{ role: profile.role, company: profile.company, displayName: profile.display_name }}>{children}</ViewerProvider>;
}
