import type { UserRole } from "./types.ts";

/**
 * What an admin-area account may see. Administrators see every company; a manager sees only the
 * active workers of their own company (`profiles.company`) and those workers' records.
 */
export type AccessScope =
  | { kind: "ALL" }
  | { kind: "COMPANY"; company: string };

export const ALL_ACCESS: AccessScope = { kind: "ALL" };

export type ScopedWorker = { role?: string | null; status?: string | null; company?: string | null };

export function normalizeCompany(value: string | null | undefined) {
  return value?.trim() || null;
}

/** A manager without a company would have no scope to work in, so the pair is rejected. */
export function roleCompanyError(role: UserRole | undefined, company: string | null | undefined) {
  return role === "MANAGER" && !normalizeCompany(company) ? "MANAGER_COMPANY_REQUIRED" : null;
}

/** Returns null when the account has no admin-area scope, so callers fail closed. */
export function accessScopeFor(profile: { role: UserRole; company: string | null }): AccessScope | null {
  if (profile.role === "ADMIN") return ALL_ACCESS;
  const company = normalizeCompany(profile.company);
  return profile.role === "MANAGER" && company ? { kind: "COMPANY", company } : null;
}

export function isWorkerInScope(scope: AccessScope, worker: ScopedWorker | null | undefined) {
  if (scope.kind === "ALL") return true;
  return worker?.role === "WORKER" && worker.status === "ACTIVE" && normalizeCompany(worker.company) === scope.company;
}

/**
 * Whether the scope may edit a project and change its assignments. A project's company owns it;
 * projects without one stay with administrators, so managers never edit shared projects.
 */
export function canManageProject(scope: AccessScope, project: { company?: string | null } | null | undefined) {
  if (scope.kind === "ALL") return true;
  return Boolean(project) && normalizeCompany(project?.company) === scope.company;
}
