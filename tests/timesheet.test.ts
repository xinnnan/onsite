import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  addShiftRow,
  applyPastedTimes,
  buildSaveRequests,
  buildTimesheetRows,
  fillBlankRows,
  isRowDirty,
  listDates,
  mergeFailedDrafts,
  normalizeTimeInput,
  removeShiftRow,
  resolveCheckOut,
  rowDurationSeconds,
  validateTimesheetRows,
  type TimesheetRow,
  type TimesheetSessionInput,
} from "../lib/timesheet.ts";

const NY = "America/New_York";
const CHI = "America/Chicago";
const projects = [
  { id: "ny", timezone: NY },
  { id: "chi", timezone: CHI },
];

function session(overrides: Partial<TimesheetSessionInput> = {}): TimesheetSessionInput {
  return {
    id: "s1",
    project_id: "ny",
    project_name: "Indy AMR",
    site_name: "Indy Plant",
    check_in_time: "2026-09-01T12:00:00.000Z",
    check_out_time: "2026-09-01T21:30:00.000Z",
    status: "COMPLETE",
    is_manual_entry: false,
    timezone: NY,
    ...overrides,
  };
}

function rowsFor(sessions: TimesheetSessionInput[], start = "2026-09-01", end = "2026-09-03") {
  return buildTimesheetRows({ start, end, sessions, defaultProjectId: "ny" });
}

function edit(rows: TimesheetRow[], key: string, patch: Partial<TimesheetRow>) {
  return rows.map((row) => (row.key === key ? { ...row, ...patch } : row));
}

describe("normalizeTimeInput", () => {
  test("expands spreadsheet-style shorthand to HH:MM", () => {
    assert.equal(normalizeTimeInput("8"), "08:00");
    assert.equal(normalizeTimeInput("830"), "08:30");
    assert.equal(normalizeTimeInput("1730"), "17:30");
    assert.equal(normalizeTimeInput("7:05"), "07:05");
    assert.equal(normalizeTimeInput(" 17.45 "), "17:45");
  });

  test("understands am/pm suffixes", () => {
    assert.equal(normalizeTimeInput("5:30pm"), "17:30");
    assert.equal(normalizeTimeInput("5p"), "17:00");
    assert.equal(normalizeTimeInput("12am"), "00:00");
    assert.equal(normalizeTimeInput("12 PM"), "12:00");
  });

  test("keeps empty input empty", () => {
    assert.equal(normalizeTimeInput(""), "");
    assert.equal(normalizeTimeInput("   "), "");
  });

  test("rejects impossible times", () => {
    assert.equal(normalizeTimeInput("25:00"), null);
    assert.equal(normalizeTimeInput("24:00"), null);
    assert.equal(normalizeTimeInput("8:61"), null);
    assert.equal(normalizeTimeInput("13pm"), null);
    assert.equal(normalizeTimeInput("abc"), null);
  });
});

describe("listDates", () => {
  test("lists every day inclusively across a month boundary", () => {
    assert.deepEqual(listDates("2026-08-30", "2026-09-02"), ["2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02"]);
  });

  test("includes leap days", () => {
    assert.deepEqual(listDates("2028-02-28", "2028-03-01"), ["2028-02-28", "2028-02-29", "2028-03-01"]);
  });

  test("returns nothing for a reversed or invalid range", () => {
    assert.deepEqual(listDates("2026-09-02", "2026-09-01"), []);
    assert.deepEqual(listDates("", "2026-09-01"), []);
  });
});

describe("resolveCheckOut", () => {
  test("keeps the same day when out is after in", () => {
    assert.equal(resolveCheckOut("2026-09-01", "08:00", "17:00"), "2026-09-01T17:00");
  });

  test("rolls to the next day when out is not after in", () => {
    assert.equal(resolveCheckOut("2026-09-30", "22:00", "06:00"), "2026-10-01T06:00");
  });

  test("returns null without an out time", () => {
    assert.equal(resolveCheckOut("2026-09-01", "08:00", ""), null);
  });
});

