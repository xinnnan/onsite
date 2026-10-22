import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { nextProjectCode } from "../lib/project-codes.ts";

describe("nextProjectCode", () => {
  test("starts at PRJ-0001", () => {
    assert.equal(nextProjectCode([]), "PRJ-0001");
  });

  test("follows the highest sequenced code, ignoring other formats and gaps", () => {
    assert.equal(nextProjectCode(["PRJ-0001", "PRJ-0007", "PRJ-0003"]), "PRJ-0008");
    assert.equal(nextProjectCode(["ADI-AMR-26", "WMT-ATL-04", null, undefined, ""]), "PRJ-0001");
    assert.equal(nextProjectCode(["ADI-AMR-26", "PRJ-0012"]), "PRJ-0013");
  });

  test("reads hand-typed variants of the format", () => {
    assert.equal(nextProjectCode([" prj-0041 ", "PRJ-41-A"]), "PRJ-0042");
  });

  test("widens past four digits instead of wrapping", () => {
    assert.equal(nextProjectCode(["PRJ-9999"]), "PRJ-10000");
  });
});
