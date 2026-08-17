import { connection } from "next/server";
import { requirePageRole } from "@/lib/page-auth";

export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  await connection();
  await requirePageRole("WORKER");
  return children;
}
