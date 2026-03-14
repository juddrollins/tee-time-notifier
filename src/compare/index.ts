import * as github from "../lib/github";
import { getTargetWeekend } from "../lib/dates";
import type { FetchResult, TeeTime } from "../lib/types";

export interface CompareResult {
  comparedAt: string;
  saturday: string;
  sunday: string;
  availableTimes: TeeTime[];
  newTimes: TeeTime[];
  disappearedTimes: TeeTime[];
  newThisRun: TeeTime[];
}

/**
 * Pure comparison logic — no I/O.
 *
 * On first run (no existing comparison), seeds availableTimes from the latest
 * pull as the baseline with nothing marked new.
 *
 * On subsequent runs, diffs the latest pull against the existing state:
 *   - Times in latest but not in availableTimes → added to availableTimes,
 *     newTimes, and newThisRun; removed from disappearedTimes if present.
 *   - Times in availableTimes but not in latest → removed from availableTimes
 *     and newTimes; added to disappearedTimes.
 */
export function compareResults(
  existing: CompareResult | null,
  latest: FetchResult
): CompareResult {
  if (!existing) {
    return {
      comparedAt: new Date().toISOString(),
      saturday: latest.saturday,
      sunday: latest.sunday,
      availableTimes: latest.teeTimes,
      newTimes: [],
      disappearedTimes: [],
      newThisRun: [],
    };
  }

  const latestIds = new Set(latest.teeTimes.map((t) => t.teeTimeId));
  const availableIds = new Set(existing.availableTimes.map((t) => t.teeTimeId));
  const newIds = new Set(existing.newTimes.map((t) => t.teeTimeId));
  const disappearedIds = new Set(existing.disappearedTimes.map((t) => t.teeTimeId));

  let availableTimes = [...existing.availableTimes];
  let newTimes = [...existing.newTimes];
  let disappearedTimes = [...existing.disappearedTimes];
  const newThisRun: TeeTime[] = [];

  // Times in the latest pull that aren't currently available → newly appeared
  for (const t of latest.teeTimes) {
    if (!availableIds.has(t.teeTimeId)) {
      availableTimes.push(t);
      newThisRun.push(t);
      if (!newIds.has(t.teeTimeId)) {
        newTimes.push(t);
      }
      if (disappearedIds.has(t.teeTimeId)) {
        disappearedTimes = disappearedTimes.filter((d) => d.teeTimeId !== t.teeTimeId);
      }
    }
  }

  // Times currently available but missing from the latest pull → disappeared
  for (const t of existing.availableTimes) {
    if (!latestIds.has(t.teeTimeId)) {
      availableTimes = availableTimes.filter((a) => a.teeTimeId !== t.teeTimeId);
      newTimes = newTimes.filter((n) => n.teeTimeId !== t.teeTimeId);
      if (!disappearedIds.has(t.teeTimeId)) {
        disappearedTimes.push(t);
      }
    }
  }

  return {
    comparedAt: new Date().toISOString(),
    saturday: latest.saturday,
    sunday: latest.sunday,
    availableTimes,
    newTimes,
    disappearedTimes,
    newThisRun,
  };
}

async function main() {
  const { saturday } = getTargetWeekend();
  const weekDir = `data/weekend-${saturday}`;

  console.log(`Comparing pulls in ${weekDir}`);

  const allFiles = await github.listDir(weekDir);
  const fetchFiles = allFiles.filter((f) => f !== "comparison.json").sort();

  if (fetchFiles.length === 0) {
    console.log("No pulls yet this week — skipping");
    return;
  }

  const latestFile = fetchFiles[fetchFiles.length - 1];
  const [latestRaw, existingRaw] = await Promise.all([
    github.readFile(`${weekDir}/${latestFile}`),
    github.readFile(`${weekDir}/comparison.json`),
  ]);

  const latest: FetchResult = JSON.parse(latestRaw!);
  const existing: CompareResult | null = existingRaw ? JSON.parse(existingRaw) : null;

  const result = compareResults(existing, latest);

  console.log(`Latest:    ${latestFile}`);
  console.log(`Available: ${result.availableTimes.length}`);
  console.log(`New this run: ${result.newThisRun.length}`);
  result.newThisRun.forEach((t) => {
    console.log(`  + ${t.dateScheduled} — ${t.teeFeeTitle} $${t.priceBeforeTax}`);
  });
  console.log(`Disappeared (total): ${result.disappearedTimes.length}`);

  await github.writeFile(
    `${weekDir}/comparison.json`,
    JSON.stringify(result, null, 2),
    `compare: +${result.newThisRun.length} new, ${result.availableTimes.length} available for ${saturday}`
  );
}

if (require.main === module) {
  main().catch((err: any) => {
    console.error(err.message);
    process.exit(1);
  });
}
