import * as fs from "fs";
import * as path from "path";
import * as https from "https";

const WORKDIR = process.env.OUTPUT_DIR ?? "/workdir";
const COURSE_ID = process.env.COURSE_ID ?? "16503";
const PLAYERS = process.env.PLAYERS ?? "4";
const HOLES = process.env.HOLES ?? "18";

interface TeeTime {
  golfCourseId: number;
  golfCourseName: string;
  teeTimeId: number;
  teeTimeTitle: string | null;
  dateScheduled: string;
  teeFeeId: number;
  teeFeeTitle: string;
  priceBeforeTax: number;
  minPlayers: number;
  maxPlayers: number;
  bookedPlayers: number;
}

interface FetchResult {
  fetchedAt: string;
  saturday: string;
  sunday: string;
  teeTimes: TeeTime[];
}

/**
 * Returns the target Saturday and Sunday to check.
 *
 * Rule: always fetch the upcoming Sat/Sun (8am-11am).
 * Exception: once Thursday flips to Friday (midnight), jump ahead
 * to the FOLLOWING weekend so we're always looking ~7+ days out.
 */
export function getTargetWeekend(): { saturday: string; sunday: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat

  // Days until the next Saturday (0 if today is Saturday)
  const daysUntilSat = (6 - day + 7) % 7;

  const saturday = new Date(now);
  saturday.setDate(now.getDate() + daysUntilSat);
  saturday.setHours(0, 0, 0, 0);

  // Thu/Fri/Sat: upcoming Sat is too close (<3 days) → skip to following weekend
  // Keeps the target always between +3 and +9 days out
  if (day === 4 || day === 5 || day === 6) {
    saturday.setDate(saturday.getDate() + 7);
  }

  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);

  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { saturday: fmt(saturday), sunday: fmt(sunday) };
}

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

  const result: FetchResult = {
    fetchedAt,
    saturday,
    sunday,
    teeTimes: [...satTimes, ...sunTimes],
  };

  // /workdir/week-2026-03-14/2026-03-07T10-30-00-000Z.json
  const weekDir = path.join(WORKDIR, `week-${saturday}`);
  fs.mkdirSync(weekDir, { recursive: true });

  const timestamp = fetchedAt.replace(/[:.]/g, "-");
  const outPath = path.join(weekDir, `${timestamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

  console.log(`Saved ${result.teeTimes.length} tee times → ${outPath}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
