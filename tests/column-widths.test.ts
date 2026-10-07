import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { fitColumnWidths } from "../lib/column-widths.ts";

const columns = [
  { key: "date", min: 100, max: 170, weight: 0.4 },
  { key: "project", min: 170, weight: 3 },
  { key: "hours", min: 60, max: 110, weight: 0.3 },
  { key: "actions", min: 84 },
];

function total(widths: Record<string, number>) {
  return Object.values(widths).reduce((sum, width) => sum + width, 0);
}

describe("fitColumnWidths", () => {
  test("uses minimum widths when space is tight", () => {
    assert.deepEqual(fitColumnWidths(300, columns), { date: 100, project: 170, hours: 60, actions: 84 });
  });

  test("shares extra space by weight", () => {
    assert.deepEqual(fitColumnWidths(784, columns), { date: 140, project: 470, hours: 90, actions: 84 });
  });

  test("caps columns at their maximum and gives the rest to the others", () => {
    assert.deepEqual(fitColumnWidths(4114, columns), { date: 170, project: 3750, hours: 110, actions: 84 });
  });

  test("keeps resized columns fixed while the others flex", () => {
    assert.deepEqual(fitColumnWidths(784, columns, { project: 250 }), { date: 170, project: 250, hours: 110, actions: 84 });
  });

  test("never lets a resized column go below its minimum", () => {
    assert.equal(fitColumnWidths(300, columns, { date: 20 }).date, 100);
  });

  test("returns whole pixels that add up to the available width", () => {
    const widths = fitColumnWidths(415, columns);
    assert.ok(Object.values(widths).every(Number.isInteger));
    assert.equal(total(widths), 415);
  });
});
