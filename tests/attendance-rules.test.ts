import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { checkedInToday, overlappingSession } from "../lib/attendance-rules.ts";

describe("checkedInToday", () => {
  // 2026-10-07 18:00 in New York.
  const now = new Date("2026-10-07T22:00:00Z");

  test("finds a session that started earlier today in the project's time zone", () => {
    assert.equal(checkedInToday([{ check_in_time: "2026-10-07T10:50:00Z", check_out_time: "2026-10-07T21:26:00Z", status: "COMPLETE" }], now, "America/New_York"), true);
  });

  test("ignores yesterday's sessions, including one that ran past midnight", () => {
    assert.equal(checkedInToday([{ check_in_time: "2026-10-07T02:00:00Z", check_out_time: "2026-10-07T09:00:00Z", status: "COMPLETE" }], now, "America/New_York"), false, "10pm on Oct 6 in New York");
  });

  test("uses the project's day, not UTC's", () => {
    const evening = new Date("2026-10-08T01:00:00Z"); // 9pm on Oct 7 in New York, Oct 8 in UTC
    assert.equal(checkedInToday([{ check_in_time: "2026-10-07T11:00:00Z", status: "COMPLETE" }], evening, "America/New_York"), true);
    assert.equal(checkedInToday([{ check_in_time: "2026-10-07T11:00:00Z", status: "COMPLETE" }], evening, "UTC"), false);
  });

  test("does not count voided sessions", () => {
    assert.equal(checkedInToday([{ check_in_time: "2026-10-07T10:50:00Z", status: "VOID" }], now, "America/New_York"), false);
    assert.equal(checkedInToday([], now, "America/New_York"), false);
  });
});

describe("overlappingSession", () => {
  const span = (start: string, end: string | null) => ({ start: new Date(start), end: end ? new Date(end) : null });
  const sessions = [
    { id: "a", check_in_time: "2026-10-07T10:50:00Z", check_out_time: "2026-10-07T21:26:00Z", status: "COMPLETE" },
    { id: "void", check_in_time: "2026-10-08T10:00:00Z", check_out_time: "2026-10-08T20:00:00Z", status: "VOID" },
    { id: "open", check_in_time: "2026-10-09T10:00:00Z", check_out_time: null, status: "OPEN" },
  ];

  test("catches the screenshot's case: 06:58–17:11 inside 06:50–17:26", () => {
    assert.equal(overlappingSession(span("2026-10-07T10:58:00Z", "2026-10-07T21:11:00Z"), sessions)?.id, "a");
  });

  test("lets sessions touch end to start", () => {
    assert.equal(overlappingSession(span("2026-10-07T21:26:00Z", "2026-10-07T23:00:00Z"), sessions), null);
    assert.equal(overlappingSession(span("2026-10-07T08:00:00Z", "2026-10-07T10:50:00Z"), sessions), null);
  });

  test("ignores voided sessions", () => {
    assert.equal(overlappingSession(span("2026-10-08T11:00:00Z", "2026-10-08T12:00:00Z"), sessions), null);
  });

  test("treats open sessions and missing ends as running on", () => {
    assert.equal(overlappingSession(span("2026-10-10T08:00:00Z", "2026-10-10T09:00:00Z"), sessions)?.id, "open");
    assert.equal(overlappingSession(span("2026-10-07T20:00:00Z", null), sessions)?.id, "a");
    assert.equal(overlappingSession(span("2026-10-08T22:00:00Z", null), sessions)?.id, "open");
  });
});