describe("buildTimesheetRows", () => {
  test("adds one blank row with the default project for each empty day", () => {
    const rows = rowsFor([]);
    assert.deepEqual(rows.map((row) => [row.key, row.date, row.projectId, row.sessionId, row.checkIn]), [
      ["new:2026-09-01:0", "2026-09-01", "ny", null, ""],
      ["new:2026-09-02:0", "2026-09-02", "ny", null, ""],
      ["new:2026-09-03:0", "2026-09-03", "ny", null, ""],
    ]);
  });

  test("converts session times to the session's local time zone", () => {
    const [row] = rowsFor([session()], "2026-09-01", "2026-09-01");
    assert.equal(row.key, "s1");
    assert.equal(row.date, "2026-09-01");
    assert.equal(row.checkIn, "08:00");
    assert.equal(row.checkOut, "17:30");
    assert.equal(row.locked, false);
    assert.deepEqual(row.original, {
      projectId: "ny",
      checkIn: "08:00",
      checkOut: "17:30",
      checkInUtc: "2026-09-01T12:00:00.000Z",
      checkOutUtc: "2026-09-01T21:30:00.000Z",
    });
  });

  test("lists several sessions on one day in time order", () => {
    const rows = rowsFor([
      session({ id: "late", check_in_time: "2026-09-01T18:00:00.000Z", check_out_time: "2026-09-01T22:00:00.000Z" }),
      session({ id: "early", check_in_time: "2026-09-01T12:00:00.000Z", check_out_time: "2026-09-01T16:00:00.000Z" }),
    ], "2026-09-01", "2026-09-01");
    assert.deepEqual(rows.map((row) => row.key), ["early", "late"]);
  });

  test("files an overnight session under its check-in day", () => {
    const [row] = rowsFor([session({ check_in_time: "2026-09-02T02:00:00.000Z", check_out_time: "2026-09-02T10:00:00.000Z" })], "2026-09-01", "2026-09-01");
    assert.equal(row.checkIn, "22:00");
    assert.equal(row.checkOut, "06:00");
    assert.equal(row.locked, false);
  });

  test("locks sessions longer than the grid can express", () => {
    const [row] = rowsFor([session({ check_in_time: "2026-09-03T12:00:00.000Z", check_out_time: "2026-09-04T18:00:00.000Z" })], "2026-09-03", "2026-09-03");
    assert.equal(row.locked, true);
  });
});

describe("rowDurationSeconds", () => {
  test("measures a same-day shift", () => {
    const rows = edit(rowsFor([]), "new:2026-09-01:0", { checkIn: "08:00", checkOut: "17:30" });
    assert.equal(rowDurationSeconds(rows[0], projects), 9.5 * 3600);
  });

  test("measures an overnight shift", () => {
    const rows = edit(rowsFor([]), "new:2026-09-01:0", { checkIn: "22:00", checkOut: "06:00" });
    assert.equal(rowDurationSeconds(rows[0], projects), 8 * 3600);
  });

  test("respects daylight saving changes in the project time zone", () => {
    const rows = edit(rowsFor([], "2026-11-01", "2026-11-01"), "new:2026-11-01:0", { checkIn: "00:00", checkOut: "06:00" });
    assert.equal(rowDurationSeconds(rows[0], projects), 7 * 3600);
  });

  test("is null while a time is missing or invalid", () => {
    const rows = edit(rowsFor([]), "new:2026-09-01:0", { checkIn: "08:00", checkOut: "" });
    assert.equal(rowDurationSeconds(rows[0], projects), null);
    assert.equal(rowDurationSeconds({ ...rows[0], checkOut: "nope" }, projects), null);
  });
});

describe("isRowDirty", () => {
  test("treats an untouched blank row as clean even if its project changes", () => {
    const [row] = rowsFor([]);
    assert.equal(isRowDirty(row), false);
    assert.equal(isRowDirty({ ...row, projectId: "chi" }), false);
  });

  test("treats a typed new row as dirty", () => {
    const [row] = rowsFor([]);
    assert.equal(isRowDirty({ ...row, checkIn: "8" }), true);
  });

  test("treats an existing row as dirty only when project or times change", () => {
    const [row] = rowsFor([session()], "2026-09-01", "2026-09-01");
    assert.equal(isRowDirty(row), false);
    assert.equal(isRowDirty({ ...row, checkIn: "8:00" }), false);
    assert.equal(isRowDirty({ ...row, checkIn: "09:00" }), true);
    assert.equal(isRowDirty({ ...row, projectId: "chi" }), true);
  });
});

