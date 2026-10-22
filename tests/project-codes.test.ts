import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { nextProjectCode } from "../lib/project-codes.ts";

describe("nextProjectCode", () => {
  test("starts at P000001", () => {
    assert.equal(nextProjectCode([]), "P000001");
  });

  test("follows the highest sequenced code, ignoring other formats and gaps", () => {
    assert.equal(nextProjectCode(["P000001", "P000007", "P000003"]), "P000008");
    assert.equal(nextProjectCode(["ADI-AMR-26", "WMT-ATL-04", "PRJ-0001", "P-000009", null, undefined, ""]), "P000001");
    assert.equal(nextProjectCode(["ADI-AMR-26", "P000123"]), "P000124");
  });

  test("reads hand-typed variants of the format", () => {
    assert.equal(nextProjectCode([" p000041 ", "P41A", "P12"]), "P000042");
  });

  test("widens past six digits instead of wrapping", () => {
    assert.equal(nextProjectCode(["P999999"]), "P1000000");
  });
});
