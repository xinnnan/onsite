import { connection } from "next/server";
import { requirePageRole } from "@/lib/page-auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await connection();
  await requirePageRole("ADMIN");
  return children;
}
