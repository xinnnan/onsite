import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { isUnitedStates, normalizeProjectState, US_STATES, usStateCode } from "../lib/us-states.ts";

describe("US_STATES", () => {
  test("lists the 50 states, DC and Puerto Rico once each", () => {
    assert.equal(US_STATES.length, 52);
    assert.equal(new Set(US_STATES.map(([code]) => code)).size, 52);
  });
});

describe("usStateCode", () => {
  test("accepts codes and full names in any case and spacing", () => {
    assert.equal(usStateCode("IN"), "IN");
    assert.equal(usStateCode(" in "), "IN");
    assert.equal(usStateCode("Indiana"), "IN");
    assert.equal(usStateCode("new   york"), "NY");
    assert.equal(usStateCode("N.Y."), "NY");
    assert.equal(usStateCode("Washington"), "WA");
    assert.equal(usStateCode("Washington, D.C."), "DC");
  });

  test("returns null for anything else", () => {
    assert.equal(usStateCode("Ontario"), null);
    assert.equal(usStateCode(""), null);
    assert.equal(usStateCode(null), null);
  });
});

describe("isUnitedStates", () => {
  test("recognizes the usual spellings", () => {
    for (const country of ["United States", "united states of america", "USA", "U.S.", "U.S.A."]) assert.equal(isUnitedStates(country), true, country);
    for (const country of ["Canada", "", null, "Mexico"]) assert.equal(isUnitedStates(country), false, String(country));
  });
});

describe("normalizeProjectState", () => {
  test("stores US states as their code", () => {
    assert.equal(normalizeProjectState("United States", "georgia"), "GA");
    assert.equal(normalizeProjectState("USA", "tx"), "TX");
  });

  test("keeps unknown US values and other countries' states as typed", () => {
    assert.equal(normalizeProjectState("United States", "Guam Territory"), "Guam Territory");
    assert.equal(normalizeProjectState("Canada", "Ontario"), "Ontario");
    assert.equal(normalizeProjectState("Australia", "wa"), "wa");
  });

  test("keeps empty states empty", () => {
    assert.equal(normalizeProjectState("United States", null), null);
    assert.equal(normalizeProjectState("United States", undefined), null);
    assert.equal(normalizeProjectState("United States", ""), "");
  });
});
