import { describe, test, expect } from "vitest";
import { compareResults } from "./index";
import type { CompareResult } from "./index";
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

function makeExisting(
  availableTimes: ReturnType<typeof makeTeeTime>[],
  newTimes: ReturnType<typeof makeTeeTime>[],
  disappearedTimes: ReturnType<typeof makeTeeTime>[]
): CompareResult {
  return {
    comparedAt: new Date().toISOString(),
    saturday: "2026-03-14",
    sunday: "2026-03-15",
    availableTimes,
    newTimes,
    disappearedTimes,
    newThisRun: [],
  };
}

describe("compareResults — first run (no existing)", () => {
  test("seeds availableTimes from latest pull with nothing marked new", () => {
    const latest = makeFetchResult([
      makeTeeTime(101, "2026-03-14T08:00:00"),
      makeTeeTime(102, "2026-03-14T08:08:00"),
    ]);

    const result = compareResults(null, latest);

    expect(result.availableTimes).toHaveLength(2);
    expect(result.newTimes).toHaveLength(0);
    expect(result.disappearedTimes).toHaveLength(0);
    expect(result.newThisRun).toHaveLength(0);
  });
});

describe("compareResults — new times appear", () => {
  test("adds new time to availableTimes, newTimes, and newThisRun", () => {
    const existing = makeExisting(
      [makeTeeTime(101, "2026-03-14T08:00:00")],
      [],
      []
    );
    const latest = makeFetchResult([
      makeTeeTime(101, "2026-03-14T08:00:00"),
      makeTeeTime(102, "2026-03-14T08:08:00"),
    ]);

    const result = compareResults(existing, latest);

    expect(result.availableTimes.map((t) => t.teeTimeId)).toContain(102);
    expect(result.newTimes.map((t) => t.teeTimeId)).toContain(102);
    expect(result.newThisRun.map((t) => t.teeTimeId)).toEqual([102]);
  });

  test("does not duplicate a time in newTimes if it was already there", () => {
    const existing = makeExisting(
      [makeTeeTime(101, "2026-03-14T08:00:00"), makeTeeTime(102, "2026-03-14T08:08:00")],
      [makeTeeTime(102, "2026-03-14T08:08:00")],
      []
    );
    const latest = makeFetchResult([
      makeTeeTime(101, "2026-03-14T08:00:00"),
      makeTeeTime(102, "2026-03-14T08:08:00"),
      makeTeeTime(103, "2026-03-14T08:16:00"),
    ]);

    const result = compareResults(existing, latest);

    const newIds = result.newTimes.map((t) => t.teeTimeId);
    expect(newIds.filter((id) => id === 102)).toHaveLength(1);
    expect(newIds).toContain(103);
  });
});

describe("compareResults — times disappear", () => {
  test("removes disappeared time from availableTimes and adds to disappearedTimes", () => {
    const existing = makeExisting(
      [makeTeeTime(101, "2026-03-14T08:00:00"), makeTeeTime(102, "2026-03-14T08:08:00")],
      [],
      []
    );
    const latest = makeFetchResult([makeTeeTime(101, "2026-03-14T08:00:00")]);

    const result = compareResults(existing, latest);

    expect(result.availableTimes.map((t) => t.teeTimeId)).not.toContain(102);
    expect(result.disappearedTimes.map((t) => t.teeTimeId)).toContain(102);
    expect(result.newThisRun).toHaveLength(0);
  });

  test("removes disappeared time from newTimes", () => {
    const existing = makeExisting(
      [makeTeeTime(101, "2026-03-14T08:00:00"), makeTeeTime(102, "2026-03-14T08:08:00")],
      [makeTeeTime(102, "2026-03-14T08:08:00")],
      []
    );
    const latest = makeFetchResult([makeTeeTime(101, "2026-03-14T08:00:00")]);

    const result = compareResults(existing, latest);

    expect(result.newTimes.map((t) => t.teeTimeId)).not.toContain(102);
    expect(result.disappearedTimes.map((t) => t.teeTimeId)).toContain(102);
  });

  test("does not duplicate a time in disappearedTimes", () => {
    const existing = makeExisting(
      [makeTeeTime(101, "2026-03-14T08:00:00"), makeTeeTime(102, "2026-03-14T08:08:00")],
      [],
      [makeTeeTime(102, "2026-03-14T08:08:00")]
    );
    const latest = makeFetchResult([makeTeeTime(101, "2026-03-14T08:00:00")]);

    const result = compareResults(existing, latest);

    const disappearedIds = result.disappearedTimes.map((t) => t.teeTimeId);
    expect(disappearedIds.filter((id) => id === 102)).toHaveLength(1);
  });
});

describe("compareResults — previously disappeared time reappears", () => {
  test("removes from disappearedTimes, adds to availableTimes, newTimes, and newThisRun", () => {
    const existing = makeExisting(
      [makeTeeTime(101, "2026-03-14T08:00:00")],
      [],
      [makeTeeTime(102, "2026-03-14T08:08:00")]
    );
    const latest = makeFetchResult([
      makeTeeTime(101, "2026-03-14T08:00:00"),
      makeTeeTime(102, "2026-03-14T08:08:00"),
    ]);

    const result = compareResults(existing, latest);

    expect(result.disappearedTimes.map((t) => t.teeTimeId)).not.toContain(102);
    expect(result.availableTimes.map((t) => t.teeTimeId)).toContain(102);
    expect(result.newTimes.map((t) => t.teeTimeId)).toContain(102);
    expect(result.newThisRun.map((t) => t.teeTimeId)).toContain(102);
  });
});

describe("compareResults — no changes", () => {
  test("nothing changes when latest matches available", () => {
    const times = [
      makeTeeTime(101, "2026-03-14T08:00:00"),
      makeTeeTime(102, "2026-03-14T08:08:00"),
    ];
    const existing = makeExisting(times, [times[1]], []);
    const latest = makeFetchResult(times);

    const result = compareResults(existing, latest);

    expect(result.availableTimes).toHaveLength(2);
    expect(result.newTimes).toHaveLength(1);
    expect(result.disappearedTimes).toHaveLength(0);
    expect(result.newThisRun).toHaveLength(0);
  });
});
