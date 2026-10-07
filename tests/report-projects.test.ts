import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { summarizeReportProjects } from "../lib/report-projects.ts";

function item(overrides: Partial<Parameters<typeof summarizeReportProjects>[0][number]> = {}) {
  return {
    projectId: "p1",
    customerName: "adidas",
    projectName: "Indy AMR",
    siteName: "Indy Plant",
    address: "8677 Impact Court",
    timezone: "America/Indiana/Indianapolis",
    localDate: "2026-09-01",
    seconds: 3600,
    ...overrides,
  };
}

describe("summarizeReportProjects", () => {
  test("returns an empty roster for no sessions", () => {
    assert.deepEqual(summarizeReportProjects([]), []);
  });

  test("groups sessions per project with distinct days, sessions and rounded hours", () => {
    const roster = summarizeReportProjects([
      item({ localDate: "2026-09-01", seconds: 4 * 3600 }),
      item({ localDate: "2026-09-01", seconds: 3 * 3600 + 20 * 60 }),
      item({ localDate: "2026-09-02", seconds: 8 * 3600 }),
    ]);
    assert.equal(roster.length, 1);
    assert.deepEqual(roster[0], {
      project_id: "p1",
      customer_name: "adidas",
      project_name: "Indy AMR",
      site_name: "Indy Plant",
      address: "8677 Impact Court",
      timezone: "America/Indiana/Indianapolis",
      days_on_site: 2,
      work_sessions: 3,
      hours: 15.33,
    });
  });

  test("keeps the first-seen snapshot because sessions arrive newest first", () => {
    const roster = summarizeReportProjects([
      item({ projectName: "Indy AMR Phase 2" }),
      item({ projectName: "Indy AMR (old name)", localDate: "2026-08-01" }),
    ]);
    assert.equal(roster[0].project_name, "Indy AMR Phase 2");
  });

  test("sorts the roster by customer then project name", () => {
    const roster = summarizeReportProjects([
      item({ projectId: "p3", customerName: "Nike", projectName: "Memphis DC" }),
      item({ projectId: "p2", customerName: "adidas", projectName: "Zeta" }),
      item({ projectId: "p1", customerName: "adidas", projectName: "Alpha" }),
    ]);
    assert.deepEqual(roster.map((row) => row.project_id), ["p1", "p2", "p3"]);
  });
});
