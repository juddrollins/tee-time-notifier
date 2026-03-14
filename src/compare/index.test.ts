import { describe, test, expect } from "vitest";
import { compareResults } from "./index";
import type { CompareResult, TrackedTeeTime, DisappearedTeeTime } from "./index";
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

function makeTracked(id: number, dateScheduled: string, firstSeenAt = "2026-03-10T08:00:00.000Z"): TrackedTeeTime {
  return { ...makeTeeTime(id, dateScheduled), firstSeenAt };
}

function makeDisappeared(id: number, dateScheduled: string, disappearedAt = "2026-03-10T09:00:00.000Z"): DisappearedTeeTime {
  return { ...makeTracked(id, dateScheduled), disappearedAt };
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
  availableTimes: TrackedTeeTime[],
  newTimes: TrackedTeeTime[],
  disappearedTimes: DisappearedTeeTime[]
): CompareResult {
  return {
    comparedAt: "2026-03-10T08:00:00.000Z",
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

  test("stamps firstSeenAt on all baseline times", () => {
    const before = new Date();
    const result = compareResults(null, makeFetchResult([makeTeeTime(101, "2026-03-14T08:00:00")]));
    const after = new Date();

    const ts = new Date(result.availableTimes[0].firstSeenAt);
    expect(ts.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(ts.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

describe("compareResults — new times appear", () => {
  test("adds new time to availableTimes, newTimes, and newThisRun", () => {
    const existing = makeExisting([makeTracked(101, "2026-03-14T08:00:00")], [], []);
    const latest = makeFetchResult([
      makeTeeTime(101, "2026-03-14T08:00:00"),
      makeTeeTime(102, "2026-03-14T08:08:00"),
    ]);

    const result = compareResults(existing, latest);

    expect(result.availableTimes.map((t) => t.teeTimeId)).toContain(102);
    expect(result.newTimes.map((t) => t.teeTimeId)).toContain(102);
    expect(result.newThisRun.map((t) => t.teeTimeId)).toEqual([102]);
  });

  test("stamps firstSeenAt on newly appeared times", () => {
    const existing = makeExisting([makeTracked(101, "2026-03-14T08:00:00")], [], []);
    const latest = makeFetchResult([
      makeTeeTime(101, "2026-03-14T08:00:00"),
      makeTeeTime(102, "2026-03-14T08:08:00"),
    ]);

    const before = new Date();
    const result = compareResults(existing, latest);
    const after = new Date();

    const newTime = result.availableTimes.find((t) => t.teeTimeId === 102)!;
    const ts = new Date(newTime.firstSeenAt);
    expect(ts.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(ts.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  test("preserves firstSeenAt on times that were already available", () => {
    const originalFirstSeen = "2026-03-10T08:00:00.000Z";
    const existing = makeExisting([makeTracked(101, "2026-03-14T08:00:00", originalFirstSeen)], [], []);
    const latest = makeFetchResult([makeTeeTime(101, "2026-03-14T08:00:00")]);

    const result = compareResults(existing, latest);

    expect(result.availableTimes[0].firstSeenAt).toBe(originalFirstSeen);
  });

  test("does not duplicate a time in newTimes if it was already there", () => {
    const existing = makeExisting(
      [makeTracked(101, "2026-03-14T08:00:00"), makeTracked(102, "2026-03-14T08:08:00")],
      [makeTracked(102, "2026-03-14T08:08:00")],
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
      [makeTracked(101, "2026-03-14T08:00:00"), makeTracked(102, "2026-03-14T08:08:00")],
      [],
      []
    );
    const latest = makeFetchResult([makeTeeTime(101, "2026-03-14T08:00:00")]);

    const result = compareResults(existing, latest);

    expect(result.availableTimes.map((t) => t.teeTimeId)).not.toContain(102);
    expect(result.disappearedTimes.map((t) => t.teeTimeId)).toContain(102);
    expect(result.newThisRun).toHaveLength(0);
  });

  test("stamps disappearedAt when a time disappears", () => {
    const existing = makeExisting(
      [makeTracked(101, "2026-03-14T08:00:00"), makeTracked(102, "2026-03-14T08:08:00")],
      [],
      []
    );
    const latest = makeFetchResult([makeTeeTime(101, "2026-03-14T08:00:00")]);

    const before = new Date();
    const result = compareResults(existing, latest);
    const after = new Date();

    const gone = result.disappearedTimes.find((t) => t.teeTimeId === 102)!;
    const ts = new Date(gone.disappearedAt);
    expect(ts.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(ts.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  test("preserves firstSeenAt on disappeared time", () => {
    const originalFirstSeen = "2026-03-10T08:00:00.000Z";
    const existing = makeExisting(
      [makeTracked(101, "2026-03-14T08:00:00"), makeTracked(102, "2026-03-14T08:08:00", originalFirstSeen)],
      [],
      []
    );
    const latest = makeFetchResult([makeTeeTime(101, "2026-03-14T08:00:00")]);

    const result = compareResults(existing, latest);

    const gone = result.disappearedTimes.find((t) => t.teeTimeId === 102)!;
    expect(gone.firstSeenAt).toBe(originalFirstSeen);
  });

  test("removes disappeared time from newTimes", () => {
    const existing = makeExisting(
      [makeTracked(101, "2026-03-14T08:00:00"), makeTracked(102, "2026-03-14T08:08:00")],
      [makeTracked(102, "2026-03-14T08:08:00")],
      []
    );
    const latest = makeFetchResult([makeTeeTime(101, "2026-03-14T08:00:00")]);

    const result = compareResults(existing, latest);

    expect(result.newTimes.map((t) => t.teeTimeId)).not.toContain(102);
    expect(result.disappearedTimes.map((t) => t.teeTimeId)).toContain(102);
  });

  test("does not duplicate a time in disappearedTimes", () => {
    const existing = makeExisting(
      [makeTracked(101, "2026-03-14T08:00:00"), makeTracked(102, "2026-03-14T08:08:00")],
      [],
      [makeDisappeared(102, "2026-03-14T08:08:00")]
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
      [makeTracked(101, "2026-03-14T08:00:00")],
      [],
      [makeDisappeared(102, "2026-03-14T08:08:00")]
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
    const times = [makeTracked(101, "2026-03-14T08:00:00"), makeTracked(102, "2026-03-14T08:08:00")];
    const existing = makeExisting(times, [times[1]], []);
    const latest = makeFetchResult([
      makeTeeTime(101, "2026-03-14T08:00:00"),
      makeTeeTime(102, "2026-03-14T08:08:00"),
    ]);

    const result = compareResults(existing, latest);

    expect(result.availableTimes).toHaveLength(2);
    expect(result.newTimes).toHaveLength(1);
    expect(result.disappearedTimes).toHaveLength(0);
    expect(result.newThisRun).toHaveLength(0);
  });
});
