import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ALL_ACCESS, accessScopeFor, isWorkerInScope, normalizeCompany, roleCompanyError } from "../lib/access-scope.ts";

const acme = { kind: "COMPANY", company: "Acme Robotics" } as const;

describe("accessScopeFor", () => {
  test("gives administrators every company", () => {
    assert.deepEqual(accessScopeFor({ role: "ADMIN", company: null }), ALL_ACCESS);
    assert.deepEqual(accessScopeFor({ role: "ADMIN", company: "Acme Robotics" }), ALL_ACCESS);
  });

  test("limits managers to their own trimmed company", () => {
    assert.deepEqual(accessScopeFor({ role: "MANAGER", company: "  Acme Robotics " }), acme);
  });

  test("fails closed for managers without a company and for workers", () => {
    assert.equal(accessScopeFor({ role: "MANAGER", company: null }), null);
    assert.equal(accessScopeFor({ role: "MANAGER", company: "   " }), null);
    assert.equal(accessScopeFor({ role: "WORKER", company: "Acme Robotics" }), null);
  });
});

describe("isWorkerInScope", () => {
  const worker = { role: "WORKER", status: "ACTIVE", company: "Acme Robotics" };

  test("lets administrators see everyone, including disabled people", () => {
    assert.equal(isWorkerInScope(ALL_ACCESS, { ...worker, status: "DISABLED", company: "Other Co" }), true);
    assert.equal(isWorkerInScope(ALL_ACCESS, null), true);
  });

  test("shows managers the active workers of their company", () => {
    assert.equal(isWorkerInScope(acme, worker), true);
    assert.equal(isWorkerInScope(acme, { ...worker, company: " Acme Robotics" }), true);
  });

  test("hides other companies, disabled people, non-workers and missing workers from managers", () => {
    assert.equal(isWorkerInScope(acme, { ...worker, company: "Other Co" }), false);
    assert.equal(isWorkerInScope(acme, { ...worker, company: "acme robotics" }), false);
    assert.equal(isWorkerInScope(acme, { ...worker, company: null }), false);
    assert.equal(isWorkerInScope(acme, { ...worker, status: "DISABLED" }), false);
    assert.equal(isWorkerInScope(acme, { ...worker, role: "MANAGER" }), false);
    assert.equal(isWorkerInScope(acme, { ...worker, role: "ADMIN" }), false);
    assert.equal(isWorkerInScope(acme, null), false);
    assert.equal(isWorkerInScope(acme, undefined), false);
  });
});

describe("roleCompanyError", () => {
  test("requires a company for managers only", () => {
    assert.equal(roleCompanyError("MANAGER", "Acme Robotics"), null);
    assert.equal(roleCompanyError("MANAGER", ""), "MANAGER_COMPANY_REQUIRED");
    assert.equal(roleCompanyError("MANAGER", null), "MANAGER_COMPANY_REQUIRED");
    assert.equal(roleCompanyError("WORKER", null), null);
    assert.equal(roleCompanyError("ADMIN", ""), null);
    assert.equal(roleCompanyError(undefined, null), null);
  });
});

describe("normalizeCompany", () => {
  test("trims names and treats blanks as no company", () => {
    assert.equal(normalizeCompany(" Acme "), "Acme");
    assert.equal(normalizeCompany(""), null);
    assert.equal(normalizeCompany(undefined), null);
  });
});
