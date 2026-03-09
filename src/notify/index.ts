import * as fs from "fs";
import * as path from "path";
import nodemailer from "nodemailer";
import { getTargetWeekend } from "../lib/dates";
import type { CompareResult } from "../compare/index";

const WORKDIR = process.env.OUTPUT_DIR ?? "/workdir";
const SMTP_USER = process.env.SMTP_USER ?? "";
const SMTP_PASS = process.env.SMTP_PASS ?? "";
const NOTIFY_EMAILS = process.env.NOTIFY_EMAILS ?? "";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTime(dateScheduled: string): string {
  return new Date(dateScheduled).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  });
}

function buildEmailBody(result: CompareResult): { subject: string; html: string } {
  const sat = formatDate(result.saturday);
  const sun = formatDate(result.sunday);
  const subject = `New tee times available — ${sat} & ${sun}`;

  const satTimes = result.newTimes.filter((t) =>
    t.dateScheduled.startsWith(result.saturday)
  );
  const sunTimes = result.newTimes.filter((t) =>
    t.dateScheduled.startsWith(result.sunday)
  );

  const renderDay = (label: string, times: CompareResult["newTimes"]) => {
    if (times.length === 0) return "";
    const rows = times
      .map(
        (t) =>
          `<tr>
            <td style="padding:6px 12px">${formatTime(t.dateScheduled)}</td>
            <td style="padding:6px 12px">${t.teeFeeTitle}</td>
            <td style="padding:6px 12px">${t.maxPlayers} players</td>
            <td style="padding:6px 12px">$${t.priceBeforeTax}</td>
          </tr>`
      )
      .join("");
    return `
      <h3 style="margin-top:24px">${label}</h3>
      <table style="border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#f3f4f6">
            <th style="padding:6px 12px;text-align:left">Time</th>
            <th style="padding:6px 12px;text-align:left">Rate</th>
            <th style="padding:6px 12px;text-align:left">Players</th>
            <th style="padding:6px 12px;text-align:left">Price</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  };

  const html = `
    <div style="font-family:sans-serif;max-width:600px">
      <h2>New Tee Times Available</h2>
      <p>${result.newTimes.length} new time(s) opened up for the weekend of ${sat}.</p>
      ${renderDay(sat, satTimes)}
      ${renderDay(sun, sunTimes)}
      <p style="margin-top:32px;color:#6b7280;font-size:12px">
        Falls Road Golf Course · 8am–11:30am window
      </p>
    </div>`;

  return { subject, html };
}

async function main() {
  const { saturday } = getTargetWeekend();
  const weekDir = path.join(WORKDIR, `weekend-${saturday}`);
  const comparisonPath = path.join(weekDir, "comparison.json");

  if (!fs.existsSync(comparisonPath)) {
    console.log("No comparison file yet — skipping notification");
    return;
  }

  const result: CompareResult = JSON.parse(
    fs.readFileSync(comparisonPath, "utf-8")
  );

  if (result.newTimes.length === 0) {
    console.log("No new tee times — skipping notification");
    return;
  }

  const recipients = NOTIFY_EMAILS.split(",").map((e) => e.trim()).filter(Boolean);
  if (recipients.length === 0) {
    throw new Error("NOTIFY_EMAILS is not set");
  }

  const { subject, html } = buildEmailBody(result);

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({
    from: `"Tee Time Notifier" <${SMTP_USER}>`,
    to: recipients.join(", "),
    subject,
    html,
  });

  console.log(`Sent notification to ${recipients.join(", ")}`);
  console.log(`Subject: ${subject}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
