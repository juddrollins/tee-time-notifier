import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { getTargetWeekend } from "./index";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// Reference week: Mon Mar 9 – Sun Mar 15, 2026
// Upcoming Sat/Sun  = Mar 14 / Mar 15
// Following Sat/Sun = Mar 21 / Mar 22

describe("getTargetWeekend", () => {
  describe("Mon / Tue / Wed → upcoming weekend (+3 to +5 days)", () => {
    test("Monday", () => {
      vi.setSystemTime(new Date("2026-03-09T12:00:00"));
      expect(getTargetWeekend()).toEqual({ saturday: "2026-03-14", sunday: "2026-03-15" });
    });

    test("Tuesday", () => {
      vi.setSystemTime(new Date("2026-03-10T12:00:00"));
      expect(getTargetWeekend()).toEqual({ saturday: "2026-03-14", sunday: "2026-03-15" });
    });

    test("Wednesday (+3 days)", () => {
      vi.setSystemTime(new Date("2026-03-11T12:00:00"));
      expect(getTargetWeekend()).toEqual({ saturday: "2026-03-14", sunday: "2026-03-15" });
    });
  });

  describe("Thu / Fri / Sat → following weekend (+7 to +9 days)", () => {
    test("Thursday (+9 days)", () => {
      vi.setSystemTime(new Date("2026-03-12T12:00:00"));
      expect(getTargetWeekend()).toEqual({ saturday: "2026-03-21", sunday: "2026-03-22" });
    });

    test("Friday (+8 days)", () => {
      vi.setSystemTime(new Date("2026-03-13T12:00:00"));
      expect(getTargetWeekend()).toEqual({ saturday: "2026-03-21", sunday: "2026-03-22" });
    });

    test("Saturday (+7 days)", () => {
      vi.setSystemTime(new Date("2026-03-14T12:00:00"));
      expect(getTargetWeekend()).toEqual({ saturday: "2026-03-21", sunday: "2026-03-22" });
    });
  });

  describe("Sunday → upcoming weekend (+6 days)", () => {
    test("Sunday (+6 days)", () => {
      vi.setSystemTime(new Date("2026-03-15T12:00:00"));
      expect(getTargetWeekend()).toEqual({ saturday: "2026-03-21", sunday: "2026-03-22" });
    });
  });

  describe("saturday and sunday are always consecutive days", () => {
    const days = [
      "2026-03-09T12:00:00", // Mon
      "2026-03-10T12:00:00", // Tue
      "2026-03-11T12:00:00", // Wed
      "2026-03-12T12:00:00", // Thu
      "2026-03-13T12:00:00", // Fri
      "2026-03-14T12:00:00", // Sat
      "2026-03-15T12:00:00", // Sun
    ];

    test.each(days)("consecutive for %s", (dateStr) => {
      vi.setSystemTime(new Date(dateStr));
      const { saturday, sunday } = getTargetWeekend();
      const sat = new Date(saturday);
      const sun = new Date(sunday);
      expect(sun.getTime() - sat.getTime()).toBe(24 * 60 * 60 * 1000);
      expect(sat.getUTCDay()).toBe(6);
      expect(sun.getUTCDay()).toBe(0);
    });
  });
});
