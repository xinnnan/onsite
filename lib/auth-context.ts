import "server-only";
import { cookies } from "next/headers";
import { accessScopeFor } from "@/lib/access-scope";
import { ApiError } from "@/lib/api";
import { createSupabaseServerClient, isDemoMode, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";
import { DEMO_COMPANY_NAME } from "@/lib/demo";

const DEMO_ACCOUNTS: Record<UserRole, Pick<Profile, "id" | "auth_user_id" | "username" | "display_name">> = {
  ADMIN: { id: "demo-admin", auth_user_id: "demo-admin-auth", username: "admin.demo", display_name: "Alex Lee" },
  MANAGER: { id: "demo-manager", auth_user_id: "demo-manager-auth", username: "manager.demo", display_name: "Maria Lopez" },
  WORKER: { id: "demo-worker", auth_user_id: "demo-worker-auth", username: "john01", display_name: "John Smith" },
};

export async function requireAuth(requiredRole?: UserRole | readonly UserRole[]) {
  const allowedRoles = requiredRole === undefined ? null : typeof requiredRole === "string" ? [requiredRole] : requiredRole;
  const supabase = isSupabaseConfigured() ? await createSupabaseServerClient() : null;

  if (!supabase) {
    if (!isDemoMode()) throw new ApiError(503, "SUPABASE_NOT_CONFIGURED");
    const demoRole = (await cookies()).get("onsite-demo-role")?.value as UserRole | undefined;
    if (!demoRole || !Object.hasOwn(DEMO_ACCOUNTS, demoRole)) throw new ApiError(401, "UNAUTHORIZED");
    if (allowedRoles && !allowedRoles.includes(demoRole)) throw new ApiError(403, "FORBIDDEN");
    const profile: Profile = {
      ...DEMO_ACCOUNTS[demoRole],
      company: DEMO_COMPANY_NAME,
      worker_type: "EMPLOYEE",
      role: demoRole,
      status: "ACTIVE",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return { user: { id: profile.auth_user_id }, profile, supabase: null, demo: true as const };
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new ApiError(401, "UNAUTHORIZED");
  const { data, error } = await supabase.from("profiles").select("*").eq("auth_user_id", user.id).single();
  if (error || !data) throw new ApiError(403, "PROFILE_NOT_FOUND");
  const profile = data as Profile;
  if (profile.status !== "ACTIVE") throw new ApiError(403, "ACCOUNT_INACTIVE");
  if (allowedRoles && !allowedRoles.includes(profile.role)) throw new ApiError(403, "FORBIDDEN");
  return { user, profile, supabase, demo: false as const };
}

/** For read-only admin-area routes that managers may also use; every query must honor `scope`. */
export async function requireScopedAccess() {
  const auth = await requireAuth(["ADMIN", "MANAGER"]);
  const scope = accessScopeFor(auth.profile);
  if (!scope) throw new ApiError(403, "MANAGER_COMPANY_REQUIRED");
  return { ...auth, scope };
}
