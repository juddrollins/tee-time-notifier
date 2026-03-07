import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const OUTPUT_DIR = process.env.OUTPUT_DIR ?? "/workdir";

interface TeeTime {
  time: string;
  available: boolean;
  players: number;
  price: number;
}

interface FetchResult {
  run_id: string;
  fetched_at: string;
  course_id: string;
  date: string;
  tee_times: TeeTime[];
}

function mockFetch(): FetchResult {
  return {
    run_id: crypto.randomUUID(),
    fetched_at: new Date().toISOString(),
    course_id: process.env.COURSE_ID ?? "course-123",
    date: process.env.TARGET_DATE ?? new Date().toISOString().split("T")[0],
    tee_times: [
      { time: "07:00", available: true, players: 4, price: 65.0 },
      { time: "07:08", available: true, players: 2, price: 55.0 },
      { time: "07:16", available: false, players: 4, price: 65.0 },
      { time: "07:24", available: true, players: 3, price: 60.0 },
    ],
  };
}

function main() {
  const result = mockFetch();

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const outPath = path.join(OUTPUT_DIR, "fetch.json");
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

  console.log(`Fetched ${result.tee_times.length} tee times for ${result.date}`);
  console.log(`run_id: ${result.run_id}`);
  console.log(`Saved to: ${outPath}`);
}

main();
