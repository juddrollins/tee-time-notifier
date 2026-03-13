import { describe, test, expect } from "vitest";
import { compareResults } from "./index";
import type { FetchResult } from "../lib/types";

function makeTeeTime(id: number, dateScheduled: string) {
  return {
    golfCourseId: 16503,
    golfCourseName: "Falls Road Golf Course",
    teeTimeId: id,
    teeTimeTitle: null,
    dateScheduled,
    teeFeeId: 2404,
    teeFeeTitle: "Public",
    priceBeforeTax: 56,
    minPlayers: 1,
    maxPlayers: 4,
    bookedPlayers: 0,
  };
}

function makeFetchResult(teeTimes: ReturnType<typeof makeTeeTime>[]): FetchResult {
  return {
    fetchedAt: new Date().toISOString(),
    saturday: "2026-03-14",
    sunday: "2026-03-15",
    teeTimes,
  };
}

describe("compareResults", () => {
  test("returns new tee times that appear in latest but not baseline", () => {
    const baseline = makeFetchResult([
      makeTeeTime(101, "2026-03-14T08:00:00"),
      makeTeeTime(102, "2026-03-14T08:08:00"),
    ]);
    const latest = makeFetchResult([
      makeTeeTime(101, "2026-03-14T08:00:00"),
      makeTeeTime(102, "2026-03-14T08:08:00"),
      makeTeeTime(103, "2026-03-14T08:16:00"),
      makeTeeTime(104, "2026-03-14T08:24:00"),
    ]);

    const result = compareResults(baseline, latest, "baseline.json", "latest.json");

    expect(result.newTimes).toHaveLength(2);
    expect(result.newTimes.map((t) => t.teeTimeId)).toEqual([103, 104]);
  });

  test("returns empty array when no new tee times", () => {
    const baseline = makeFetchResult([makeTeeTime(101, "2026-03-14T08:00:00")]);
    const latest = makeFetchResult([makeTeeTime(101, "2026-03-14T08:00:00")]);

    const result = compareResults(baseline, latest, "baseline.json", "latest.json");

    expect(result.newTimes).toHaveLength(0);
  });

  test("returns disappeared times that were in baseline but not latest", () => {
    const baseline = makeFetchResult([
      makeTeeTime(101, "2026-03-14T08:00:00"),
      makeTeeTime(102, "2026-03-14T08:08:00"),
    ]);
    const latest = makeFetchResult([
      makeTeeTime(101, "2026-03-14T08:00:00"),
    ]);

    const result = compareResults(baseline, latest, "baseline.json", "latest.json");

    expect(result.disappearedTimes).toHaveLength(1);
    expect(result.disappearedTimes[0].teeTimeId).toBe(102);
  });

  test("result includes baselineFetchedAt and latestFetchedAt", () => {
    const baseline = makeFetchResult([makeTeeTime(101, "2026-03-14T08:00:00")]);
    const latest = makeFetchResult([makeTeeTime(101, "2026-03-14T08:00:00")]);

    const result = compareResults(baseline, latest, "baseline.json", "latest.json");

    expect(result.baselineFetchedAt).toBe(baseline.fetchedAt);
    expect(result.latestFetchedAt).toBe(latest.fetchedAt);
  });

  test("result includes correct metadata", () => {
    const baseline = makeFetchResult([makeTeeTime(101, "2026-03-14T08:00:00")]);
    const latest = makeFetchResult([makeTeeTime(101, "2026-03-14T08:00:00")]);

    const result = compareResults(baseline, latest, "2026-03-07T08-00-00Z.json", "2026-03-07T08-20-00Z.json");

    expect(result.saturday).toBe("2026-03-14");
    expect(result.sunday).toBe("2026-03-15");
    expect(result.baselineFile).toBe("2026-03-07T08-00-00Z.json");
    expect(result.latestFile).toBe("2026-03-07T08-20-00Z.json");
  });

  test("detects new times when comparing first vs last of many", () => {
    const baseline = makeFetchResult([makeTeeTime(101, "2026-03-14T08:00:00")]);
    const latest = makeFetchResult([
      makeTeeTime(101, "2026-03-14T08:00:00"),
      makeTeeTime(102, "2026-03-14T08:08:00"),
      makeTeeTime(103, "2026-03-14T08:16:00"),
    ]);

    const result = compareResults(baseline, latest, "2026-03-07T08-00-00Z.json", "2026-03-07T08-40-00Z.json");

    expect(result.newTimes.map((t) => t.teeTimeId)).toEqual([102, 103]);
  });
});
