# Tee Time Notifier

Monitors tee time availability at Falls Road Golf Course and sends email notifications when new times open up. Runs on a Raspberry Pi via cron, stores data to GitHub, and displays results on a GitHub Pages website.

## Live Site

**[https://juddrollins.github.io/tee-time-notifier/](https://juddrollins.github.io/tee-time-notifier/)**

Shows current available tee times, newly opened slots, times that have been booked, and a full pull log for the week.

---

## How It Works

Every 10 minutes a cron job on a Raspberry Pi runs three steps in sequence:

```
fetch → compare → notify
```

| Step | What it does |
|------|-------------|
| `fetch` | Calls the tee time API for the target weekend (8:00–11:30 AM window), filters results, saves a timestamped JSON file to the `data` branch of this repo |
| `compare` | Reads the first and latest fetch files for the week, finds any new tee time IDs, writes `comparison.json` |
| `notify` | If new times were found, sends an HTML email via Gmail SMTP |

### Target Weekend Logic

- **Mon–Thu**: tracks the upcoming Saturday/Sunday
- **Fri–Sat**: tracks the following Saturday/Sunday
- Switches at midnight Friday, giving a full week of tracking before the weekend

### Data Storage

All fetched data lives in the [`data` branch](../../tree/data) under:

```
data/
  weekend-YYYY-MM-DD/
    2026-03-10T10-00-00Z.json   ← individual fetch snapshots
    2026-03-10T10-10-00Z.json
    comparison.json              ← diff of first vs latest pull
```

---

## Repo Structure

```
src/
  fetch/        # Calls tee time API, saves JSON to GitHub
  compare/      # Diffs first vs latest pull, writes comparison.json
  notify/       # Sends email if new times found
  lib/
    dates.ts    # Target weekend calculation
    github.ts   # GitHub API client (read/write files)
    types.ts    # Shared TypeScript interfaces
docs/
  index.html    # GitHub Pages site (served from gh-pages branch)
scripts/
  setup-pi.sh   # One-command setup for Raspberry Pi deployment
run.sh          # Runs all three steps, used by cron
```

---

## Deploying to a Raspberry Pi

**1. Clone and set up**
```bash
git clone https://github.com/juddrollins/tee-time-notifier.git
cd tee-time-notifier
```

**2. Create a `.env` file**
```
GITHUB_TOKEN=ghp_...
GITHUB_OWNER=juddrollins
GITHUB_REPO=tee-time-notifier
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
NOTIFY_EMAILS=you@gmail.com
COURSE_ID=16503
PLAYERS=4
HOLES=18
```

**3. Run setup**
```bash
chmod +x run.sh scripts/setup-pi.sh
./scripts/setup-pi.sh
```

This installs dependencies, builds TypeScript, and registers the cron job.

**4. Test manually**
```bash
./run.sh
tail -f cron.log
```

**Updating after a git pull:**
```bash
npm install && npm run build
```

---

## Local Development

```bash
npm install
npm test
npm run build
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | Personal access token with `Contents: Read and write` |
| `GITHUB_OWNER` | GitHub username |
| `GITHUB_REPO` | Repository name where data is stored |
| `SMTP_USER` | Gmail address |
| `SMTP_PASS` | Gmail app password |
| `NOTIFY_EMAILS` | Comma-separated list of notification recipients |
| `COURSE_ID` | Golf course ID (Falls Road = `16503`) |
| `PLAYERS` | Number of players to filter for |
| `HOLES` | Number of holes (`18`) |
