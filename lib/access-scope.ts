import type { UserRole } from "./types.ts";

/**
 * What an admin-area account may see and change. Administrators see every company; a manager works
 * only with the active workers of their own company (`profiles.company`), their records and their
 * company's projects (see fetchCompanyProjectIds).
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

/** Everyone who clocks in on site: workers, and managers who work on their company's projects too. */
export const CLOCK_IN_ROLES = ["WORKER", "MANAGER"] as const;

/** Whether someone may clock in and be assigned to projects: an active worker or manager. */
export function canClockIn(person: ScopedWorker | null | undefined) {
  return (CLOCK_IN_ROLES as readonly (string | null | undefined)[]).includes(person?.role) && person?.status === "ACTIVE";
}

/**
 * Whose attendance a scope sees, in records, the dashboard and reports: for managers, their own
 * company's active workers and managers, themselves included.
 */
export function isPersonInScope(scope: AccessScope, person: ScopedWorker | null | undefined) {
  if (scope.kind === "ALL") return true;
  return canClockIn(person) && normalizeCompany(person?.company) === scope.company;
}

/**
 * Whose accounts and attendance records a scope may change: for managers, only their own company's
 * active workers. Managers' records, their own included, are changed by administrators.
 */
export function isWorkerInScope(scope: AccessScope, worker: ScopedWorker | null | undefined) {
  if (scope.kind === "ALL") return true;
  return worker?.role === "WORKER" && isPersonInScope(scope, worker);
}

/**
 * The account a manager may create: always a worker in their own company, whatever company the
 * request names. Returns null when a manager asks for any other role, so the API can refuse it.
 */
export function scopedNewAccount<Account extends { role: UserRole; company?: string | null }>(scope: AccessScope, account: Account) {
  if (scope.kind === "ALL") return account;
  return account.role === "WORKER" ? { ...account, company: scope.company } : null;
}

const ACCESS_FIELDS = ["role", "company", "status"] as const;

/**
 * Managers edit their workers' details but never their access: role, company and account status
 * stay with administrators. Returns the first access field an update sets, or null.
 */
export function accessFieldChanged(update: Partial<Record<(typeof ACCESS_FIELDS)[number], unknown>>) {
  return ACCESS_FIELDS.find((field) => update[field] !== undefined) ?? null;
}
