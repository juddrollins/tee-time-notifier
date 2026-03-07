"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const https = __importStar(require("https"));
const WORKDIR = process.env.OUTPUT_DIR ?? "/workdir";
const COURSE_ID = process.env.COURSE_ID ?? "16503";
const PLAYERS = process.env.PLAYERS ?? "4";
const HOLES = process.env.HOLES ?? "18";
/**
 * Returns the target Saturday and Sunday to check.
 *
 * Rule: always fetch the upcoming Sat/Sun (8am-11am).
 * Exception: once Thursday flips to Friday (midnight), jump ahead
 * to the FOLLOWING weekend so we're always looking ~7+ days out.
 */
function getTargetWeekend() {
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
    const fmt = (d) => d.toISOString().split("T")[0];
    return { saturday: fmt(saturday), sunday: fmt(sunday) };
}
function buildUrl(dateFrom, dateTo) {
    const params = new URLSearchParams({
        golfCourseIds: COURSE_ID,
        dateFrom,
        dateTo,
        players: PLAYERS,
        holes: HOLES,
    });
    return `https://swan.tenfore.golf/api/TeeTimes/Search?${params}`;
}
function get(url) {
    return new Promise((resolve, reject) => {
        https
            .get(url, (res) => {
            let raw = "";
            res.on("data", (chunk) => (raw += chunk));
            res.on("end", () => {
                try {
                    resolve(JSON.parse(raw));
                }
                catch {
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
        get(buildUrl(`${saturday}T08:00:00`, `${saturday}T11:00:00`)),
        get(buildUrl(`${sunday}T08:00:00`, `${sunday}T11:00:00`)),
    ]);
    const result = {
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
main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
