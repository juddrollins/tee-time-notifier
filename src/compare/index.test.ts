import { describe, test, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import { compareWeekend } from "./index";

vi.mock("fs");

const WEEK_DIR = "/workdir/weekend-2026-03-14";

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

function makeFetchResult(teeTimes: ReturnType<typeof makeTeeTime>[]) {
  return JSON.stringify({
    fetchedAt: new Date().toISOString(),
    saturday: "2026-03-14",
    sunday: "2026-03-15",
    teeTimes,
  });
}

function setupFiles(files: Record<string, ReturnType<typeof makeTeeTime>[]>) {
  const filenames = Object.keys(files).sort();

  vi.mocked(fs.readdirSync).mockReturnValue(filenames as any);
  vi.mocked(fs.readFileSync).mockImplementation((filePath: any) => {
    const filename = filePath.split("/").pop();
    if (!(filename in files)) throw new Error(`Unexpected file read: ${filePath}`);
    return makeFetchResult(files[filename]);
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("compareWeekend", () => {
  test("returns new tee times that appear in latest but not baseline", () => {
    setupFiles({
      "2026-03-07T08-00-00Z.json": [
        makeTeeTime(101, "2026-03-14T08:00:00"),
        makeTeeTime(102, "2026-03-14T08:08:00"),
      ],
      "2026-03-07T08-20-00Z.json": [
        makeTeeTime(101, "2026-03-14T08:00:00"),
        makeTeeTime(102, "2026-03-14T08:08:00"),
        makeTeeTime(103, "2026-03-14T08:16:00"), // new
        makeTeeTime(104, "2026-03-14T08:24:00"), // new
      ],
    });

    const result = compareWeekend(WEEK_DIR);

    expect(result).not.toBeNull();
    expect(result!.newTimes).toHaveLength(2);
    expect(result!.newTimes.map((t) => t.teeTimeId)).toEqual([103, 104]);
  });

  test("returns empty array when no new tee times", () => {
    setupFiles({
      "2026-03-07T08-00-00Z.json": [
        makeTeeTime(101, "2026-03-14T08:00:00"),
      ],
      "2026-03-07T08-20-00Z.json": [
        makeTeeTime(101, "2026-03-14T08:00:00"),
      ],
    });

    const result = compareWeekend(WEEK_DIR);

    expect(result).not.toBeNull();
    expect(result!.newTimes).toHaveLength(0);
  });

  test("returns null when only one file exists (first pull of week)", () => {
    setupFiles({
      "2026-03-07T08-00-00Z.json": [makeTeeTime(101, "2026-03-14T08:00:00")],
    });

    expect(compareWeekend(WEEK_DIR)).toBeNull();
  });

  test("returns null when no files exist", () => {
    setupFiles({});

    expect(compareWeekend(WEEK_DIR)).toBeNull();
  });

  test("with many files, compares the first vs last (not adjacent)", () => {
    setupFiles({
      "2026-03-07T08-00-00Z.json": [makeTeeTime(101, "2026-03-14T08:00:00")],
      "2026-03-07T08-20-00Z.json": [makeTeeTime(101, "2026-03-14T08:00:00"), makeTeeTime(102, "2026-03-14T08:08:00")],
      "2026-03-07T08-40-00Z.json": [makeTeeTime(101, "2026-03-14T08:00:00"), makeTeeTime(102, "2026-03-14T08:08:00"), makeTeeTime(103, "2026-03-14T08:16:00")],
    });

    const result = compareWeekend(WEEK_DIR);

    expect(result).not.toBeNull();
    expect(result!.baselineFile).toBe("2026-03-07T08-00-00Z.json");
    expect(result!.latestFile).toBe("2026-03-07T08-40-00Z.json");
    expect(result!.newTimes.map((t) => t.teeTimeId)).toEqual([102, 103]);
  });

  test("ignores comparison.json when finding files", () => {
    vi.mocked(fs.readdirSync).mockReturnValue([
      "2026-03-07T08-00-00Z.json",
      "2026-03-07T08-20-00Z.json",
      "comparison.json",
    ] as any);
    vi.mocked(fs.readFileSync).mockImplementation((filePath: any) => {
      if (filePath.includes("comparison.json")) throw new Error("Should not read comparison.json");
      return makeFetchResult([makeTeeTime(101, "2026-03-14T08:00:00")]);
    });

    expect(() => compareWeekend(WEEK_DIR)).not.toThrow();
  });

  test("result includes correct metadata", () => {
    setupFiles({
      "2026-03-07T08-00-00Z.json": [makeTeeTime(101, "2026-03-14T08:00:00")],
      "2026-03-07T08-20-00Z.json": [makeTeeTime(101, "2026-03-14T08:00:00")],
    });

    const result = compareWeekend(WEEK_DIR);

    expect(result).not.toBeNull();
    expect(result!.saturday).toBe("2026-03-14");
    expect(result!.sunday).toBe("2026-03-15");
    expect(result!.baselineFile).toBe("2026-03-07T08-00-00Z.json");
    expect(result!.latestFile).toBe("2026-03-07T08-20-00Z.json");
  });
});
