import * as github from "../lib/github";
import { getTargetWeekend } from "../lib/dates";
import type { FetchResult, TeeTime } from "../lib/types";

export interface CompareResult {
  comparedAt: string;
  saturday: string;
  sunday: string;
  baselineFile: string;
  latestFile: string;
  newTimes: TeeTime[];
}

/** Pure comparison logic — no I/O. Returns null if fewer than 2 files (first pull of week). */
export function compareResults(
  baseline: FetchResult,
  latest: FetchResult,
  baselineFile: string,
  latestFile: string
): CompareResult {
  const baselineIds = new Set(baseline.teeTimes.map((t) => t.teeTimeId));
  const newTimes = latest.teeTimes.filter((t) => !baselineIds.has(t.teeTimeId));
  return {
    comparedAt: new Date().toISOString(),
    saturday: latest.saturday,
    sunday: latest.sunday,
    baselineFile,
    latestFile,
    newTimes,
  };
}

async function main() {
  const { saturday } = getTargetWeekend();
  const weekDir = `data/weekend-${saturday}`;

  console.log(`Comparing pulls in ${weekDir}`);

  const allFiles = await github.listDir(weekDir);
  const files = allFiles.filter((f) => f !== "comparison.json").sort();

  if (files.length < 2) {
    console.log("First pull of the week — nothing to compare yet, skipping");
    return;
  }

  const baselineFile = files[0];
  const latestFile = files[files.length - 1];

  const [baselineRaw, latestRaw] = await Promise.all([
    github.readFile(`${weekDir}/${baselineFile}`),
    github.readFile(`${weekDir}/${latestFile}`),
  ]);

  const baseline: FetchResult = JSON.parse(baselineRaw!);
  const latest: FetchResult = JSON.parse(latestRaw!);

  const result = compareResults(baseline, latest, baselineFile, latestFile);

  console.log(`Baseline: ${result.baselineFile}`);
  console.log(`Latest:   ${result.latestFile}`);
  console.log(`New tee times found: ${result.newTimes.length}`);

  if (result.newTimes.length > 0) {
    result.newTimes.forEach((t) => {
      console.log(`  + ${t.dateScheduled} — ${t.teeFeeTitle} $${t.priceBeforeTax}`);
    });
  }

  await github.writeFile(
    `${weekDir}/comparison.json`,
    JSON.stringify(result, null, 2),
    `compare: ${result.newTimes.length} new time(s) for ${saturday}`
  );
}

if (require.main === module) {
  main().catch((err: any) => {
    console.error(err.message);
    process.exit(1);
  });
}
