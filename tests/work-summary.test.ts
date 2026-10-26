import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getWorkSummaryMetrics, isWorkSummaryValid } from "../lib/work-summary.ts";

describe("isWorkSummaryValid", () => {
  test("accepts real Chinese summaries, including ones with numbers", () => {
    assert.equal(isWorkSummaryValid("上午客户现场网络有故障，影响了进度。另外机器人雷达出现异常，失灵，已经反馈到厂家跟进。"), true);
    assert.equal(isWorkSummaryValid("今天完成了2台机器人的例行保养，并协助客户处理现场设备运行问题，完成后确认设备状态正常。"), true);
    assert.equal(isWorkSummaryValid("完成设备编号1000000的巡检和保养，更换2个传感器，测试运行正常，现场无异常情况"), true);
  });

  test("accepts real English summaries", () => {
    assert.equal(isWorkSummaryValid("Completed inspections on six robots, replaced two sensors, and verified normal operation."), true);
    assert.equal(isWorkSummaryValid("Replaced 2 sensors on robot 7, updated firmware to version 3.2.1 and checked the charging dock today"), true);
  });

  test("rejects summaries that are only digits", () => {
    assert.equal(isWorkSummaryValid("1111111111111111111111111111111111111111111"), false);
    assert.equal(isWorkSummaryValid("1234567890 1234567890 1234567890 1234567890 12"), false);
    assert.equal(isWorkSummaryValid("111111111111111122222222222222111111111111111"), false);
  });

  test("rejects summaries padded with repeated characters", () => {
    assert.equal(isWorkSummaryValid("按公司安排工作22222222222222222222222222222222222"), false);
    assert.equal(isWorkSummaryValid("今天按公司安排工作，22222222222222222225555555555555"), false);
    assert.equal(isWorkSummaryValid("啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊"), false);
    assert.equal(isWorkSummaryValid("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), false);
    assert.equal(isWorkSummaryValid("。。。。。。。。。。。。。。。。。。。。。。。。。。。。。。。。。。。。。。。。"), false);
  });

  test("rejects a short phrase repeated over and over", () => {
    assert.equal(isWorkSummaryValid("工作工作工作工作工作工作工作工作工作工作工作工作"), false);
    assert.equal(isWorkSummaryValid("ok ok ok ok ok ok ok ok ok ok ok ok ok ok"), false);
  });

  test("still rejects blank and overlong summaries", () => {
    assert.equal(isWorkSummaryValid("   "), false);
    assert.equal(isWorkSummaryValid("巡检".repeat(501)), false);
  });
});

describe("getWorkSummaryMetrics", () => {
  test("does not count repeated characters or digits toward the requirement", () => {
    assert.deepEqual(getWorkSummaryMetrics("按公司安排工作22222222"), { chineseCharacters: 7, englishWords: 0, effectiveCharacters: 7 });
  });

  test("counts words that contain letters", () => {
    assert.equal(getWorkSummaryMetrics("Replaced 2 sensors on AMR7").englishWords, 4);
  });
});
