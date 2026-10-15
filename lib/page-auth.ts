import "server-only";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth-context";
import type { UserRole } from "@/lib/types";

export async function requirePageRole(role: UserRole | readonly UserRole[], fallback = "/") {
  try {
    return await requireAuth(role);
  } catch {
    redirect(fallback);
  }
}