describe("validateTimesheetRows", () => {
  test("requires both times on new rows", () => {
    const rows = edit(rowsFor([]), "new:2026-09-01:0", { checkIn: "08:00" });
    assert.deepEqual(validateTimesheetRows(rows, projects), { "new:2026-09-01:0": { code: "BOTH_TIMES_REQUIRED" } });
  });

  test("requires a project on new rows", () => {
    const rows = edit(rowsFor([]), "new:2026-09-01:0", { projectId: "", checkIn: "08:00", checkOut: "17:00" });
    assert.deepEqual(validateTimesheetRows(rows, projects), { "new:2026-09-01:0": { code: "PROJECT_REQUIRED" } });
  });

  test("does not let the check-in be cleared on an existing record", () => {
    const rows = edit(rowsFor([session()], "2026-09-01", "2026-09-01"), "s1", { checkIn: "" });
    assert.deepEqual(validateTimesheetRows(rows, projects), { s1: { code: "CHECK_IN_REQUIRED" } });
  });

  test("sends deletion to the record page when both times are cleared", () => {
    const rows = edit(rowsFor([session()], "2026-09-01", "2026-09-01"), "s1", { checkIn: "", checkOut: "" });
    assert.deepEqual(validateTimesheetRows(rows, projects), { s1: { code: "DELETE_ON_RECORD_PAGE" } });
  });

  test("flags unreadable and zero-length times", () => {
    let rows = edit(rowsFor([]), "new:2026-09-01:0", { checkIn: "8", checkOut: "99" });
    rows = edit(rows, "new:2026-09-02:0", { checkIn: "08:00", checkOut: "8" });
    assert.deepEqual(validateTimesheetRows(rows, projects), {
      "new:2026-09-01:0": { code: "INVALID_TIME" },
      "new:2026-09-02:0": { code: "SAME_TIME" },
    });
  });

  test("flags overlapping rows across projects and time zones", () => {
    let rows = edit(rowsFor([]), "new:2026-09-01:0", { checkIn: "08:00", checkOut: "12:00" });
    rows = addShiftRow(rows, "2026-09-01", "chi");
    rows = edit(rows, "new:2026-09-01:1", { checkIn: "10:00", checkOut: "13:00" });
    assert.deepEqual(validateTimesheetRows(rows, projects), {
      "new:2026-09-01:0": { code: "OVERLAP", conflictDate: "2026-09-01" },
      "new:2026-09-01:1": { code: "OVERLAP", conflictDate: "2026-09-01" },
    });
  });

  test("allows shifts that only touch end to start", () => {
    let rows = edit(rowsFor([]), "new:2026-09-01:0", { checkIn: "08:00", checkOut: "12:00" });
    rows = addShiftRow(rows, "2026-09-01", "chi");
    rows = edit(rows, "new:2026-09-01:1", { checkIn: "11:00", checkOut: "14:00" });
    assert.deepEqual(validateTimesheetRows(rows, projects), {});
  });

  test("blocks new rows after a record that has no check-out, like the server does", () => {
    const open = session({ id: "open", check_out_time: null, status: "MISSING_CHECKOUT" });
    const rows = edit(rowsFor([open]), "new:2026-09-03:0", { checkIn: "08:00", checkOut: "17:00" });
    assert.deepEqual(validateTimesheetRows(rows, projects), { "new:2026-09-03:0": { code: "OVERLAP", conflictDate: "2026-09-01" } });
  });

  test("lets existing records be edited after a record that has no check-out", () => {
    const open = session({ id: "open", check_out_time: null, status: "MISSING_CHECKOUT" });
    const later = session({ id: "later", check_in_time: "2026-09-03T12:00:00.000Z", check_out_time: "2026-09-03T20:00:00.000Z" });
    const rows = edit(rowsFor([open, later]), "later", { checkOut: "17:00" });
    assert.deepEqual(validateTimesheetRows(rows, projects), {});
  });

  test("ignores rows that were not changed", () => {
    const a = session({ id: "a" });
    const b = session({ id: "b", check_in_time: "2026-09-01T13:00:00.000Z" });
    assert.deepEqual(validateTimesheetRows(rowsFor([a, b]), projects), {});
  });
});

