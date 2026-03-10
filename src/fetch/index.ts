import * as https from "https";
import { getTargetWeekend } from "../lib/dates";
import * as github from "../lib/github";
import type { TeeTime, FetchResult } from "../lib/types";

export { getTargetWeekend };

const COURSE_ID = process.env.COURSE_ID ?? "16503";
const PLAYERS = process.env.PLAYERS ?? "4";
const HOLES = process.env.HOLES ?? "18";

function buildUrl(dateFrom: string, dateTo: string): string {
  const params = new URLSearchParams({
    golfCourseIds: COURSE_ID,
    dateFrom,
    dateTo,
    players: PLAYERS,
    holes: HOLES,
  });
  return `https://swan.tenfore.golf/api/TeeTimes/Search?${params}`;
}

function get(url: string): Promise<TeeTime[]> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(raw) as TeeTime[]);
          } catch {
            reject(new Error(`Failed to parse response: ${raw.slice(0, 200)}`));
          }
        });
      })
      .on("error", reject);
  });
}

async function main() {
  const { saturday, sunday } = getTargetWeekend();
  const fetchedAt = new Date().toISOString();

  console.log(`Target weekend: ${saturday} (Sat) / ${sunday} (Sun)`);

  const [satTimes, sunTimes] = await Promise.all([
    get(buildUrl(`${saturday}T08:00:00`, `${saturday}T11:30:00`)),
    get(buildUrl(`${sunday}T08:00:00`, `${sunday}T11:30:00`)),
  ]);

  // Sometimes API returns times outside the window, so we filter them out
  const inWindow = (t: TeeTime) => {
    const time = t.dateScheduled.split("T")[1]; // "HH:MM:SS"
    return time >= "08:00:00" && time <= "11:30:00";
  };

  const allTimes = [...satTimes, ...sunTimes];
  const filtered = allTimes.filter((t) => !inWindow(t));
  if (filtered.length > 0) {
    console.log(`Filtered out ${filtered.length} tee time(s) outside 08:00–11:30:`);
    filtered.forEach((t) => console.log(`  - ${t.dateScheduled} (id: ${t.teeTimeId})`));
  }

  const result: FetchResult = {
    fetchedAt,
    saturday,
    sunday,
    teeTimes: allTimes.filter(inWindow),
  };

  const timestamp = fetchedAt.replace(/[:.]/g, "-");
  const filePath = `data/weekend-${saturday}/${timestamp}.json`;
  await github.writeFile(filePath, JSON.stringify(result, null, 2), `fetch: ${saturday} at ${fetchedAt}`);

  console.log(`Saved ${result.teeTimes.length} tee times → ${filePath}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
