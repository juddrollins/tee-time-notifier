import * as fs from "fs";
import * as path from "path";
import { getTargetWeekend } from "../lib/dates";
import type { FetchResult, TeeTime } from "../lib/types";

const WORKDIR = process.env.OUTPUT_DIR ?? "/workdir";

export interface CompareResult {
  comparedAt: string;
  saturday: string;
  sunday: string;
  baselineFile: string;
  latestFile: string;
  newTimes: TeeTime[];
}

function readFetchResult(filePath: string): FetchResult {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as FetchResult;
}

export function compareWeekend(weekDir: string): CompareResult | null {
  const files = fs
    .readdirSync(weekDir)
    .filter((f) => f.endsWith(".json") && f !== "comparison.json")
    .sort(); // ISO timestamp filenames sort chronologically

  if (files.length < 2) {
    return null;
  }

  const baselineFile = files[0];
  const latestFile = files[files.length - 1];

  const baseline = readFetchResult(path.join(weekDir, baselineFile));
  const latest = readFetchResult(path.join(weekDir, latestFile));

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

function main() {
  const { saturday } = getTargetWeekend();
  const weekDir = path.join(WORKDIR, `weekend-${saturday}`);

  console.log(`Comparing pulls in ${weekDir}`);

  const result = compareWeekend(weekDir);

  if (result === null) {
    console.log("First pull of the week — nothing to compare yet, skipping");
    return;
  }

  console.log(`Baseline: ${result.baselineFile}`);
  console.log(`Latest:   ${result.latestFile}`);
  console.log(`New tee times found: ${result.newTimes.length}`);

  if (result.newTimes.length > 0) {
    result.newTimes.forEach((t) => {
      console.log(`  + ${t.dateScheduled} — ${t.teeFeeTitle} $${t.priceBeforeTax}`);
    });
  }

  fs.writeFileSync(
    path.join(weekDir, "comparison.json"),
    JSON.stringify(result, null, 2)
  );
}

if (require.main === module) {
  try {
    main();
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }
}