describe("buildSaveRequests", () => {
  const options = { workerId: "w1", reason: "Verified manually via timesheet" };

  test("creates manual entries for new rows", () => {
    const rows = edit(rowsFor([]), "new:2026-09-01:0", { checkIn: "8", checkOut: "1730" });
    assert.deepEqual(buildSaveRequests(rows, projects, options), [{
      key: "new:2026-09-01:0",
      method: "POST",
      url: "/api/admin/attendance/manual",
      body: { user_id: "w1", project_id: "ny", check_in_time: "2026-09-01T08:00", check_out_time: "2026-09-01T17:30", admin_note: "Verified manually via timesheet" },
    }]);
  });

  test("sends overnight check-outs on the next day", () => {
    const rows = edit(rowsFor([]), "new:2026-09-01:0", { checkIn: "22:00", checkOut: "06:00" });
    assert.equal(buildSaveRequests(rows, projects, options)[0].body.check_out_time, "2026-09-02T06:00");
  });

  test("corrects existing records as manually verified", () => {
    const rows = edit(rowsFor([session()], "2026-09-01", "2026-09-01"), "s1", { checkIn: "07:45" });
    assert.deepEqual(buildSaveRequests(rows, projects, options), [{
      key: "s1",
      method: "PATCH",
      url: "/api/admin/work-sessions/s1",
      body: { check_in_time: "2026-09-01T07:45", check_out_time: "2026-09-01T17:30", status: "MANUALLY_CORRECTED", reason: "Verified manually via timesheet" },
    }]);
  });

  test("includes the project only when it changed", () => {
    const rows = edit(rowsFor([session()], "2026-09-01", "2026-09-01"), "s1", { projectId: "chi" });
    assert.equal(buildSaveRequests(rows, projects, options)[0].body.project_id, "chi");
  });

  test("marks long shifts as long sessions", () => {
    const rows = edit(rowsFor([]), "new:2026-09-01:0", { checkIn: "06:00", checkOut: "05:00" });
    const existing = edit(rowsFor([session()], "2026-09-01", "2026-09-01"), "s1", { checkIn: "06:00", checkOut: "05:00" });
    assert.equal(buildSaveRequests(existing, projects, options)[0].body.status, "LONG_SESSION");
    assert.equal(buildSaveRequests(rows, projects, options)[0].method, "POST");
  });

  test("marks a cleared check-out as missing", () => {
    const rows = edit(rowsFor([session()], "2026-09-01", "2026-09-01"), "s1", { checkOut: "" });
    const [request] = buildSaveRequests(rows, projects, options);
    assert.equal(request.body.check_out_time, null);
    assert.equal(request.body.status, "MISSING_CHECKOUT");
  });

  test("keeps an open session open when only its check-in changes", () => {
    const open = session({ check_out_time: null, status: "OPEN" });
    const rows = edit(rowsFor([open], "2026-09-01", "2026-09-01"), "s1", { checkIn: "07:30" });
    assert.equal(buildSaveRequests(rows, projects, options)[0].body.status, "OPEN");
  });

  test("orders saves by day with edits before new entries", () => {
    const existing = session({ id: "s3", check_in_time: "2026-09-03T12:00:00.000Z", check_out_time: "2026-09-03T20:00:00.000Z" });
    let rows = edit(rowsFor([existing]), "s3", { checkIn: "07:00" });
    rows = addShiftRow(rows, "2026-09-03", "ny");
    rows = edit(rows, "new:2026-09-03:1", { checkIn: "17:00", checkOut: "19:00" });
    rows = edit(rows, "new:2026-09-02:0", { checkIn: "08:00", checkOut: "16:00" });
    assert.deepEqual(buildSaveRequests(rows, projects, options).map((request) => request.key), ["new:2026-09-02:0", "s3", "new:2026-09-03:1"]);
  });

  test("skips clean and invalid rows", () => {
    const rows = edit(rowsFor([session()]), "new:2026-09-02:0", { checkIn: "08:00" });
    assert.deepEqual(buildSaveRequests(rows, projects, options), []);
  });
});

describe("fillBlankRows", () => {
  test("fills untouched new rows on weekdays only", () => {
    const rows = fillBlankRows(rowsFor([], "2026-09-04", "2026-09-07"), { projectId: "chi", checkIn: "08:00", checkOut: "17:00", weekdaysOnly: true });
    assert.deepEqual(rows.map((row) => [row.date, row.projectId, row.checkIn, row.checkOut]), [
      ["2026-09-04", "chi", "08:00", "17:00"],
      ["2026-09-05", "ny", "", ""],
      ["2026-09-06", "ny", "", ""],
      ["2026-09-07", "chi", "08:00", "17:00"],
    ]);
  });

  test("leaves existing records and partly typed rows alone", () => {
    let rows = rowsFor([session()], "2026-09-01", "2026-09-02");
    rows = edit(rows, "new:2026-09-02:0", { checkIn: "09:00" });
    const filled = fillBlankRows(rows, { projectId: "ny", checkIn: "08:00", checkOut: "17:00", weekdaysOnly: false });
    assert.deepEqual(filled.map((row) => [row.checkIn, row.checkOut]), [["08:00", "17:30"], ["09:00", ""]]);
  });
});

describe("addShiftRow and removeShiftRow", () => {
  test("adds a unique blank row after the day's last row", () => {
    let rows = rowsFor([session()], "2026-09-01", "2026-09-02");
    rows = addShiftRow(rows, "2026-09-01", "chi");
    rows = addShiftRow(rows, "2026-09-01", "chi");
    assert.deepEqual(rows.map((row) => row.key), ["s1", "new:2026-09-01:1", "new:2026-09-01:2", "new:2026-09-02:0"]);
    assert.equal(rows[1].projectId, "chi");
  });

  test("removes an added row but resets a day's only row instead", () => {
    let rows = addShiftRow(rowsFor([], "2026-09-01", "2026-09-01"), "2026-09-01", "ny");
    rows = edit(rows, "new:2026-09-01:0", { checkIn: "08:00" });
    rows = removeShiftRow(rows, "new:2026-09-01:1", "ny");
    assert.deepEqual(rows.map((row) => row.key), ["new:2026-09-01:0"]);
    rows = removeShiftRow(rows, "new:2026-09-01:0", "ny");
    assert.deepEqual(rows.map((row) => [row.key, row.checkIn]), [["new:2026-09-01:0", ""]]);
  });
});

describe("applyPastedTimes", () => {
  test("fills in and out down the grid from the starting cell", () => {
    const rows = applyPastedTimes(rowsFor([]), "new:2026-09-01:0", "checkIn", "08:00\t17:00\r\n830\t1730\n");
    assert.deepEqual(rows.map((row) => [row.checkIn, row.checkOut]), [["08:00", "17:00"], ["08:30", "17:30"], ["", ""]]);
  });

  test("only fills the out column when pasting there", () => {
    const rows = applyPastedTimes(rowsFor([]), "new:2026-09-02:0", "checkOut", "17:00\t09:00");
    assert.deepEqual(rows.map((row) => [row.checkIn, row.checkOut]), [["", ""], ["", "17:00"], ["", ""]]);
  });

  test("skips locked rows and leaves blank cells unchanged", () => {
    const long = session({ id: "long", check_in_time: "2026-09-02T12:00:00.000Z", check_out_time: "2026-09-03T18:00:00.000Z" });
    let rows = rowsFor([long]);
    rows = edit(rows, "new:2026-09-03:0", { checkOut: "16:00" });
    rows = applyPastedTimes(rows, "new:2026-09-01:0", "checkIn", "08:00\t17:00\n09:00\t");
    assert.deepEqual(rows.map((row) => [row.key, row.checkIn, row.checkOut]), [
      ["new:2026-09-01:0", "08:00", "17:00"],
      ["long", "08:00", "14:00"],
      ["new:2026-09-03:0", "09:00", "16:00"],
    ]);
  });
});

describe("mergeFailedDrafts", () => {
  test("re-applies failed edits onto freshly loaded rows", () => {
    const fresh = rowsFor([session()], "2026-09-01", "2026-09-02");
    const drafts = [
      { ...fresh[0], checkIn: "07:00" },
      { ...fresh[1], checkIn: "08:00", checkOut: "17:00" },
    ];
    const merged = mergeFailedDrafts(fresh, drafts);
    assert.deepEqual(merged.map((row) => [row.key, row.checkIn, row.checkOut]), [["s1", "07:00", "17:30"], ["new:2026-09-02:0", "08:00", "17:00"]]);
    assert.equal(merged[0].original?.checkIn, "08:00");
  });

  test("appends failed extra shifts after the day's saved rows", () => {
    const fresh = rowsFor([session()], "2026-09-01", "2026-09-01");
    const draft = { ...addShiftRow(fresh, "2026-09-01", "ny")[1], checkIn: "18:00", checkOut: "20:00" };
    assert.deepEqual(mergeFailedDrafts(fresh, [draft]).map((row) => row.key), ["s1", "new:2026-09-01:1"]);
  });

  test("drops drafts whose day is no longer shown", () => {
    const fresh = rowsFor([], "2026-09-01", "2026-09-01");
    const draft = { ...rowsFor([], "2026-09-05", "2026-09-05")[0], checkIn: "08:00", checkOut: "17:00" };
    assert.deepEqual(mergeFailedDrafts(fresh, [draft]).map((row) => row.key), ["new:2026-09-01:0"]);
  });
});
